"""Pydantic schemas for the payments module."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.payments.model import BillingTransactionStatus, BillingTransactionType, PaymentStatus, PosPaymentStatus


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


class PaymentTerminalBase(BaseModel):
    counter_name: str = Field(..., max_length=100)
    provider: str = Field(..., max_length=50)
    is_active: bool = True

class PaymentTerminalCreate(PaymentTerminalBase):
    merchant_id: str = Field(..., max_length=255)
    terminal_id: str = Field(..., max_length=255)
    api_key: str | None = Field(default=None, max_length=1024)

class PaymentTerminalUpdate(BaseModel):
    counter_name: str | None = Field(default=None, max_length=100)
    provider: str | None = Field(default=None, max_length=50)
    merchant_id: str | None = Field(default=None, max_length=255)
    terminal_id: str | None = Field(default=None, max_length=255)
    api_key: str | None = Field(default=None, max_length=1024)
    is_active: bool | None = None

class PaymentTerminalResponse(PaymentTerminalBase):
    id: int
    restaurant_id: int
    merchant_id_masked: str
    terminal_id_masked: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PosPaymentTriggerRequest(BaseModel):
    terminal_id: int = Field(..., gt=0)
    session_id: str = Field(..., max_length=255)
    amount: float = Field(..., gt=0)


class PosPaymentIntentResponse(BaseModel):
    id: int
    restaurant_id: int
    terminal_id: int
    bill_id: int | None
    session_id: str
    amount: float
    status: PosPaymentStatus
    provider_reference: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

