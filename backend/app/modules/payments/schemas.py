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
