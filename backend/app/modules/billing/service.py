"""Billing service for table settlements, room folios, and workflow dashboards."""
from __future__ import annotations

import json
from datetime import UTC, date, datetime, time
from typing import Any

import redis as redis_lib
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.billing import repository as billing_repo
from app.modules.billing.model import (
    Bill,
    BillContextType,
    BillHandoffStatus,
    BillReviewStatus,
    BillStatus,
    BillWorkflowEvent,
)
from app.modules.billing.schemas import (
    BillDetailResponse,
    BillListResponse,
    BillOrderItemResponse,
    BillOrderResponse,
    BillRecordResponse,
    BillingActorResponse,
    BillingQueueSummaryResponse,
    BillingReconciliationPaymentMethodResponse,
    BillingReconciliationResponse,
    BillSummaryResponse,
    BillWorkflowEventListResponse,
    BillWorkflowEventResponse,
    SessionBillingStatusResponse,
    SessionPaymentHistoryResponse,
    SettleSessionRequest,
    SettleSessionResponse,
)
from app.modules.orders import repository as order_repo
from app.modules.orders.model import OrderStatus
from app.modules.payments import repository as payment_repo
from app.modules.payments.schemas import PaymentResponse
from app.modules.realtime.repository import get_billing_channel, publish_global_event
from app.modules.room_sessions import repository as room_session_repo
from app.modules.table_sessions import repository as table_session_repo
from app.modules.users.model import User

_RECENT_COMPLETED_LIMIT = 10
_EVENT_LIMIT = 200


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_note(note: str | None) -> str | None:
    if note is None:
        return None
    normalized = note.strip()
    return normalized or None


def _actor_role(current_user: object | None) -> str | None:
    role_obj = getattr(current_user, "role", None)
    if role_obj is None:
        return None
    return role_obj.value if hasattr(role_obj, "value") else str(role_obj)


def _actor_user_id(current_user: object | None) -> int | None:
    value = getattr(current_user, "id", None)
    return int(value) if isinstance(value, int) else None


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
        cashier_status=bill.cashier_status,
        accountant_status=bill.accountant_status,
        printed_count=bill.printed_count,
        last_printed_at=bill.last_printed_at,
        reopened_count=bill.reopened_count,
    )


def _build_bill_order_response(order: object) -> BillOrderResponse:
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


def _load_user_map(db: Session, user_ids: set[int]) -> dict[int, User]:
    if not user_ids:
        return {}
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    return {user.id: user for user in users}


def _parse_event_metadata(event: BillWorkflowEvent) -> dict[str, Any] | None:
    if not event.metadata_json:
        return None
    try:
        parsed = json.loads(event.metadata_json)
    except json.JSONDecodeError:
        return {"raw": event.metadata_json}
    if isinstance(parsed, dict):
        return parsed
    return {"value": parsed}


def _serialize_workflow_event(
    event: BillWorkflowEvent,
    bill: Bill,
    users_by_id: dict[int, User],
) -> BillWorkflowEventResponse:
    actor_user = users_by_id.get(event.user_id or -1)
    actor_role = event.actor_role
    if actor_role is None and actor_user is not None:
        actor_role = actor_user.role.value if hasattr(actor_user.role, "value") else str(actor_user.role)

    return BillWorkflowEventResponse(
        id=event.id,
        bill_id=bill.id,
        bill_number=bill.bill_number,
        context_type=bill.context_type,
        session_id=bill.session_id,
        table_number=bill.table_number,
        room_number=bill.room_number,
        action_type=event.action_type,
        note=event.note,
        metadata=_parse_event_metadata(event),
        created_at=event.created_at,
        actor=BillingActorResponse(
            user_id=event.user_id,
            full_name=actor_user.full_name if actor_user is not None else None,
            role=actor_role,
        ),
    )


