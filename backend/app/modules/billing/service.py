"""Billing service — all billing business logic lives here.

Responsibilities:
- Load and verify the target table session (restaurant-scoped)
- Compute bill summary from persisted order data (DB-authoritative)
- Include only completed, unpaid orders in the bill
- Prevent duplicate settlement (bill already exists and is paid)
- Settle the bill atomically:
    1. Create Bill record
    2. Update per-order Payment records to paid
    3. Mark orders as paid (status + paid_at)
    4. Mark Bill as paid
    5. Close table session
    6. Commit
- Provide session billing status summary
- Provide payment history for a session

NO business logic lives outside this file for the billing domain.
"""
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.billing import repository as billing_repo
from app.modules.billing.model import BillStatus
from app.modules.billing.schemas import (
    BillOrderItemResponse,
    BillOrderResponse,
    BillSummaryResponse,
    SessionBillingStatusResponse,
    SessionPaymentHistoryResponse,
    SettleSessionRequest,
    SettleSessionResponse,
)
from app.modules.orders import repository as order_repo
from app.modules.payments import repository as payment_repo
from app.modules.payments.schemas import PaymentResponse
from app.modules.table_sessions import repository as session_repo


# ── Internal helpers ──────────────────────────────────────────────────────────

def _load_session_or_404(db: Session, session_id: str, restaurant_id: int):
    """Load a session scoped to the restaurant — raises 404 if not found."""
    candidate = (session_id or "").strip()
    session = session_repo.get_session_by_id_and_restaurant(db, candidate, restaurant_id)

    if session is None and candidate:
        # Real-world staff input often uses a short session prefix copied from UI.
        # Accept prefix only when it resolves to exactly one session.
        matches = session_repo.list_sessions_by_id_prefix(
            db,
            restaurant_id=restaurant_id,
            session_id_prefix=candidate,
            limit=2,
        )
        if len(matches) == 1:
            session = matches[0]
        elif len(matches) > 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Session id is ambiguous. Please enter a longer session id "
                    "or use the table number."
                ),
            )

    if session is None:
        # Staff may enter table number in the billing search field.
        # Fallback to latest session for that table when session_id lookup fails.
        table_number_candidate = candidate
        if table_number_candidate:
            fallback = session_repo.get_latest_session_by_table_number(
                db,
                restaurant_id=restaurant_id,
                table_number=table_number_candidate,
            )
            if fallback is not None:
                return fallback

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Table session not found. Enter a valid full/short session id "
                "or a table number."
            ),
        )
    return session


def _build_bill_order_response(order) -> BillOrderResponse:
    return BillOrderResponse(
        id=order.id,
        order_number=order.order_number,
        placed_at=order.placed_at,
        total_amount=float(order.total_amount),
        items=[
            BillOrderItemResponse(
                id=oi.id,
                item_name_snapshot=oi.item_name_snapshot,
                quantity=oi.quantity,
                unit_price_snapshot=float(oi.unit_price_snapshot),
                line_total=float(oi.line_total),
            )
            for oi in order.items
        ],
    )


# ── Public service methods ────────────────────────────────────────────────────

