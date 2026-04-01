"""Billing service for table settlements and room folios."""
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.billing import repository as billing_repo
from app.modules.billing.model import (
    Bill,
    BillContextType,
    BillHandoffStatus,
    BillStatus,
)
from app.modules.billing.schemas import (
    BillListResponse,
    BillOrderItemResponse,
    BillOrderResponse,
    BillRecordResponse,
    BillSummaryResponse,
    SessionBillingStatusResponse,
    SessionPaymentHistoryResponse,
    SettleSessionRequest,
    SettleSessionResponse,
)
from app.modules.orders import repository as order_repo
from app.modules.orders.model import OrderStatus
from app.modules.payments import repository as payment_repo
from app.modules.payments.schemas import PaymentResponse
from app.modules.room_sessions import repository as room_session_repo
from app.modules.table_sessions import repository as table_session_repo


def _to_bill_record(bill: Bill) -> BillRecordResponse:
    return BillRecordResponse(
        id=bill.id,
        bill_number=bill.bill_number,
        context_type=bill.context_type,
        session_id=bill.session_id,
        table_number=bill.table_number,
        room_id=bill.room_id,
        room_number=bill.room_number,
        total_amount=float(bill.total_amount),
        payment_method=bill.payment_method,
        payment_status=bill.payment_status,
        transaction_reference=bill.transaction_reference,
        notes=bill.notes,
        handoff_status=bill.handoff_status,
        sent_to_cashier_at=bill.sent_to_cashier_at,
        sent_to_accountant_at=bill.sent_to_accountant_at,
        handoff_completed_at=bill.handoff_completed_at,
        settled_at=bill.settled_at,
        created_at=bill.created_at,
    )


def _build_bill_order_response(order) -> BillOrderResponse:
    return BillOrderResponse(
        id=order.id,
        order_number=order.order_number,
        placed_at=order.placed_at,
        total_amount=float(order.total_amount),
        items=[
            BillOrderItemResponse(
                id=item.id,
                item_name_snapshot=item.item_name_snapshot,
                quantity=item.quantity,
                unit_price_snapshot=float(item.unit_price_snapshot),
                line_total=float(item.line_total),
            )
            for item in order.items
        ],
    )


def _load_table_session_or_404(db: Session, lookup: str, restaurant_id: int):
    candidate = (lookup or "").strip()
    session = table_session_repo.get_session_by_id_and_restaurant(db, candidate, restaurant_id)

    if session is None and candidate:
        matches = table_session_repo.list_sessions_by_id_prefix(
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

    if session is None and candidate:
        fallback = table_session_repo.get_latest_session_by_table_number(
            db,
            restaurant_id=restaurant_id,
            table_number=candidate,
        )
        if fallback is not None:
            session = fallback

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Table session not found. Enter a valid full/short session id "
                "or a table number."
            ),
        )

    return session


def _pick_relevant_room_session(
    db: Session,
    *,
    restaurant_id: int,
    sessions: list,
):
    for session in sessions:
        existing_bill = billing_repo.get_bill_by_session(db, session.session_id, restaurant_id)
        if existing_bill is not None:
            return session
        billable_orders = order_repo.list_billable_orders_by_session(
            db,
            session.session_id,
            restaurant_id,
        )
        if billable_orders:
            return session
    return sessions[0] if sessions else None


def _load_room_session_or_404(db: Session, lookup: str, restaurant_id: int):
    candidate = (lookup or "").strip()
    session = room_session_repo.get_room_session_by_id_and_restaurant(db, candidate, restaurant_id)

    if session is None and candidate:
        matches = room_session_repo.list_sessions_by_id_prefix(
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
                    "Room session id is ambiguous. Please enter a longer session id "
                    "or use the room number."
                ),
            )

    if session is None and candidate:
        sessions = room_session_repo.list_sessions_by_room_number(
            db,
            restaurant_id=restaurant_id,
            room_number=candidate,
            limit=5,
        )
        session = _pick_relevant_room_session(
            db,
            restaurant_id=restaurant_id,
            sessions=sessions,
        )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Room session not found. Enter a valid full/short session id "
                "or a room number."
            ),
        )

    return session


