"""Pydantic schemas for the payments module."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.modules.payments.model import PaymentStatus


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
