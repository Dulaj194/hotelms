"""Pydantic schemas for the billing module."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.modules.billing.model import BillStatus
from app.modules.payments.schemas import PaymentResponse


# ── Bill summary schemas ──────────────────────────────────────────────────────

class BillOrderItemResponse(BaseModel):
    """A single line item as it appears on the bill."""

    id: int
    item_name_snapshot: str
    quantity: int
    unit_price_snapshot: float
    line_total: float

    model_config = {"from_attributes": True}


class BillOrderResponse(BaseModel):
    """Summary of one order included in a bill."""

    id: int
    order_number: str
    placed_at: datetime
    total_amount: float
    items: list[BillOrderItemResponse]

    model_config = {"from_attributes": True}


class BillSummaryResponse(BaseModel):
    """Computed bill summary for a table session.

    Includes only completed, unpaid orders.
    Tax and discount are explicitly 0 (no tax engine in this phase).
    """

    session_id: str
    restaurant_id: int
    table_number: str
    orders: list[BillOrderResponse]
    order_count: int
    subtotal: float
    tax_amount: float        # 0.0 — no tax engine in this phase
    discount_amount: float   # 0.0 — no discount engine in this phase
    grand_total: float
    session_is_active: bool
    is_settled: bool


# ── Settlement schemas ────────────────────────────────────────────────────────

class SettleSessionRequest(BaseModel):
    """Request body for POST /billing/session/{session_id}/settle.

    The total is calculated server-side and never accepted from the client.
    """

    payment_method: Literal["cash", "card", "manual"]
    transaction_reference: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)


class SettleSessionResponse(BaseModel):
    """Returned after successful session settlement."""

    bill_id: int
    bill_number: str
    session_id: str
    table_number: str
    order_count: int
    total_amount: float
    payment_method: str
    payment_status: BillStatus
    settled_at: datetime
    session_closed: bool


# ── Status schema ─────────────────────────────────────────────────────────────

class SessionBillingStatusResponse(BaseModel):
    """Quick status check for a table session's billing state."""

    session_id: str
    table_number: str
    is_active: bool
    is_settled: bool
    billable_order_count: int
    grand_total: float


# ── Payment history ───────────────────────────────────────────────────────────

class SessionPaymentHistoryResponse(BaseModel):
    session_id: str
    payments: list[PaymentResponse]
    total: int