def _serialize_workflow_events(
    db: Session,
    events: list[BillWorkflowEvent],
) -> list[BillWorkflowEventResponse]:
    if not events:
        return []

    bill_ids = {event.bill_id for event in events}
    bills = db.query(Bill).filter(Bill.id.in_(bill_ids)).all()
    bills_by_id = {bill.id: bill for bill in bills}
    users_by_id = _load_user_map(
        db,
        {event.user_id for event in events if event.user_id is not None},
    )

    responses: list[BillWorkflowEventResponse] = []
    for event in events:
        bill = bills_by_id.get(event.bill_id)
        if bill is None:
            continue
        responses.append(_serialize_workflow_event(event, bill, users_by_id))
    return responses


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

    if is_settled and existing_bill is not None:
        relevant_orders = order_repo.list_orders_by_session(
            db,
            session_id,
            restaurant_id,
            statuses=[OrderStatus.paid],
        )
        grand_total = float(existing_bill.total_amount)
    else:
        relevant_orders = order_repo.list_billable_orders_by_session(db, session_id, restaurant_id)
        grand_total = sum(float(order.total_amount) for order in relevant_orders)

    return SessionBillingStatusResponse(
        context_type=context_type,
        session_id=session_id,
        table_number=table_number,
        room_id=room_id,
        room_number=room_number,
        is_active=session_is_active,
        is_settled=is_settled,
        billable_order_count=len(relevant_orders),
        grand_total=round(grand_total, 2),
        handoff_status=existing_bill.handoff_status if existing_bill is not None else None,
    )


def _load_room_bill_or_404(
    db: Session,
    bill_id: int,
    restaurant_id: int,
    *,
    require_settled: bool = True,
) -> Bill:
    bill = billing_repo.get_bill_by_id(db, bill_id, restaurant_id)
    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folio not found.",
        )
    if bill.context_type != BillContextType.room:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only room folios support this workflow.",
        )
    if require_settled and bill.payment_status != BillStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only settled room folios can enter the workflow.",
        )
    return bill


def _load_bill_or_404(
    db: Session,
    bill_id: int,
    restaurant_id: int,
) -> Bill:
    bill = billing_repo.get_bill_by_id(db, bill_id, restaurant_id)
    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bill not found.",
        )
    return bill