def _build_summary_response(
    db: Session,
    *,
    context_type: BillContextType,
    session_id: str,
    restaurant_id: int,
    table_number: str | None,
    room_id: int | None,
    room_number: str | None,
    session_is_active: bool,
) -> BillSummaryResponse:
    existing_bill = billing_repo.get_bill_by_session(db, session_id, restaurant_id)
    is_settled = existing_bill is not None and existing_bill.payment_status == BillStatus.paid

    if is_settled and existing_bill is not None:
        summary_orders = order_repo.list_orders_by_session(
            db,
            session_id,
            restaurant_id,
            statuses=[OrderStatus.paid],
        )
        subtotal = float(existing_bill.subtotal_amount)
        tax_amount = float(existing_bill.tax_amount)
        discount_amount = float(existing_bill.discount_amount)
        grand_total = float(existing_bill.total_amount)
    else:
        summary_orders = order_repo.list_billable_orders_by_session(
            db,
            session_id,
            restaurant_id,
        )
        subtotal = sum(float(order.total_amount) for order in summary_orders)
        tax_amount = 0.0
        discount_amount = 0.0
        grand_total = subtotal + tax_amount - discount_amount

    return BillSummaryResponse(
        context_type=context_type,
        session_id=session_id,
        restaurant_id=restaurant_id,
        table_number=table_number,
        room_id=room_id,
        room_number=room_number,
        orders=[_build_bill_order_response(order) for order in summary_orders],
        order_count=len(summary_orders),
        subtotal=round(subtotal, 2),
        tax_amount=round(tax_amount, 2),
        discount_amount=round(discount_amount, 2),
        grand_total=round(grand_total, 2),
        session_is_active=session_is_active,
        is_settled=is_settled,
        bill=_to_bill_record(existing_bill) if existing_bill is not None else None,
    )


def _settle_context_session(
    db: Session,
    *,
    context_type: BillContextType,
    session_id: str,
    restaurant_id: int,
    table_number: str | None,
    room_id: int | None,
    room_number: str | None,
    payload: SettleSessionRequest,
    close_session,
) -> SettleSessionResponse:
    existing_bill = billing_repo.get_bill_by_session(db, session_id, restaurant_id)
    if existing_bill is not None and existing_bill.payment_status == BillStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This session has already been settled.",
        )

    billable_orders = order_repo.list_billable_orders_by_session(db, session_id, restaurant_id)
    if not billable_orders:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No billable orders found. "
                "All orders must reach 'completed' status before settlement."
            ),
        )

    subtotal = sum(float(order.total_amount) for order in billable_orders)
    tax_amount = 0.0
    discount_amount = 0.0
    total_amount = subtotal + tax_amount - discount_amount
    settled_at = datetime.now(UTC)
    order_ids = [order.id for order in billable_orders]

    try:
        bill = billing_repo.create_bill(
            db,
            restaurant_id=restaurant_id,
            session_id=session_id,
            context_type=context_type,
            table_number=table_number,
            room_id=room_id,
            room_number=room_number,
            subtotal_amount=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            total_amount=total_amount,
            payment_method=payload.payment_method,
            transaction_reference=payload.transaction_reference,
            notes=payload.notes,
        )

        payment_repo.update_payments_for_settlement(
            db,
            order_ids=order_ids,
            restaurant_id=restaurant_id,
            payment_method=payload.payment_method,
            transaction_reference=payload.transaction_reference,
            notes=payload.notes,
            paid_at=settled_at,
        )

        order_repo.mark_orders_paid_by_ids(
            db,
            order_ids=order_ids,
            restaurant_id=restaurant_id,
            paid_at=settled_at,
        )

        billing_repo.mark_bill_paid(db, bill, settled_at)
        close_session()
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
        context_type=context_type,
        session_id=session_id,
        table_number=table_number,
        room_id=room_id,
        room_number=room_number,
        order_count=len(order_ids),
        total_amount=round(total_amount, 2),
        payment_method=payload.payment_method,
        payment_status=BillStatus.paid,
        handoff_status=bill.handoff_status,
        settled_at=settled_at,
        session_closed=True,
    )


