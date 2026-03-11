"""Pydantic schemas for the orders module."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.orders.model import OrderStatus
from app.modules.payments.schemas import PaymentResponse


# ── Request ───────────────────────────────────────────────────────────────────

class PlaceOrderRequest(BaseModel):
    """Minimal body for guest order placement.

    restaurant_id and table_number are derived from the validated guest session;
    the client MUST NOT supply them here.
    """

    notes: str | None = Field(default=None, max_length=500)
    customer_name: str | None = Field(default=None, max_length=255)
    customer_phone: str | None = Field(default=None, max_length=50)


class UpdateOrderStatusRequest(BaseModel):
    status: OrderStatus


# ── Response ──────────────────────────────────────────────────────────────────

class OrderItemResponse(BaseModel):
    id: int
    item_id: int
    item_name_snapshot: str
    unit_price_snapshot: float
    quantity: int
    line_total: float
    notes: str | None

    model_config = {"from_attributes": True}


class OrderHeaderResponse(BaseModel):
    """Lightweight order summary (used in list views)."""

    id: int
    order_number: str
    session_id: str
    restaurant_id: int
    table_number: str
    customer_name: str | None
    status: OrderStatus
    subtotal_amount: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    placed_at: datetime
    confirmed_at: datetime | None
    processing_at: datetime | None
    completed_at: datetime | None
    rejected_at: datetime | None
    paid_at: datetime | None

    model_config = {"from_attributes": True}


class OrderDetailResponse(OrderHeaderResponse):
    """Full order detail including line items and payment summary."""

    notes: str | None
    items: list[OrderItemResponse]
    payments: list[PaymentResponse]


class PlaceOrderResponse(BaseModel):
    order: OrderDetailResponse
    message: str = "Order placed successfully."


class PendingOrderListResponse(BaseModel):
    orders: list[OrderHeaderResponse]
    total: int


class ActiveOrderListResponse(BaseModel):
    orders: list[OrderHeaderResponse]
    total: int


class OrderStatusResponse(BaseModel):
    id: int
    order_number: str
    status: OrderStatus
    updated_at: datetime

    model_config = {"from_attributes": True}