def _record_bill_event(
    db: Session,
    *,
    bill: Bill,
    action_type: str,
    current_user: object | None = None,
    note: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> BillWorkflowEvent:
    return billing_repo.create_workflow_event(
        db,
        bill_id=bill.id,
        restaurant_id=bill.restaurant_id,
        user_id=_actor_user_id(current_user),
        actor_role=_actor_role(current_user),
        action_type=action_type,
        note=_normalize_note(note),
        metadata=metadata,
    )


def _day_bounds(business_date: date | None) -> tuple[datetime, datetime]:
    target_date = business_date or _utcnow().date()
    start_dt = datetime.combine(target_date, time.min, tzinfo=UTC)
    end_dt = datetime.combine(target_date, time.max, tzinfo=UTC)
    return start_dt, end_dt


def _count_room_folios(
    db: Session,
    *,
    restaurant_id: int,
    handoff_status: BillHandoffStatus | None = None,
    cashier_status: BillReviewStatus | None = None,
    accountant_status: BillReviewStatus | None = None,
    settled_to: datetime | None = None,
) -> int:
    query = db.query(Bill).filter(
        Bill.restaurant_id == restaurant_id,
        Bill.context_type == BillContextType.room,
        Bill.payment_status == BillStatus.paid,
    )
    if handoff_status is not None:
        query = query.filter(Bill.handoff_status == handoff_status)
    if cashier_status is not None:
        query = query.filter(Bill.cashier_status == cashier_status)
    if accountant_status is not None:
        query = query.filter(Bill.accountant_status == accountant_status)
    if settled_to is not None:
        query = query.filter(Bill.settled_at <= settled_to)
    return query.count()


def _count_workflow_actions(
    db: Session,
    *,
    restaurant_id: int,
    action_types: tuple[str, ...],
    created_from: datetime,
    created_to: datetime,
) -> int:
    return (
        db.query(BillWorkflowEvent)
        .filter(
            BillWorkflowEvent.restaurant_id == restaurant_id,
            BillWorkflowEvent.action_type.in_(action_types),
            BillWorkflowEvent.created_at >= created_from,
            BillWorkflowEvent.created_at <= created_to,
        )
        .count()
    )


def _build_queue_summary(
    db: Session,
    *,
    restaurant_id: int,
) -> BillingQueueSummaryResponse:
    start_dt, end_dt = _day_bounds(None)
    return BillingQueueSummaryResponse(
        fresh_count=_count_room_folios(
            db,
            restaurant_id=restaurant_id,
            handoff_status=BillHandoffStatus.none,
        ),
        cashier_pending_count=_count_room_folios(
            db,
            restaurant_id=restaurant_id,
            handoff_status=BillHandoffStatus.sent_to_cashier,
            cashier_status=BillReviewStatus.pending,
        ),
        cashier_accepted_count=_count_room_folios(
            db,
            restaurant_id=restaurant_id,
            handoff_status=BillHandoffStatus.sent_to_cashier,
            cashier_status=BillReviewStatus.accepted,
        ),
        accountant_pending_count=_count_room_folios(
            db,
            restaurant_id=restaurant_id,
            handoff_status=BillHandoffStatus.sent_to_accountant,
            accountant_status=BillReviewStatus.pending,
        ),
        completed_count=_count_room_folios(
            db,
            restaurant_id=restaurant_id,
            handoff_status=BillHandoffStatus.completed,
        ),
        printed_today_count=_count_workflow_actions(
            db,
            restaurant_id=restaurant_id,
            action_types=("printed",),
            created_from=start_dt,
            created_to=end_dt,
        ),
        rejected_today_count=_count_workflow_actions(
            db,
            restaurant_id=restaurant_id,
            action_types=("cashier_rejected", "accountant_rejected"),
            created_from=start_dt,
            created_to=end_dt,
        ),
        reopened_today_count=_count_workflow_actions(
            db,
            restaurant_id=restaurant_id,
            action_types=("reopened",),
            created_from=start_dt,
            created_to=end_dt,
        ),
        room_folio_total=_count_room_folios(db, restaurant_id=restaurant_id),
    )


def _publish_billing_event(
    db: Session,
    *,
    restaurant_id: int,
    r: redis_lib.Redis | None,
    action_type: str,
    bill: Bill | None = None,
) -> None:
    if r is None or not hasattr(r, "publish"):
        return

    payload: dict[str, Any] = {
        "event": "billing_folio_updated",
        "restaurant_id": restaurant_id,
        "action": action_type,
        "occurred_at": _utcnow(),
        "summary": _build_queue_summary(db, restaurant_id=restaurant_id).model_dump(),
    }
    if bill is not None:
        payload["bill"] = {
            "id": bill.id,
            "bill_number": bill.bill_number,
            "context_type": bill.context_type.value,
            "session_id": bill.session_id,
            "table_number": bill.table_number,
            "room_id": bill.room_id,
            "room_number": bill.room_number,
            "total_amount": float(bill.total_amount),
            "payment_method": bill.payment_method,
            "payment_status": bill.payment_status.value,
            "handoff_status": bill.handoff_status.value,
            "cashier_status": bill.cashier_status.value,
            "accountant_status": bill.accountant_status.value,
            "printed_count": bill.printed_count,
            "reopened_count": bill.reopened_count,
            "settled_at": bill.settled_at,
            "sent_to_cashier_at": bill.sent_to_cashier_at,
            "sent_to_accountant_at": bill.sent_to_accountant_at,
            "handoff_completed_at": bill.handoff_completed_at,
            "last_printed_at": bill.last_printed_at,
        }
    try:
        publish_global_event(r, get_billing_channel(restaurant_id), payload)
    except Exception:
        return


def _commit_bill_workflow(
    db: Session,
    *,
    bill: Bill,
    restaurant_id: int,
    r: redis_lib.Redis | None,
    action_type: str,
) -> BillRecordResponse:
    db.commit()
    db.refresh(bill)
    _publish_billing_event(
        db,
        restaurant_id=restaurant_id,
        r=r,
        action_type=action_type,
        bill=bill,
    )
    return _to_bill_record(bill)


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
    current_user: object | None = None,
    r: redis_lib.Redis | None = None,
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
    settled_at = _utcnow()
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
        _record_bill_event(
            db,
            bill=bill,
            action_type="settled",
            current_user=current_user,
            note=payload.notes,
            metadata={
                "payment_method": payload.payment_method,
                "transaction_reference": payload.transaction_reference,
                "order_count": len(order_ids),
                "total_amount": round(total_amount, 2),
            },
        )
        close_session()
        db.commit()
        db.refresh(bill)
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

    _publish_billing_event(
        db,
        restaurant_id=restaurant_id,
        r=r,
        action_type="settled",
        bill=bill,
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
    *,
    current_user: object | None = None,
    r: redis_lib.Redis | None = None,
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
        current_user=current_user,
        r=r,
    )


def settle_room_session(
    db: Session,
    lookup: str,
    restaurant_id: int,
    payload: SettleSessionRequest,
    *,
    current_user: object | None = None,
    r: redis_lib.Redis | None = None,
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
        current_user=current_user,
        r=r,
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
    cashier_status: BillReviewStatus | None = None,
    accountant_status: BillReviewStatus | None = None,
    search: str | None = None,
    settled_from: date | None = None,
    settled_to: date | None = None,
    limit: int = 100,
    offset: int = 0,
) -> BillListResponse:
    settled_from_dt = _day_bounds(settled_from)[0] if settled_from is not None else None
    settled_to_dt = _day_bounds(settled_to)[1] if settled_to is not None else None
    bills, total = billing_repo.list_bills(
        db,
        restaurant_id=restaurant_id,
        context_type=context_type,
        handoff_status=handoff_status,
        cashier_status=cashier_status,
        accountant_status=accountant_status,
        search=search,
        settled_from=settled_from_dt,
        settled_to=settled_to_dt,
        limit=limit,
        offset=offset,
    )
    return BillListResponse(
        items=[_to_bill_record(bill) for bill in bills],
        total=total,
    )


def get_folio_detail(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
) -> BillDetailResponse:
    bill = _load_bill_or_404(db, bill_id, restaurant_id)
    if bill.context_type == BillContextType.room:
        session = room_session_repo.get_room_session_by_id_and_restaurant(db, bill.session_id, restaurant_id)
        summary = _build_summary_response(
            db,
            context_type=bill.context_type,
            session_id=bill.session_id,
            restaurant_id=restaurant_id,
            table_number=None,
            room_id=bill.room_id,
            room_number=bill.room_number,
            session_is_active=session.is_active if session is not None else False,
        )
    else:
        session = table_session_repo.get_session_by_id_and_restaurant(db, bill.session_id, restaurant_id)
        summary = _build_summary_response(
            db,
            context_type=bill.context_type,
            session_id=bill.session_id,
            restaurant_id=restaurant_id,
            table_number=bill.table_number,
            room_id=None,
            room_number=None,
            session_is_active=session.is_active if session is not None else False,
        )

    payments = payment_repo.list_payments_by_session(db, bill.session_id, restaurant_id)
    workflow_events, _ = billing_repo.list_workflow_events(
        db,
        restaurant_id=restaurant_id,
        bill_id=bill.id,
        limit=_EVENT_LIMIT,
    )
    return BillDetailResponse(
        **summary.model_dump(),
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
        payment_count=len(payments),
        events=_serialize_workflow_events(db, workflow_events),
    )


def list_bill_workflow_events(
    db: Session,
    *,
    restaurant_id: int,
    bill_id: int | None = None,
    action_type: str | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    limit: int = 100,
    offset: int = 0,
) -> BillWorkflowEventListResponse:
    created_from_dt = _day_bounds(created_from)[0] if created_from is not None else None
    created_to_dt = _day_bounds(created_to)[1] if created_to is not None else None
    events, total = billing_repo.list_workflow_events(
        db,
        restaurant_id=restaurant_id,
        bill_id=bill_id,
        action_type=action_type,
        created_from=created_from_dt,
        created_to=created_to_dt,
        limit=limit,
        offset=offset,
    )
    return BillWorkflowEventListResponse(
        items=_serialize_workflow_events(db, events),
        total=total,
    )


def record_bill_print(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    current_user: object | None = None,
    note: str | None = None,
    r: redis_lib.Redis | None = None,
) -> BillRecordResponse:
    bill = _load_bill_or_404(db, bill_id, restaurant_id)
    if bill.payment_status != BillStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only settled bills can be printed.",
        )

    printed_at = _utcnow()
    billing_repo.update_bill_fields(
        db,
        bill=bill,
        printed_count=bill.printed_count + 1,
        last_printed_at=printed_at,
    )
    _record_bill_event(
        db,
        bill=bill,
        action_type="printed",
        current_user=current_user,
        note=note,
        metadata={"printed_count": bill.printed_count},
    )
    return _commit_bill_workflow(
        db,
        bill=bill,
        restaurant_id=restaurant_id,
        r=r,
        action_type="printed",
    )