def _build_status_response(
    db: Session,
    *,
    context_type: BillContextType,
    session_id: str,
    restaurant_id: int,
    table_number: str | None,
    room_id: int | None,
    room_number: str | None,
    session_is_active: bool,
) -> SessionBillingStatusResponse:
    existing_bill = billing_repo.get_bill_by_session(db, session_id, restaurant_id)
    is_settled = existing_bill is not None and existing_bill.payment_status == BillStatus.paid
    billable_orders = order_repo.list_billable_orders_by_session(db, session_id, restaurant_id)
    grand_total = sum(float(order.total_amount) for order in billable_orders)

    return SessionBillingStatusResponse(
        context_type=context_type,
        session_id=session_id,
        table_number=table_number,
        room_id=room_id,
        room_number=room_number,
        is_active=session_is_active,
        is_settled=is_settled,
        billable_order_count=len(billable_orders),
        grand_total=round(grand_total, 2),
        handoff_status=existing_bill.handoff_status if existing_bill is not None else None,
    )


def _build_payment_history_response(
    db: Session,
    *,
    context_type: BillContextType,
    session_id: str,
    restaurant_id: int,
    table_number: str | None,
    room_id: int | None,
    room_number: str | None,
) -> SessionPaymentHistoryResponse:
    payments = payment_repo.list_payments_by_session(db, session_id, restaurant_id)
    return SessionPaymentHistoryResponse(
        context_type=context_type,
        session_id=session_id,
        table_number=table_number,
        room_id=room_id,
        room_number=room_number,
        payments=[
            PaymentResponse(
                id=payment.id,
                order_id=payment.order_id,
                restaurant_id=payment.restaurant_id,
                amount=float(payment.amount),
                payment_method=payment.payment_method,
                payment_status=payment.payment_status,
                transaction_reference=payment.transaction_reference,
                paid_at=payment.paid_at,
                created_at=payment.created_at,
            )
            for payment in payments
        ],
        total=len(payments),
    )


def _load_room_bill_or_404(db: Session, bill_id: int, restaurant_id: int) -> Bill:
    bill = billing_repo.get_bill_by_id(db, bill_id, restaurant_id)
    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folio not found.",
        )
    if bill.context_type != BillContextType.room:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only room folios support cashier/accountant handoff.",
        )
    if bill.payment_status != BillStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only settled room folios can enter the handoff workflow.",
        )
    return bill


