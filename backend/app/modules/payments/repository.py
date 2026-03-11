"""Repository layer for the payments table."""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.payments.model import Payment, PaymentStatus


def create_payment_record(
    db: Session,
    *,
    order_id: int,
    restaurant_id: int,
    amount: float,
    payment_method: str = "pending",
) -> Payment:
    """Create an initial pending payment record for a newly placed order."""
    payment = Payment(
        order_id=order_id,
        restaurant_id=restaurant_id,
        amount=round(amount, 2),
        payment_method=payment_method,
        payment_status=PaymentStatus.pending,
    )
    db.add(payment)
    db.flush()
    return payment


def get_payment_by_order(
    db: Session, order_id: int, restaurant_id: int
) -> Payment | None:
    return (
        db.query(Payment)
        .filter(Payment.order_id == order_id, Payment.restaurant_id == restaurant_id)
        .first()
    )


def mark_payment_paid(
    db: Session,
    payment: Payment,
    transaction_reference: str | None = None,
) -> Payment:
    payment.payment_status = PaymentStatus.paid
    payment.paid_at = datetime.now(UTC)
    if transaction_reference:
        payment.transaction_reference = transaction_reference
    db.flush()
    return payment
