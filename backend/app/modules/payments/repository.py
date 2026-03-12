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


def list_payments_by_session(
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> list[Payment]:
    """Return all payment records for orders belonging to a table session.

    Queries via a sub-select on order_headers so no schema change is required
    on the payments table.
    """
    from app.modules.orders.model import OrderHeader  # local import — avoids circularity

    order_id_subq = (
        db.query(OrderHeader.id)
        .filter(
            OrderHeader.session_id == session_id,
            OrderHeader.restaurant_id == restaurant_id,
        )
        .subquery()
    )
    return (
        db.query(Payment)
        .filter(
            Payment.order_id.in_(order_id_subq),
            Payment.restaurant_id == restaurant_id,
        )
        .all()
    )


def update_payments_for_settlement(
    db: Session,
    *,
    order_ids: list[int],
    restaurant_id: int,
    payment_method: str,
    transaction_reference: str | None,
    notes: str | None,
    paid_at: "datetime",
) -> list[Payment]:
    """Bulk-update all pending payment records for the given orders to paid.

    Called as part of the atomic billing settlement transaction.
    The caller is responsible for committing or rolling back.
    """
    payments = (
        db.query(Payment)
        .filter(
            Payment.order_id.in_(order_ids),
            Payment.restaurant_id == restaurant_id,
            Payment.payment_status == PaymentStatus.pending,
        )
        .all()
    )
    for p in payments:
        p.payment_status = PaymentStatus.paid
        p.payment_method = payment_method
        p.paid_at = paid_at
        if transaction_reference:
            p.transaction_reference = transaction_reference
        if notes:
            p.notes = notes
    db.flush()
    return payments
