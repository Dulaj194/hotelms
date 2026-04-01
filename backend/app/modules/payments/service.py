"""Payments service — lightweight for now, ready for gateway integration."""
from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.audit_logs.service import write_audit_log
from app.modules.billing.model import Bill, BillStatus
from app.modules.packages import repository as packages_repo
from app.modules.payments import repository as payment_repo
from app.modules.payments.model import BillingTransactionStatus
from app.modules.promo_codes import service as promo_codes_service
from app.modules.promo_codes.schemas import PromoCodeConsumeRequest, PromoCodeValidateRequest
from app.modules.payments.schemas import (
    BillingTransactionListResponse,
    BillingTransactionResponse,
    CheckoutSessionResponse,
    PaymentResponse,
    PlatformCommercialOverviewResponse,
    PlatformExpiringSubscriptionResponse,
    PlatformFailedWebhookResponse,
    PlatformOverduePaymentResponse,
    PlatformRevenueByTenantResponse,
)
from app.modules.restaurants.model import Restaurant
from app.modules.subscriptions.model import RestaurantSubscription, SubscriptionStatus
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


def _utcnow_naive() -> datetime:
    return datetime.utcnow()


def _normalize_metadata_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _record_stripe_webhook_failure(
    db: Session,
    *,
    reason: str,
    stripe_event_type: str | None = None,
    restaurant_id: int | None = None,
    billing_transaction_id: int | None = None,
) -> None:
    metadata = {
        "provider": "stripe",
        "reason": reason,
        "stripe_event_type": stripe_event_type,
        "billing_transaction_id": billing_transaction_id,
        "restaurant_id": restaurant_id,
    }
    write_audit_log(
        db,
        event_type="stripe_webhook_failed",
        restaurant_id=restaurant_id,
        metadata=metadata,
    )


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
    promo_code: str | None = None,
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

    promo_code_value: str | None = None
    discount_percent = 0.0
    final_amount = float(package.price)
    if promo_code:
        validation = promo_codes_service.validate_promo_for_restaurant(
            db,
            restaurant_id=restaurant_id,
            payload=PromoCodeValidateRequest(code=promo_code),
        )
        if not validation.valid or validation.discount_percent is None or not validation.code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=validation.message,
            )
        promo_code_value = validation.code
        discount_percent = float(validation.discount_percent)
        final_amount = max(0.0, final_amount - (final_amount * (discount_percent / 100)))

    transaction = payment_repo.create_billing_transaction(
        db,
        restaurant_id=restaurant_id,
        package_id=package.id,
        amount=final_amount,
        currency=settings.stripe_currency,
        metadata={
            "source": "stripe_checkout",
            "package_code": package.code,
            "promo_code": promo_code_value,
            "discount_percent": discount_percent,
        },
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
                        "unit_amount": _to_cents(final_amount),
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
                "promo_code": promo_code_value or "",
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
        _record_stripe_webhook_failure(
            db,
            reason="invalid_signature",
            stripe_event_type="unknown",
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature.") from exc

    event_id = event.get("id")
    event_type = event.get("type", "unknown")
    if not event_id:
        _record_stripe_webhook_failure(
            db,
            reason="missing_event_id",
            stripe_event_type=event_type,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe event payload.")

    if payment_repo.has_processed_webhook_event(db, event_id):
        return

    try:
        if event_type == "checkout.session.completed":
            _handle_checkout_completed(db, event)
        elif event_type == "checkout.session.expired":
            _handle_checkout_expired(db, event)
    except HTTPException as exc:
        _record_stripe_webhook_failure(
            db,
            reason=str(exc.detail),
            stripe_event_type=event_type,
        )
        raise
    except Exception as exc:
        _record_stripe_webhook_failure(
            db,
            reason="processing_exception",
            stripe_event_type=event_type,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe webhook processing failed.",
        ) from exc

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
        _record_stripe_webhook_failure(
            db,
            reason="missing_checkout_session_id",
            stripe_event_type=event.get("type"),
        )
        return

    metadata = obj.get("metadata", {}) or {}
    transaction_id_value = metadata.get("billing_transaction_id")
    package_id_value = metadata.get("package_id")
    restaurant_id_value = metadata.get("restaurant_id")
    promo_code_value = (metadata.get("promo_code") or "").strip().upper()

    transaction = payment_repo.get_billing_transaction_by_checkout_session(db, checkout_session_id)
    if transaction is None and transaction_id_value and transaction_id_value.isdigit():
        transaction = payment_repo.get_billing_transaction_by_id(db, int(transaction_id_value))

    if transaction is None:
        restaurant_id = int(restaurant_id_value) if restaurant_id_value and str(restaurant_id_value).isdigit() else None
        _record_stripe_webhook_failure(
            db,
            reason="missing_billing_transaction",
            stripe_event_type=event.get("type"),
            restaurant_id=restaurant_id,
        )
        return

    if transaction.status == BillingTransactionStatus.paid:
        return

    if not package_id_value or not restaurant_id_value:
        payment_repo.mark_billing_transaction_failed(
            db,
            transaction=transaction,
            failure_reason="Missing metadata in Stripe checkout session.",
        )
        _record_stripe_webhook_failure(
            db,
            reason="missing_metadata",
            stripe_event_type=event.get("type"),
            restaurant_id=transaction.restaurant_id,
            billing_transaction_id=transaction.id,
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
        _record_stripe_webhook_failure(
            db,
            reason="invalid_metadata_values",
            stripe_event_type=event.get("type"),
            restaurant_id=transaction.restaurant_id,
            billing_transaction_id=transaction.id,
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

    if promo_code_value:
        try:
            promo_codes_service.consume_promo_for_restaurant(
                db,
                restaurant_id=restaurant_id,
                payload=PromoCodeConsumeRequest(code=promo_code_value, increment=1),
            )
        except Exception:
            # Billing transaction is already successful. Promo usage update is best-effort.
            pass


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


def get_platform_commercial_overview(
    db: Session,
    *,
    overdue_hours: int = 24,
    expiring_window_days: int = 7,
    revenue_limit: int = 8,
    watchlist_limit: int = 6,
) -> PlatformCommercialOverviewResponse:
    from app.modules.audit_logs.model import AuditLog
    from app.modules.packages.model import Package

    now = _utcnow_naive()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    overdue_cutoff = now - timedelta(hours=overdue_hours)
    expiring_cutoff = now + timedelta(days=expiring_window_days)
    effective_expiry = func.coalesce(
        RestaurantSubscription.trial_expires_at,
        RestaurantSubscription.expires_at,
    )

    overdue_rows = (
        db.query(Bill, Restaurant)
        .join(Restaurant, Restaurant.id == Bill.restaurant_id)
        .filter(
            Bill.payment_status == BillStatus.pending,
            Bill.created_at <= overdue_cutoff,
        )
        .order_by(Bill.created_at.asc(), Bill.id.asc())
        .limit(watchlist_limit)
        .all()
    )
    overdue_payment_count = (
        db.query(func.count(Bill.id))
        .filter(
            Bill.payment_status == BillStatus.pending,
            Bill.created_at <= overdue_cutoff,
        )
        .scalar()
        or 0
    )

    revenue_rows = (
        db.query(
            Bill.restaurant_id,
            Restaurant.name,
            func.count(Bill.id),
            func.coalesce(func.sum(Bill.total_amount), 0),
        )
        .join(Restaurant, Restaurant.id == Bill.restaurant_id)
        .filter(
            Bill.payment_status == BillStatus.paid,
            Bill.settled_at.is_not(None),
            Bill.settled_at >= today_start,
            Bill.settled_at < today_end,
        )
        .group_by(Bill.restaurant_id, Restaurant.name)
        .order_by(func.sum(Bill.total_amount).desc(), Restaurant.name.asc())
        .limit(revenue_limit)
        .all()
    )
    today_revenue_total = float(
        (
            db.query(func.coalesce(func.sum(Bill.total_amount), 0))
            .filter(
                Bill.payment_status == BillStatus.paid,
                Bill.settled_at.is_not(None),
                Bill.settled_at >= today_start,
                Bill.settled_at < today_end,
            )
            .scalar()
        )
        or 0
    )

    active_trial_count = (
        db.query(func.count(RestaurantSubscription.id))
        .filter(
            RestaurantSubscription.status == SubscriptionStatus.trial,
            effective_expiry > now,
        )
        .scalar()
        or 0
    )
    expiring_subscription_count = (
        db.query(func.count(RestaurantSubscription.id))
        .filter(
            RestaurantSubscription.status.in_(
                [SubscriptionStatus.trial, SubscriptionStatus.active]
            ),
            effective_expiry >= now,
            effective_expiry <= expiring_cutoff,
        )
        .scalar()
        or 0
    )
    expiring_rows = (
        db.query(RestaurantSubscription, Restaurant, Package)
        .join(Restaurant, Restaurant.id == RestaurantSubscription.restaurant_id)
        .join(Package, Package.id == RestaurantSubscription.package_id)
        .filter(
            RestaurantSubscription.status.in_(
                [SubscriptionStatus.trial, SubscriptionStatus.active]
            ),
            effective_expiry >= now,
            effective_expiry <= expiring_cutoff,
        )
        .order_by(effective_expiry.asc(), RestaurantSubscription.id.asc())
        .limit(watchlist_limit)
        .all()
    )

    failed_webhook_since = now - timedelta(days=7)
    failed_webhook_count = (
        db.query(func.count(AuditLog.id))
        .filter(
            AuditLog.event_type == "stripe_webhook_failed",
            AuditLog.created_at >= failed_webhook_since,
        )
        .scalar()
        or 0
    )
    failed_webhook_rows = (
        db.query(AuditLog, Restaurant)
        .outerjoin(Restaurant, Restaurant.id == AuditLog.restaurant_id)
        .filter(
            AuditLog.event_type == "stripe_webhook_failed",
            AuditLog.created_at >= failed_webhook_since,
        )
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(watchlist_limit)
        .all()
    )

    return PlatformCommercialOverviewResponse(
        overdue_payment_count=int(overdue_payment_count),
        failed_stripe_webhook_count=int(failed_webhook_count),
        active_trial_count=int(active_trial_count),
        expiring_subscription_count=int(expiring_subscription_count),
        today_revenue_total=round(today_revenue_total, 2),
        revenue_by_tenant=[
            PlatformRevenueByTenantResponse(
                restaurant_id=int(restaurant_id),
                restaurant_name=str(restaurant_name),
                paid_bill_count=int(paid_bill_count),
                revenue_today=round(float(revenue_today), 2),
            )
            for restaurant_id, restaurant_name, paid_bill_count, revenue_today in revenue_rows
        ],
        overdue_payments=[
            PlatformOverduePaymentResponse(
                bill_id=bill.id,
                restaurant_id=bill.restaurant_id,
                restaurant_name=restaurant.name,
                table_number=bill.table_number or bill.room_number or "-",
                amount=round(float(bill.total_amount), 2),
                created_at=bill.created_at,
            )
            for bill, restaurant in overdue_rows
        ],
        failed_stripe_webhooks=[
            PlatformFailedWebhookResponse(
                audit_log_id=log.id,
                restaurant_id=restaurant.id if restaurant is not None else log.restaurant_id,
                restaurant_name=restaurant.name if restaurant is not None else None,
                stripe_event_type=_normalize_metadata_json(log.metadata_json).get("stripe_event_type"),
                reason=_normalize_metadata_json(log.metadata_json).get("reason"),
                created_at=log.created_at,
            )
            for log, restaurant in failed_webhook_rows
        ],
        expiring_subscriptions=[
            PlatformExpiringSubscriptionResponse(
                restaurant_id=restaurant.id,
                restaurant_name=restaurant.name,
                package_name=package.name if package is not None else None,
                package_code=package.code if package is not None else None,
                status=subscription.status.value,
                is_trial=subscription.is_trial,
                expires_at=subscription.trial_expires_at or subscription.expires_at,
                days_remaining=max(
                    0,
                    (
                        (
                            _normalize_to_naive_utc(
                                subscription.trial_expires_at or subscription.expires_at
                            )
                            - now
                        )
                    ).days,
                ),
            )
            for subscription, restaurant, package in expiring_rows
            if (subscription.trial_expires_at or subscription.expires_at) is not None
        ],
    )
