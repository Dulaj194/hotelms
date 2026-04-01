"""Repository layer for bills / folios."""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.billing.model import (
    Bill,
    BillContextType,
    BillHandoffStatus,
    BillStatus,
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
    limit: int = 100,
) -> list[Bill]:
    query = db.query(Bill).filter(Bill.restaurant_id == restaurant_id)
    if context_type is not None:
        query = query.filter(Bill.context_type == context_type)
    if handoff_status is not None:
        query = query.filter(Bill.handoff_status == handoff_status)
    return (
        query.order_by(Bill.settled_at.desc().nullslast(), Bill.created_at.desc(), Bill.id.desc())
        .limit(limit)
        .all()
    )


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
