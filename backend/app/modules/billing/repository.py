"""Repository layer for bills, folio workflow state, and audit events."""
from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.modules.billing.model import (
    Bill,
    BillContextType,
    BillHandoffStatus,
    BillReviewStatus,
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