def send_room_folio_to_cashier(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    current_user: object | None = None,
    note: str | None = None,
    r: redis_lib.Redis | None = None,
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
    billing_repo.update_bill_fields(
        db,
        bill=bill,
        cashier_status=BillReviewStatus.pending,
        accountant_status=BillReviewStatus.not_sent,
        sent_to_accountant_at=None,
        handoff_completed_at=None,
    )
    _record_bill_event(
        db,
        bill=bill,
        action_type="sent_to_cashier",
        current_user=current_user,
        note=note,
    )
    return _commit_bill_workflow(
        db,
        bill=bill,
        restaurant_id=restaurant_id,
        r=r,
        action_type="sent_to_cashier",
    )


def accept_cashier_folio(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    current_user: object | None = None,
    note: str | None = None,
    r: redis_lib.Redis | None = None,
) -> BillRecordResponse:
    bill = _load_room_bill_or_404(db, bill_id, restaurant_id)
    if bill.handoff_status != BillHandoffStatus.sent_to_cashier:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This folio is not waiting in the cashier queue.",
        )
    if bill.cashier_status == BillReviewStatus.accepted:
        return _to_bill_record(bill)
    if bill.cashier_status != BillReviewStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This folio must be pending cashier review before acceptance.",
        )

    billing_repo.update_bill_fields(
        db,
        bill=bill,
        cashier_status=BillReviewStatus.accepted,
    )
    _record_bill_event(
        db,
        bill=bill,
        action_type="cashier_accepted",
        current_user=current_user,
        note=note,
    )
    return _commit_bill_workflow(
        db,
        bill=bill,
        restaurant_id=restaurant_id,
        r=r,
        action_type="cashier_accepted",
    )


