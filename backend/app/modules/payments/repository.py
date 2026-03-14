"""Repository layer for the payments table."""
from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.payments.model import (
    BillingTransaction,
    BillingTransactionStatus,
    BillingTransactionType,
    Payment,
    PaymentStatus,
    ProcessedWebhookEvent,
)


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


def create_billing_transaction(
    db: Session,
    *,
    restaurant_id: int,
    package_id: int,
    amount: float,
    currency: str,
    transaction_type: BillingTransactionType = BillingTransactionType.subscription_purchase,
    metadata: dict | None = None,
) -> BillingTransaction:
    record = BillingTransaction(
        restaurant_id=restaurant_id,
        package_id=package_id,
        amount=round(amount, 2),
        currency=currency.lower(),
        transaction_type=transaction_type,
        status=BillingTransactionStatus.pending,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(record)
    db.flush()
    db.refresh(record)
    return record


def set_checkout_session_id(
    db: Session,
    *,
    transaction: BillingTransaction,
    session_id: str,
) -> BillingTransaction:
    transaction.stripe_checkout_session_id = session_id
    db.flush()
    db.refresh(transaction)
    return transaction


def get_billing_transaction_by_id(
    db: Session,
    transaction_id: int,
    restaurant_id: int | None = None,
) -> BillingTransaction | None:
    query = db.query(BillingTransaction).filter(BillingTransaction.id == transaction_id)
    if restaurant_id is not None:
        query = query.filter(BillingTransaction.restaurant_id == restaurant_id)
    return query.first()


def get_billing_transaction_by_checkout_session(
    db: Session,
    checkout_session_id: str,
) -> BillingTransaction | None:
    return (
        db.query(BillingTransaction)
        .filter(BillingTransaction.stripe_checkout_session_id == checkout_session_id)
        .first()
    )


def list_billing_transactions(
    db: Session,
    *,
    restaurant_id: int,
    limit: int,
    offset: int,
) -> list[BillingTransaction]:
    return (
        db.query(BillingTransaction)
        .filter(BillingTransaction.restaurant_id == restaurant_id)
        .order_by(BillingTransaction.created_at.desc(), BillingTransaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def count_billing_transactions(
    db: Session,
    *,
    restaurant_id: int,
) -> int:
    return (
        db.query(BillingTransaction)
        .filter(BillingTransaction.restaurant_id == restaurant_id)
        .count()
    )


def mark_billing_transaction_paid(
    db: Session,
    *,
    transaction: BillingTransaction,
    stripe_payment_intent_id: str | None,
    stripe_customer_id: str | None,
    subscription_id: int | None,
) -> BillingTransaction:
    transaction.status = BillingTransactionStatus.paid
    transaction.paid_at = datetime.now(UTC)
    transaction.failure_reason = None
    if stripe_payment_intent_id:
        transaction.stripe_payment_intent_id = stripe_payment_intent_id
    if stripe_customer_id:
        transaction.stripe_customer_id = stripe_customer_id
    if subscription_id is not None:
        transaction.subscription_id = subscription_id
    db.flush()
    db.refresh(transaction)
    return transaction


def mark_billing_transaction_failed(
    db: Session,
    *,
    transaction: BillingTransaction,
    failure_reason: str,
) -> BillingTransaction:
    transaction.status = BillingTransactionStatus.failed
    transaction.failure_reason = failure_reason
    db.flush()
    db.refresh(transaction)
    return transaction


def mark_billing_transaction_cancelled(
    db: Session,
    *,
    transaction: BillingTransaction,
    failure_reason: str | None = None,
) -> BillingTransaction:
    transaction.status = BillingTransactionStatus.cancelled
    transaction.failure_reason = failure_reason
    db.flush()
    db.refresh(transaction)
    return transaction


def has_processed_webhook_event(db: Session, event_id: str) -> bool:
    found = (
        db.query(ProcessedWebhookEvent.id)
        .filter(ProcessedWebhookEvent.event_id == event_id)
        .first()
    )
    return found is not None


def record_processed_webhook_event(
    db: Session,
    *,
    event_id: str,
    event_type: str,
    provider: str,
    payload: dict | None,
) -> ProcessedWebhookEvent:
    record = ProcessedWebhookEvent(
        event_id=event_id,
        event_type=event_type,
        provider=provider,
        payload_json=json.dumps(payload) if payload else None,
    )
    db.add(record)
    db.flush()
    db.refresh(record)
    return record
