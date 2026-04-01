"""Pydantic schemas for the billing module."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.modules.billing.model import BillContextType, BillHandoffStatus, BillStatus
from app.modules.payments.schemas import PaymentResponse


class BillOrderItemResponse(BaseModel):
    id: int
    item_name_snapshot: str
    quantity: int
    unit_price_snapshot: float
    line_total: float

    model_config = {"from_attributes": True}


class BillOrderResponse(BaseModel):
    id: int
    order_number: str
    placed_at: datetime
    total_amount: float
    items: list[BillOrderItemResponse]

    model_config = {"from_attributes": True}


class BillRecordResponse(BaseModel):
    id: int
    bill_number: str
    context_type: BillContextType
    session_id: str
    table_number: str | None
    room_id: int | None
    room_number: str | None
    total_amount: float
    payment_method: str | None
    payment_status: BillStatus
    transaction_reference: str | None
    notes: str | None
    handoff_status: BillHandoffStatus
    sent_to_cashier_at: datetime | None
    sent_to_accountant_at: datetime | None
    handoff_completed_at: datetime | None
    settled_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BillSummaryResponse(BaseModel):
    context_type: BillContextType
    session_id: str
    restaurant_id: int
    table_number: str | None
    room_id: int | None
    room_number: str | None
    orders: list[BillOrderResponse]
    order_count: int
    subtotal: float
    tax_amount: float
    discount_amount: float
    grand_total: float
    session_is_active: bool
    is_settled: bool
    bill: BillRecordResponse | None = None


class SettleSessionRequest(BaseModel):
    payment_method: Literal["cash", "card", "manual"]
    transaction_reference: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)


class SettleSessionResponse(BaseModel):
    bill_id: int
    bill_number: str
    context_type: BillContextType
    session_id: str
    table_number: str | None
    room_id: int | None
    room_number: str | None
    order_count: int
    total_amount: float
    payment_method: str
    payment_status: BillStatus
    handoff_status: BillHandoffStatus
    settled_at: datetime
    session_closed: bool


class SessionBillingStatusResponse(BaseModel):
    context_type: BillContextType
    session_id: str
    table_number: str | None
    room_id: int | None
    room_number: str | None
    is_active: bool
    is_settled: bool
    billable_order_count: int
    grand_total: float
    handoff_status: BillHandoffStatus | None = None


class SessionPaymentHistoryResponse(BaseModel):
    context_type: BillContextType
    session_id: str
    table_number: str | None
    room_id: int | None
    room_number: str | None
    payments: list[PaymentResponse]
    total: int


class BillListResponse(BaseModel):
    items: list[BillRecordResponse]
    total: int
