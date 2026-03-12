"""Pydantic schemas for real-time WebSocket event payloads.

All events share a top-level structure:
  {
    "event": "<event_type>",
    "restaurant_id": <int>,
    "data": { ... }
  }
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


# ── Item summary (used inside new_order event) ────────────────────────────────

class EventOrderItem(BaseModel):
    item_name_snapshot: str
    quantity: int
    line_total: float


# ── new_order event ───────────────────────────────────────────────────────────

class NewOrderEventData(BaseModel):
    order_id: int
    order_number: str
    table_number: str
    status: str
    total_amount: float
    placed_at: datetime
    items: list[EventOrderItem]


class NewOrderEvent(BaseModel):
    event: Literal["new_order"] = "new_order"
    restaurant_id: int
    data: NewOrderEventData


# ── order_status_updated event ────────────────────────────────────────────────

class OrderStatusUpdatedEventData(BaseModel):
    order_id: int
    order_number: str
    table_number: str
    status: str
    updated_at: datetime


class OrderStatusUpdatedEvent(BaseModel):
    event: Literal["order_status_updated"] = "order_status_updated"
    restaurant_id: int
    data: OrderStatusUpdatedEventData
