from __future__ import annotations

from pydantic import BaseModel, Field


# ─── Requests ────────────────────────────────────────────────────────────────


class AddCartItemRequest(BaseModel):
    """Add an item to the cart.

    SECURITY: price is intentionally absent — totals are always computed
    server-side from DB-authoritative item prices.
    """

    item_id: int
    quantity: int = Field(..., ge=1, description="Must be at least 1")


class UpdateCartItemRequest(BaseModel):
    """Update the quantity of an existing cart line."""

    quantity: int = Field(..., ge=1, description="Must be at least 1")


# ─── Responses ────────────────────────────────────────────────────────────────


class CartItemResponse(BaseModel):
    """A single line in the cart with DB-backed price data."""

    item_id: int
    name: str
    unit_price: float
    quantity: int
    line_total: float
    is_available: bool


class CartResponse(BaseModel):
    """Full cart contents including computed totals."""

    session_id: str
    restaurant_id: int
    table_number: str
    items: list[CartItemResponse]
    total: float
    item_count: int


class CartSummaryResponse(BaseModel):
    """Lightweight cart summary for header/badge display."""

    item_count: int
    total: float


class GenericMessageResponse(BaseModel):
    message: str
