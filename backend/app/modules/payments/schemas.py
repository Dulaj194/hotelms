"""Pydantic schemas for the payments module."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.payments.model import BillingTransactionStatus, BillingTransactionType, PaymentStatus


class PaymentResponse(BaseModel):
    id: int
    order_id: int
    restaurant_id: int
    amount: float
    payment_method: str
    payment_status: PaymentStatus
    transaction_reference: str | None
    paid_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionPaymentHistoryResponse(BaseModel):
    session_id: str
    payments: list[PaymentResponse]
    total: int


class CheckoutSessionRequest(BaseModel):
    package_id: int = Field(..., gt=0)
    promo_code: str | None = Field(default=None, min_length=1, max_length=50)


class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    session_id: str
    transaction_id: int


class BillingTransactionResponse(BaseModel):
    id: int
    restaurant_id: int
    package_id: int
    transaction_type: BillingTransactionType
    status: BillingTransactionStatus
    amount: float
    currency: str
    stripe_checkout_session_id: str | None
    stripe_payment_intent_id: str | None
    stripe_customer_id: str | None
    subscription_id: int | None
    failure_reason: str | None
    paid_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BillingTransactionListResponse(BaseModel):
    items: list[BillingTransactionResponse]
    total: int


class WebhookAckResponse(BaseModel):
    received: bool = True


class PlatformRevenueByTenantResponse(BaseModel):
    restaurant_id: int
    restaurant_name: str
    revenue_today: float
    paid_bill_count: int


class PlatformOverduePaymentResponse(BaseModel):
    bill_id: int
    restaurant_id: int
    restaurant_name: str
    table_number: str
    amount: float
    created_at: datetime


class PlatformExpiringSubscriptionResponse(BaseModel):
    restaurant_id: int
    restaurant_name: str
    package_name: str | None
    package_code: str | None
    status: str
    is_trial: bool
    expires_at: datetime
    days_remaining: int


class PlatformFailedWebhookResponse(BaseModel):
    audit_log_id: int
    restaurant_id: int | None
    restaurant_name: str | None
    stripe_event_type: str | None
    reason: str | None
    created_at: datetime


class PlatformCommercialOverviewResponse(BaseModel):
    overdue_payment_count: int
    failed_stripe_webhook_count: int
    active_trial_count: int
    expiring_subscription_count: int
    today_revenue_total: float
    revenue_by_tenant: list[PlatformRevenueByTenantResponse]
    overdue_payments: list[PlatformOverduePaymentResponse]
    failed_stripe_webhooks: list[PlatformFailedWebhookResponse]
    expiring_subscriptions: list[PlatformExpiringSubscriptionResponse]