def get_bill_summary(
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> BillSummaryResponse:
    """Compute and return the bill summary for a table session.

    Returns all completed, unpaid orders belonging to the session.
    Tax and discount are 0.0 in this phase (no engine implemented).
    """
    session = _load_session_or_404(db, session_id, restaurant_id)
    effective_session_id = session.session_id

    # Check if already settled
    existing_bill = billing_repo.get_bill_by_session(db, effective_session_id, restaurant_id)
    is_settled = existing_bill is not None and existing_bill.payment_status == BillStatus.paid

    # Load billable orders (completed + not yet paid status)
    billable_orders = order_repo.list_billable_orders_by_session(
        db, effective_session_id, restaurant_id
    )

    subtotal = sum(float(o.total_amount) for o in billable_orders)
    tax_amount = 0.0
    discount_amount = 0.0
    grand_total = subtotal + tax_amount - discount_amount

    return BillSummaryResponse(
        session_id=effective_session_id,
        restaurant_id=restaurant_id,
        table_number=session.table_number,
        orders=[_build_bill_order_response(o) for o in billable_orders],
        order_count=len(billable_orders),
        subtotal=round(subtotal, 2),
        tax_amount=round(tax_amount, 2),
        discount_amount=round(discount_amount, 2),
        grand_total=round(grand_total, 2),
        session_is_active=session.is_active,
        is_settled=is_settled,
    )


def settle_session(
    db: Session,
    session_id: str,
    restaurant_id: int,
    payload: SettleSessionRequest,
) -> SettleSessionResponse:
    """Settle the bill for a table session.

    Atomic transaction:
    1. Validate session exists and belongs to the restaurant
    2. Validate no existing paid bill (prevent double settlement)
    3. Load billable (completed, unpaid) orders — require at least one
    4. Compute server-authoritative totals
    5. Create Bill record
    6. Update per-order Payment records to paid
    7. Bulk-update order statuses to paid + set paid_at
    8. Mark Bill as paid
    9. Close the table session (is_active = False)
    10. Commit

    SECURITY: restaurant_id comes from the authenticated token, never the client.
    Totals are computed server-side from persisted order data.
    """
    session = _load_session_or_404(db, session_id, restaurant_id)
    effective_session_id = session.session_id

    # ── Guard: duplicate settlement ──────────────────────────────────────
    existing_bill = billing_repo.get_bill_by_session(db, effective_session_id, restaurant_id)
    if existing_bill is not None and existing_bill.payment_status == BillStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This session has already been settled.",
        )

    # ── Load billable orders ─────────────────────────────────────────────
    billable_orders = order_repo.list_billable_orders_by_session(
        db, effective_session_id, restaurant_id
    )
    if not billable_orders:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No billable orders found. "
                "All orders must reach 'completed' status before settlement."
            ),
        )

    # ── Server-side total computation ────────────────────────────────────
    subtotal = sum(float(o.total_amount) for o in billable_orders)
    tax_amount = 0.0
    discount_amount = 0.0
    total_amount = subtotal + tax_amount - discount_amount
    settled_at = datetime.now(UTC)
    order_ids = [o.id for o in billable_orders]

    try:
        # 1. Create the Bill record (initially pending)
        bill = billing_repo.create_bill(
            db,
            restaurant_id=restaurant_id,
            session_id=effective_session_id,
            table_number=session.table_number,
            subtotal_amount=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            total_amount=total_amount,
            payment_method=payload.payment_method,
            transaction_reference=payload.transaction_reference,
            notes=payload.notes,
        )

        # 2. Update per-order Payment records to paid
        payment_repo.update_payments_for_settlement(
            db,
            order_ids=order_ids,
            restaurant_id=restaurant_id,
            payment_method=payload.payment_method,
            transaction_reference=payload.transaction_reference,
            notes=payload.notes,
            paid_at=settled_at,
        )

        # 3. Bulk-update orders to paid status
        order_repo.mark_orders_paid_by_ids(
            db,
            order_ids=order_ids,
            restaurant_id=restaurant_id,
            paid_at=settled_at,
        )

        # 4. Mark the bill as paid
        billing_repo.mark_bill_paid(db, bill, settled_at)

        # 5. Close the table session
        session_repo.close_session_by_id(db, effective_session_id, restaurant_id)

        db.commit()

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This session has already been settled.",
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Settlement failed. Please try again.",
        )

    return SettleSessionResponse(
        bill_id=bill.id,
        bill_number=bill.bill_number,
        session_id=effective_session_id,
        table_number=session.table_number,
        order_count=len(order_ids),
        total_amount=round(total_amount, 2),
        payment_method=payload.payment_method,
        payment_status=BillStatus.paid,
        settled_at=settled_at,
        session_closed=True,
    )


def get_session_billing_status(
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> SessionBillingStatusResponse:
    """Return a quick billing status snapshot for a session."""
    session = _load_session_or_404(db, session_id, restaurant_id)
    effective_session_id = session.session_id

    existing_bill = billing_repo.get_bill_by_session(db, effective_session_id, restaurant_id)
    is_settled = existing_bill is not None and existing_bill.payment_status == BillStatus.paid

    billable_orders = order_repo.list_billable_orders_by_session(
        db, effective_session_id, restaurant_id
    )
    grand_total = sum(float(o.total_amount) for o in billable_orders)

    return SessionBillingStatusResponse(
        session_id=effective_session_id,
        table_number=session.table_number,
        is_active=session.is_active,
        is_settled=is_settled,
        billable_order_count=len(billable_orders),
        grand_total=round(grand_total, 2),
    )


def list_session_payments(
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> SessionPaymentHistoryResponse:
    """Return all payment records associated with a table session."""
    session = _load_session_or_404(db, session_id, restaurant_id)
    effective_session_id = session.session_id

    payments = payment_repo.list_payments_by_session(db, effective_session_id, restaurant_id)

    return SessionPaymentHistoryResponse(
        session_id=effective_session_id,
        payments=[
            PaymentResponse(
                id=p.id,
                order_id=p.order_id,
                restaurant_id=p.restaurant_id,
                amount=float(p.amount),
                payment_method=p.payment_method,
                payment_status=p.payment_status,
                transaction_reference=p.transaction_reference,
                paid_at=p.paid_at,
                created_at=p.created_at,
            )
            for p in payments
        ],
        total=len(payments),
    )
