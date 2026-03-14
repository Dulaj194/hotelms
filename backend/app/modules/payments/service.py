"""Payments service — lightweight for now, ready for gateway integration."""
from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.packages import repository as packages_repo
from app.modules.payments import repository as payment_repo
from app.modules.payments.model import BillingTransactionStatus
from app.modules.payments.schemas import (
    BillingTransactionListResponse,
    BillingTransactionResponse,
    CheckoutSessionResponse,
    PaymentResponse,
)
from app.modules.subscriptions import service as subscriptions_service


def _get_stripe_module() -> Any:
    try:
        import stripe
    except ImportError as exc:  # pragma: no cover - runtime env dependent
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe SDK not installed. Add stripe package to backend dependencies.",
        ) from exc
    return stripe


def _to_cents(amount: Decimal | float | int) -> int:
    amount_decimal = Decimal(str(amount))
    return int((amount_decimal * 100).quantize(Decimal("1")))


def _normalize_to_naive_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def get_payment_for_order(
    db: Session, order_id: int, restaurant_id: int
) -> PaymentResponse | None:
    payment = payment_repo.get_payment_by_order(db, order_id, restaurant_id)
    if payment is None:
        return None
    return PaymentResponse.model_validate(payment)


def create_checkout_session(
    db: Session,
    *,
    restaurant_id: int,
    package_id: int,
) -> CheckoutSessionResponse:
    package = packages_repo.get_package_by_id(db, package_id)
    if package is None or not package.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found or inactive.")

    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe is not configured. Missing STRIPE_SECRET_KEY.",
        )

    stripe = _get_stripe_module()
    stripe.api_key = settings.stripe_secret_key

    transaction = payment_repo.create_billing_transaction(
        db,
        restaurant_id=restaurant_id,
        package_id=package.id,
        amount=float(package.price),
        currency=settings.stripe_currency,
        metadata={"source": "stripe_checkout", "package_code": package.code},
    )

    success_url = settings.stripe_checkout_success_url.format(CHECKOUT_SESSION_ID="{CHECKOUT_SESSION_ID}")
    cancel_url = settings.stripe_checkout_cancel_url

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            payment_method_types=["card"],
            line_items=[
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": settings.stripe_currency,
                        "unit_amount": _to_cents(package.price),
                        "product_data": {
                            "name": f"{package.name} subscription",
                            "description": package.description or f"{package.billing_period_days}-day plan",
                        },
                    },
                }
            ],
            metadata={
                "restaurant_id": str(restaurant_id),
                "package_id": str(package.id),
                "billing_transaction_id": str(transaction.id),
            },
        )
    except Exception as exc:
        payment_repo.mark_billing_transaction_failed(
            db,
            transaction=transaction,
            failure_reason=str(exc),
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create Stripe checkout session.",
        ) from exc

    payment_repo.set_checkout_session_id(db, transaction=transaction, session_id=session.id)
    db.commit()

    return CheckoutSessionResponse(
        checkout_url=session.url,
        session_id=session.id,
        transaction_id=transaction.id,
    )


def process_webhook(
    db: Session,
    *,
    payload_bytes: bytes,
    stripe_signature: str,
) -> None:
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe webhook is not configured.",
        )

    stripe = _get_stripe_module()
    stripe.api_key = settings.stripe_secret_key

    try:
        event = stripe.Webhook.construct_event(
            payload=payload_bytes,
            sig_header=stripe_signature,
            secret=settings.stripe_webhook_secret,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature.") from exc

    event_id = event.get("id")
    event_type = event.get("type", "unknown")
    if not event_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe event payload.")

    if payment_repo.has_processed_webhook_event(db, event_id):
        return

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(db, event)
    elif event_type == "checkout.session.expired":
        _handle_checkout_expired(db, event)

    payment_repo.record_processed_webhook_event(
        db,
        event_id=event_id,
        event_type=event_type,
        provider="stripe",
        payload=event,
    )
    db.commit()


def _handle_checkout_completed(db: Session, event: dict[str, Any]) -> None:
    obj = event.get("data", {}).get("object", {})
    checkout_session_id = obj.get("id")
    if not checkout_session_id:
        return

    metadata = obj.get("metadata", {}) or {}
    transaction_id_value = metadata.get("billing_transaction_id")
    package_id_value = metadata.get("package_id")
    restaurant_id_value = metadata.get("restaurant_id")

    transaction = payment_repo.get_billing_transaction_by_checkout_session(db, checkout_session_id)
    if transaction is None and transaction_id_value and transaction_id_value.isdigit():
        transaction = payment_repo.get_billing_transaction_by_id(db, int(transaction_id_value))

    if transaction is None:
        return

    if transaction.status == BillingTransactionStatus.paid:
        return

    if not package_id_value or not restaurant_id_value:
        payment_repo.mark_billing_transaction_failed(
            db,
            transaction=transaction,
            failure_reason="Missing metadata in Stripe checkout session.",
        )
        return

    try:
        package_id = int(package_id_value)
        restaurant_id = int(restaurant_id_value)
    except ValueError:
        payment_repo.mark_billing_transaction_failed(
            db,
            transaction=transaction,
            failure_reason="Invalid metadata values in Stripe checkout session.",
        )
        return

    subscription = subscriptions_service.activate_paid_subscription(
        db,
        restaurant_id=restaurant_id,
        package_id=package_id,
    )

    paid_at = _normalize_to_naive_utc(datetime.now(UTC))
    transaction.paid_at = paid_at
    payment_repo.mark_billing_transaction_paid(
        db,
        transaction=transaction,
        stripe_payment_intent_id=obj.get("payment_intent"),
        stripe_customer_id=obj.get("customer"),
        subscription_id=subscription.id,
    )


def _handle_checkout_expired(db: Session, event: dict[str, Any]) -> None:
    obj = event.get("data", {}).get("object", {})
    checkout_session_id = obj.get("id")
    if not checkout_session_id:
        return

    transaction = payment_repo.get_billing_transaction_by_checkout_session(db, checkout_session_id)
    if transaction is None:
        return

    if transaction.status == BillingTransactionStatus.pending:
        payment_repo.mark_billing_transaction_cancelled(
            db,
            transaction=transaction,
            failure_reason="Checkout session expired.",
        )


def get_billing_history(
    db: Session,
    *,
    restaurant_id: int,
    limit: int,
    offset: int,
) -> BillingTransactionListResponse:
    items = payment_repo.list_billing_transactions(
        db,
        restaurant_id=restaurant_id,
        limit=limit,
        offset=offset,
    )
    total = payment_repo.count_billing_transactions(db, restaurant_id=restaurant_id)
    return BillingTransactionListResponse(
        items=[BillingTransactionResponse.model_validate(item) for item in items],
        total=total,
    )


def get_billing_transaction_detail(
    db: Session,
    *,
    restaurant_id: int,
    transaction_id: int,
) -> BillingTransactionResponse:
    transaction = payment_repo.get_billing_transaction_by_id(
        db,
        transaction_id=transaction_id,
        restaurant_id=restaurant_id,
    )
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing transaction not found.")
    return BillingTransactionResponse.model_validate(transaction)