def reject_cashier_folio(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    current_user: object | None = None,
    note: str | None = None,
    r: redis_lib.Redis | None = None,
) -> BillRecordResponse:
    bill = _load_room_bill_or_404(db, bill_id, restaurant_id)
    if bill.handoff_status != BillHandoffStatus.sent_to_cashier:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This folio is not waiting in the cashier queue.",
        )

    billing_repo.update_handoff_status(
        db,
        bill=bill,
        handoff_status=BillHandoffStatus.none,
    )
    billing_repo.update_bill_fields(
        db,
        bill=bill,
        cashier_status=BillReviewStatus.rejected,
        accountant_status=BillReviewStatus.not_sent,
        sent_to_accountant_at=None,
        handoff_completed_at=None,
    )
    _record_bill_event(
        db,
        bill=bill,
        action_type="cashier_rejected",
        current_user=current_user,
        note=note,
    )
    return _commit_bill_workflow(
        db,
        bill=bill,
        restaurant_id=restaurant_id,
        r=r,
        action_type="cashier_rejected",
    )


def send_room_folio_to_accountant(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    current_user: object | None = None,
    note: str | None = None,
    r: redis_lib.Redis | None = None,
) -> BillRecordResponse:
    bill = _load_room_bill_or_404(db, bill_id, restaurant_id)
    if bill.handoff_status != BillHandoffStatus.sent_to_cashier:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This room folio must be in the cashier queue before sending to accountant.",
        )

    if bill.cashier_status == BillReviewStatus.pending:
        billing_repo.update_bill_fields(
            db,
            bill=bill,
            cashier_status=BillReviewStatus.accepted,
        )
    elif bill.cashier_status != BillReviewStatus.accepted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cashier review must be accepted before accountant handoff.",
        )

    billing_repo.update_handoff_status(
        db,
        bill=bill,
        handoff_status=BillHandoffStatus.sent_to_accountant,
    )
    billing_repo.update_bill_fields(
        db,
        bill=bill,
        accountant_status=BillReviewStatus.pending,
        handoff_completed_at=None,
    )
    _record_bill_event(
        db,
        bill=bill,
        action_type="sent_to_accountant",
        current_user=current_user,
        note=note,
    )
    return _commit_bill_workflow(
        db,
        bill=bill,
        restaurant_id=restaurant_id,
        r=r,
        action_type="sent_to_accountant",
    )