def get_bill_summary(
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> BillSummaryResponse:
    session = _load_table_session_or_404(db, session_id, restaurant_id)
    return _build_summary_response(
        db,
        context_type=BillContextType.table,
        session_id=session.session_id,
        restaurant_id=restaurant_id,
        table_number=session.table_number,
        room_id=None,
        room_number=None,
        session_is_active=session.is_active,
    )


def get_room_bill_summary(
    db: Session,
    lookup: str,
    restaurant_id: int,
) -> BillSummaryResponse:
    session = _load_room_session_or_404(db, lookup, restaurant_id)
    return _build_summary_response(
        db,
        context_type=BillContextType.room,
        session_id=session.session_id,
        restaurant_id=restaurant_id,
        table_number=None,
        room_id=session.room_id,
        room_number=session.room_number_snapshot,
        session_is_active=session.is_active,
    )


def settle_session(
    db: Session,
    session_id: str,
    restaurant_id: int,
    payload: SettleSessionRequest,
) -> SettleSessionResponse:
    session = _load_table_session_or_404(db, session_id, restaurant_id)
    return _settle_context_session(
        db,
        context_type=BillContextType.table,
        session_id=session.session_id,
        restaurant_id=restaurant_id,
        table_number=session.table_number,
        room_id=None,
        room_number=None,
        payload=payload,
        close_session=lambda: table_session_repo.close_session_by_id(
            db,
            session.session_id,
            restaurant_id,
        ),
    )


def settle_room_session(
    db: Session,
    lookup: str,
    restaurant_id: int,
    payload: SettleSessionRequest,
) -> SettleSessionResponse:
    session = _load_room_session_or_404(db, lookup, restaurant_id)
    return _settle_context_session(
        db,
        context_type=BillContextType.room,
        session_id=session.session_id,
        restaurant_id=restaurant_id,
        table_number=None,
        room_id=session.room_id,
        room_number=session.room_number_snapshot,
        payload=payload,
        close_session=lambda: room_session_repo.close_session_by_id(
            db,
            session_id=session.session_id,
            restaurant_id=restaurant_id,
        ),
    )


def get_session_billing_status(
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> SessionBillingStatusResponse:
    session = _load_table_session_or_404(db, session_id, restaurant_id)
    return _build_status_response(
        db,
        context_type=BillContextType.table,
        session_id=session.session_id,
        restaurant_id=restaurant_id,
        table_number=session.table_number,
        room_id=None,
        room_number=None,
        session_is_active=session.is_active,
    )


def get_room_billing_status(
    db: Session,
    lookup: str,
    restaurant_id: int,
) -> SessionBillingStatusResponse:
    session = _load_room_session_or_404(db, lookup, restaurant_id)
    return _build_status_response(
        db,
        context_type=BillContextType.room,
        session_id=session.session_id,
        restaurant_id=restaurant_id,
        table_number=None,
        room_id=session.room_id,
        room_number=session.room_number_snapshot,
        session_is_active=session.is_active,
    )


def list_session_payments(
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> SessionPaymentHistoryResponse:
    session = _load_table_session_or_404(db, session_id, restaurant_id)
    return _build_payment_history_response(
        db,
        context_type=BillContextType.table,
        session_id=session.session_id,
        restaurant_id=restaurant_id,
        table_number=session.table_number,
        room_id=None,
        room_number=None,
    )


def list_room_session_payments(
    db: Session,
    lookup: str,
    restaurant_id: int,
) -> SessionPaymentHistoryResponse:
    session = _load_room_session_or_404(db, lookup, restaurant_id)
    return _build_payment_history_response(
        db,
        context_type=BillContextType.room,
        session_id=session.session_id,
        restaurant_id=restaurant_id,
        table_number=None,
        room_id=session.room_id,
        room_number=session.room_number_snapshot,
    )


def list_folios(
    db: Session,
    *,
    restaurant_id: int,
    context_type: BillContextType | None = None,
    handoff_status: BillHandoffStatus | None = None,
    limit: int = 100,
) -> BillListResponse:
    bills = billing_repo.list_bills(
        db,
        restaurant_id=restaurant_id,
        context_type=context_type,
        handoff_status=handoff_status,
        limit=limit,
    )
    return BillListResponse(
        items=[_to_bill_record(bill) for bill in bills],
        total=len(bills),
    )


def send_room_folio_to_cashier(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
) -> BillRecordResponse:
    bill = _load_room_bill_or_404(db, bill_id, restaurant_id)
    if bill.handoff_status != BillHandoffStatus.none:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This room folio has already entered the handoff workflow.",
        )
    billing_repo.update_handoff_status(
        db,
        bill=bill,
        handoff_status=BillHandoffStatus.sent_to_cashier,
    )
    db.commit()
    db.refresh(bill)
    return _to_bill_record(bill)


def send_room_folio_to_accountant(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
) -> BillRecordResponse:
    bill = _load_room_bill_or_404(db, bill_id, restaurant_id)
    if bill.handoff_status != BillHandoffStatus.sent_to_cashier:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This room folio must be in the cashier queue before sending to accountant.",
        )
    billing_repo.update_handoff_status(
        db,
        bill=bill,
        handoff_status=BillHandoffStatus.sent_to_accountant,
    )
    db.commit()
    db.refresh(bill)
    return _to_bill_record(bill)


def complete_room_folio_handoff(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
) -> BillRecordResponse:
    bill = _load_room_bill_or_404(db, bill_id, restaurant_id)
    if bill.handoff_status != BillHandoffStatus.sent_to_accountant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only accountant-ready room folios can be marked complete.",
        )
    billing_repo.update_handoff_status(
        db,
        bill=bill,
        handoff_status=BillHandoffStatus.completed,
    )
    db.commit()
    db.refresh(bill)
    return _to_bill_record(bill)
