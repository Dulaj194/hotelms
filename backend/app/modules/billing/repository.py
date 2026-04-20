"""Repository layer for bills, folio workflow state, and audit events."""
from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.modules.billing.model import (
    Bill,
    BillContextType,
    BillHandoffStatus,
    BillPaymentAllocation,
    BillPaymentAllocationStatus,
    BillReviewStatus,
    BillSettleIdempotencyKey,
    BillSettleIdempotencyStatus,
    BillStatus,
    BillWorkflowEvent,
)


def get_bill_by_session(
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> Bill | None:
    return (
        db.query(Bill)
        .filter(
            Bill.session_id == session_id,
            Bill.restaurant_id == restaurant_id,
        )
        .first()
    )


def get_bill_by_id(
    db: Session,
    bill_id: int,
    restaurant_id: int,
) -> Bill | None:
    return (
        db.query(Bill)
        .filter(
            Bill.id == bill_id,
            Bill.restaurant_id == restaurant_id,
        )
        .first()
    )


def create_bill(
    db: Session,
    *,
    restaurant_id: int,
    session_id: str,
    context_type: BillContextType,
    table_number: str | None,
    room_id: int | None,
    room_number: str | None,
    subtotal_amount: float,
    tax_amount: float,
    discount_amount: float,
    total_amount: float,
    payment_method: str,
    transaction_reference: str | None,
    notes: str | None,
) -> Bill:
    bill = Bill(
        restaurant_id=restaurant_id,
        session_id=session_id,
        context_type=context_type,
        table_number=table_number,
        room_id=room_id,
        room_number=room_number,
        subtotal_amount=round(subtotal_amount, 2),
        tax_amount=round(tax_amount, 2),
        discount_amount=round(discount_amount, 2),
        total_amount=round(total_amount, 2),
        payment_method=payment_method,
        payment_status=BillStatus.pending,
        transaction_reference=transaction_reference,
        notes=notes,
        cashier_status=BillReviewStatus.not_sent,
        accountant_status=BillReviewStatus.not_sent,
    )
    db.add(bill)
    db.flush()
    return bill


def mark_bill_paid(
    db: Session,
    bill: Bill,
    settled_at: datetime | None = None,
) -> Bill:
    bill.payment_status = BillStatus.paid
    bill.settled_at = settled_at or datetime.now(UTC)
    db.flush()
    return bill


def mark_bill_partially_paid(
    db: Session,
    bill: Bill,
) -> Bill:
    bill.payment_status = BillStatus.partially_paid
    db.flush()
    return bill


def list_bills(
    db: Session,
    *,
    restaurant_id: int,
    context_type: BillContextType | None = None,
    handoff_status: BillHandoffStatus | None = None,
    cashier_status: BillReviewStatus | None = None,
    accountant_status: BillReviewStatus | None = None,
    search: str | None = None,
    settled_from: datetime | None = None,
    settled_to: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[Bill], int]:
    query = db.query(Bill).filter(Bill.restaurant_id == restaurant_id)
    if context_type is not None:
        query = query.filter(Bill.context_type == context_type)
    if handoff_status is not None:
        query = query.filter(Bill.handoff_status == handoff_status)
    if cashier_status is not None:
        query = query.filter(Bill.cashier_status == cashier_status)
    if accountant_status is not None:
        query = query.filter(Bill.accountant_status == accountant_status)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Bill.bill_number.ilike(pattern),
                Bill.session_id.ilike(pattern),
                Bill.table_number.ilike(pattern),
                Bill.room_number.ilike(pattern),
                Bill.transaction_reference.ilike(pattern),
                Bill.notes.ilike(pattern),
            )
        )
    if settled_from is not None:
        query = query.filter(Bill.settled_at >= settled_from)
    if settled_to is not None:
        query = query.filter(Bill.settled_at <= settled_to)

    total = query.count()
    items = (
        query.order_by(Bill.settled_at.desc().nullslast(), Bill.created_at.desc(), Bill.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, total


def update_bill_fields(
    db: Session,
    *,
    bill: Bill,
    **fields,
) -> Bill:
    for field_name, value in fields.items():
        setattr(bill, field_name, value)
    db.flush()
    return bill


def update_handoff_status(
    db: Session,
    *,
    bill: Bill,
    handoff_status: BillHandoffStatus,
    changed_at: datetime | None = None,
) -> Bill:
    effective_changed_at = changed_at or datetime.now(UTC)
    bill.handoff_status = handoff_status

    if handoff_status == BillHandoffStatus.sent_to_cashier:
        bill.sent_to_cashier_at = effective_changed_at
    elif handoff_status == BillHandoffStatus.sent_to_accountant:
        bill.sent_to_accountant_at = effective_changed_at
    elif handoff_status == BillHandoffStatus.completed:
        bill.handoff_completed_at = effective_changed_at

    db.flush()
    return bill


def create_workflow_event(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    user_id: int | None,
    actor_role: str | None,
    action_type: str,
    note: str | None = None,
    metadata: dict | None = None,
) -> BillWorkflowEvent:
    event = BillWorkflowEvent(
        bill_id=bill_id,
        restaurant_id=restaurant_id,
        user_id=user_id,
        actor_role=actor_role,
        action_type=action_type,
        note=note,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(event)
    db.flush()
    return event


def create_bill_payment_allocation(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    payment_method: str,
    amount: float,
    transaction_reference: str | None = None,
    gateway_provider: str | None = None,
    gateway_payment_intent_id: str | None = None,
    notes: str | None = None,
) -> BillPaymentAllocation:
    allocation = BillPaymentAllocation(
        bill_id=bill_id,
        restaurant_id=restaurant_id,
        payment_method=payment_method,
        amount=round(amount, 2),
        transaction_reference=transaction_reference,
        gateway_provider=gateway_provider,
        gateway_payment_intent_id=gateway_payment_intent_id,
        allocation_status=BillPaymentAllocationStatus.captured,
        notes=notes,
    )
    db.add(allocation)
    db.flush()
    return allocation


def list_bill_payment_allocations(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
) -> list[BillPaymentAllocation]:
    return (
        db.query(BillPaymentAllocation)
        .filter(
            BillPaymentAllocation.bill_id == bill_id,
            BillPaymentAllocation.restaurant_id == restaurant_id,
        )
        .order_by(BillPaymentAllocation.created_at.asc(), BillPaymentAllocation.id.asc())
        .all()
    )


def sum_captured_allocation_amount(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
) -> float:
    value = (
        db.query(func.coalesce(func.sum(BillPaymentAllocation.amount), 0))
        .filter(
            BillPaymentAllocation.bill_id == bill_id,
            BillPaymentAllocation.restaurant_id == restaurant_id,
            BillPaymentAllocation.allocation_status == BillPaymentAllocationStatus.captured,
        )
        .scalar()
    )
    return round(float(value or 0), 2)


def mark_bill_payment_allocations_status(
    db: Session,
    *,
    bill_id: int,
    restaurant_id: int,
    allocation_status: BillPaymentAllocationStatus,
) -> None:
    allocations = (
        db.query(BillPaymentAllocation)
        .filter(
            BillPaymentAllocation.bill_id == bill_id,
            BillPaymentAllocation.restaurant_id == restaurant_id,
            BillPaymentAllocation.allocation_status == BillPaymentAllocationStatus.captured,
        )
        .all()
    )
    for allocation in allocations:
        allocation.allocation_status = allocation_status
    db.flush()


def get_settle_idempotency_key(
    db: Session,
    *,
    restaurant_id: int,
    operation: str,
    idempotency_key: str,
) -> BillSettleIdempotencyKey | None:
    return (
        db.query(BillSettleIdempotencyKey)
        .filter(
            BillSettleIdempotencyKey.restaurant_id == restaurant_id,
            BillSettleIdempotencyKey.operation == operation,
            BillSettleIdempotencyKey.idempotency_key == idempotency_key,
        )
        .first()
    )


def create_settle_idempotency_key(
    db: Session,
    *,
    restaurant_id: int,
    operation: str,
    idempotency_key: str,
    context_type: BillContextType,
    context_lookup: str,
    request_fingerprint: str,
) -> BillSettleIdempotencyKey:
    record = BillSettleIdempotencyKey(
        restaurant_id=restaurant_id,
        operation=operation,
        idempotency_key=idempotency_key,
        context_type=context_type,
        context_lookup=context_lookup,
        request_fingerprint=request_fingerprint,
        settle_status=BillSettleIdempotencyStatus.pending,
    )
    db.add(record)
    db.flush()
    return record


def update_settle_idempotency_key(
    db: Session,
    *,
    record: BillSettleIdempotencyKey,
    settle_status: BillSettleIdempotencyStatus,
    bill_id: int | None = None,
    last_error: str | None = None,
) -> BillSettleIdempotencyKey:
    record.settle_status = settle_status
    record.bill_id = bill_id
    record.last_error = last_error
    db.flush()
    return record


def list_workflow_events(
    db: Session,
    *,
    restaurant_id: int,
    bill_id: int | None = None,
    action_type: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[BillWorkflowEvent], int]:
    query = db.query(BillWorkflowEvent).filter(BillWorkflowEvent.restaurant_id == restaurant_id)
    if bill_id is not None:
        query = query.filter(BillWorkflowEvent.bill_id == bill_id)
    if action_type:
        query = query.filter(BillWorkflowEvent.action_type == action_type)
    if created_from is not None:
        query = query.filter(BillWorkflowEvent.created_at >= created_from)
    if created_to is not None:
        query = query.filter(BillWorkflowEvent.created_at <= created_to)

    total = query.count()
    items = (
        query.order_by(
            BillWorkflowEvent.created_at.desc(),
            BillWorkflowEvent.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, total
