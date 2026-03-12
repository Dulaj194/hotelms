"""Repository layer for bills.

All methods are restaurant- and session-scoped.
The unique constraint (session_id, restaurant_id) on bills is the primary
guard against duplicate settlement attempts.
"""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.billing.model import Bill, BillStatus


def get_bill_by_session(
    db: Session, session_id: str, restaurant_id: int
) -> Bill | None:
    """Return the existing bill for a session, or None."""
    return (
        db.query(Bill)
        .filter(
            Bill.session_id == session_id,
            Bill.restaurant_id == restaurant_id,
        )
        .first()
    )


def create_bill(
    db: Session,
    *,
    restaurant_id: int,
    session_id: str,
    table_number: str,
    subtotal_amount: float,
    tax_amount: float,
    discount_amount: float,
    total_amount: float,
    payment_method: str,
    transaction_reference: str | None,
    notes: str | None,
) -> Bill:
    """Create a new bill record (starts as pending, settled separately)."""
    bill = Bill(
        restaurant_id=restaurant_id,
        session_id=session_id,
        table_number=table_number,
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


def mark_bill_paid(db: Session, bill: Bill, settled_at: datetime | None = None) -> Bill:
    """Mark bill as paid and record settled_at timestamp."""
    bill.payment_status = BillStatus.paid
    bill.settled_at = settled_at or datetime.now(UTC)
    db.flush()
    return bill