def accept_accountant_folio(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    current_user: object | None = None,
    note: str | None = None,
    r: redis_lib.Redis | None = None,
) -> BillRecordResponse:
    bill = _load_room_bill_or_404(db, bill_id, restaurant_id)
    if bill.handoff_status != BillHandoffStatus.sent_to_accountant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This folio is not waiting in the accountant queue.",
        )
    if bill.accountant_status not in {BillReviewStatus.pending, BillReviewStatus.accepted}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This folio must be pending accountant review before acceptance.",
        )

    billing_repo.update_bill_fields(
        db,
        bill=bill,
        accountant_status=BillReviewStatus.accepted,
    )
    billing_repo.update_handoff_status(
        db,
        bill=bill,
        handoff_status=BillHandoffStatus.completed,
    )
    _record_bill_event(
        db,
        bill=bill,
        action_type="accountant_accepted",
        current_user=current_user,
        note=note,
    )
    return _commit_bill_workflow(
        db,
        bill=bill,
        restaurant_id=restaurant_id,
        r=r,
        action_type="accountant_accepted",
    )


def reject_accountant_folio(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    current_user: object | None = None,
    note: str | None = None,
    r: redis_lib.Redis | None = None,
) -> BillRecordResponse:
    bill = _load_room_bill_or_404(db, bill_id, restaurant_id)
    if bill.handoff_status != BillHandoffStatus.sent_to_accountant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This folio is not waiting in the accountant queue.",
        )

    billing_repo.update_handoff_status(
        db,
        bill=bill,
        handoff_status=BillHandoffStatus.sent_to_cashier,
    )
    billing_repo.update_bill_fields(
        db,
        bill=bill,
        accountant_status=BillReviewStatus.rejected,
        cashier_status=BillReviewStatus.accepted,
        handoff_completed_at=None,
    )
    _record_bill_event(
        db,
        bill=bill,
        action_type="accountant_rejected",
        current_user=current_user,
        note=note,
    )
    return _commit_bill_workflow(
        db,
        bill=bill,
        restaurant_id=restaurant_id,
        r=r,
        action_type="accountant_rejected",
    )


def complete_room_folio_handoff(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    current_user: object | None = None,
    note: str | None = None,
    r: redis_lib.Redis | None = None,
) -> BillRecordResponse:
    bill = _load_room_bill_or_404(db, bill_id, restaurant_id)
    if bill.handoff_status != BillHandoffStatus.sent_to_accountant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only accountant-ready room folios can be marked complete.",
        )

    if bill.accountant_status == BillReviewStatus.pending:
        billing_repo.update_bill_fields(
            db,
            bill=bill,
            accountant_status=BillReviewStatus.accepted,
        )
    elif bill.accountant_status not in {BillReviewStatus.accepted, BillReviewStatus.pending}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This folio must be pending accountant review before completion.",
        )

    billing_repo.update_handoff_status(
        db,
        bill=bill,
        handoff_status=BillHandoffStatus.completed,
    )
    _record_bill_event(
        db,
        bill=bill,
        action_type="accountant_accepted",
        current_user=current_user,
        note=note,
    )
    return _commit_bill_workflow(
        db,
        bill=bill,
        restaurant_id=restaurant_id,
        r=r,
        action_type="accountant_accepted",
    )


def reopen_room_folio(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    current_user: object | None = None,
    note: str | None = None,
    r: redis_lib.Redis | None = None,
) -> BillRecordResponse:
    bill = _load_room_bill_or_404(db, bill_id, restaurant_id)
    billing_repo.update_handoff_status(
        db,
        bill=bill,
        handoff_status=BillHandoffStatus.none,
    )
    billing_repo.update_bill_fields(
        db,
        bill=bill,
        cashier_status=BillReviewStatus.not_sent,
        accountant_status=BillReviewStatus.not_sent,
        sent_to_cashier_at=None,
        sent_to_accountant_at=None,
        handoff_completed_at=None,
        reopened_count=bill.reopened_count + 1,
    )
    _record_bill_event(
        db,
        bill=bill,
        action_type="reopened",
        current_user=current_user,
        note=note,
        metadata={"reopened_count": bill.reopened_count},
    )
    return _commit_bill_workflow(
        db,
        bill=bill,
        restaurant_id=restaurant_id,
        r=r,
        action_type="reopened",
    )


def get_billing_queue_summary(
    db: Session,
    *,
    restaurant_id: int,
) -> BillingQueueSummaryResponse:
    return _build_queue_summary(db, restaurant_id=restaurant_id)


def get_daily_reconciliation(
    db: Session,
    *,
    restaurant_id: int,
    business_date: date | None = None,
) -> BillingReconciliationResponse:
    start_dt, end_dt = _day_bounds(business_date)
    target_date = business_date or start_dt.date()

    paid_bills = (
        db.query(Bill)
        .filter(
            Bill.restaurant_id == restaurant_id,
            Bill.payment_status == BillStatus.paid,
            Bill.settled_at >= start_dt,
            Bill.settled_at <= end_dt,
        )
        .order_by(Bill.settled_at.desc(), Bill.id.desc())
        .all()
    )

    payment_method_rows = (
        db.query(
            Bill.payment_method,
            func.count(Bill.id),
            func.coalesce(func.sum(Bill.total_amount), 0),
        )
        .filter(
            Bill.restaurant_id == restaurant_id,
            Bill.payment_status == BillStatus.paid,
            Bill.settled_at >= start_dt,
            Bill.settled_at <= end_dt,
        )
        .group_by(Bill.payment_method)
        .order_by(func.coalesce(func.sum(Bill.total_amount), 0).desc())
        .all()
    )

    recent_completed = (
        db.query(Bill)
        .filter(
            Bill.restaurant_id == restaurant_id,
            Bill.context_type == BillContextType.room,
            Bill.handoff_status == BillHandoffStatus.completed,
            Bill.handoff_completed_at >= start_dt,
            Bill.handoff_completed_at <= end_dt,
        )
        .order_by(Bill.handoff_completed_at.desc(), Bill.id.desc())
        .limit(_RECENT_COMPLETED_LIMIT)
        .all()
    )

    total_paid_amount = sum(float(bill.total_amount) for bill in paid_bills)
    room_paid_amount = sum(
        float(bill.total_amount) for bill in paid_bills if bill.context_type == BillContextType.room
    )
    table_paid_amount = sum(
        float(bill.total_amount) for bill in paid_bills if bill.context_type == BillContextType.table
    )

    return BillingReconciliationResponse(
        business_date=target_date,
        total_paid_bills=len(paid_bills),
        total_paid_amount=round(total_paid_amount, 2),
        room_paid_amount=round(room_paid_amount, 2),
        table_paid_amount=round(table_paid_amount, 2),
        completed_room_folios=(
            db.query(Bill)
            .filter(
                Bill.restaurant_id == restaurant_id,
                Bill.context_type == BillContextType.room,
                Bill.handoff_status == BillHandoffStatus.completed,
                Bill.handoff_completed_at >= start_dt,
                Bill.handoff_completed_at <= end_dt,
            )
            .count()
        ),
        outstanding_cashier_folios=(
            db.query(Bill)
            .filter(
                Bill.restaurant_id == restaurant_id,
                Bill.context_type == BillContextType.room,
                Bill.payment_status == BillStatus.paid,
                Bill.settled_at <= end_dt,
                Bill.handoff_status.in_(
                    [BillHandoffStatus.none, BillHandoffStatus.sent_to_cashier],
                ),
            )
            .count()
        ),
        outstanding_accountant_folios=(
            db.query(Bill)
            .filter(
                Bill.restaurant_id == restaurant_id,
                Bill.context_type == BillContextType.room,
                Bill.payment_status == BillStatus.paid,
                Bill.settled_at <= end_dt,
                Bill.handoff_status == BillHandoffStatus.sent_to_accountant,
            )
            .count()
        ),
        printed_today_count=_count_workflow_actions(
            db,
            restaurant_id=restaurant_id,
            action_types=("printed",),
            created_from=start_dt,
            created_to=end_dt,
        ),
        reopened_today_count=_count_workflow_actions(
            db,
            restaurant_id=restaurant_id,
            action_types=("reopened",),
            created_from=start_dt,
            created_to=end_dt,
        ),
        payment_methods=[
            BillingReconciliationPaymentMethodResponse(
                payment_method=payment_method or "unspecified",
                folio_count=int(count),
                total_amount=round(float(amount or 0), 2),
            )
            for payment_method, count, amount in payment_method_rows
        ],
        recent_completed=[_to_bill_record(bill) for bill in recent_completed],
    )
