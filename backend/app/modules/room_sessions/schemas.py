from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.orders.schemas import OrderItemResponse as RoomOrderItemResponse  # re-export alias


# ── Room session ──────────────────────────────────────────────────────────────

class RoomSessionStartRequest(BaseModel):
    """Body for POST /room-sessions/start.

    Comes from the QR URL context: restaurant_id + room_number.
    The backend validates both before issuing a signed session token.
    """

    restaurant_id: int
    room_number: str = Field(..., min_length=1, max_length=50)
    qr_access_key: str = Field(..., min_length=16, max_length=2000)


class RoomSessionStartResponse(BaseModel):
    """Returned after a successful room session start.

    room_session_token: signed JWT-style token the client must include
    in X-Room-Session header for all room cart and room order requests.
    """

    session_id: str
    room_session_token: str
    restaurant_id: int
    room_id: int
    room_number: str
    expires_at: datetime

    model_config = {"from_attributes": True}


class RoomSessionInfoResponse(BaseModel):
    """Minimal session info for client-side session awareness."""

    session_id: str
    restaurant_id: int
    room_id: int
    room_number: str
    expires_at: datetime
    is_active: bool


# ── Room cart ─────────────────────────────────────────────────────────────────

class AddRoomCartItemRequest(BaseModel):
    """Add an item to the room cart.

    SECURITY: price is absent — totals are always computed server-side.
    """

    item_id: int
    quantity: int = Field(..., ge=1, description="Must be at least 1")


class UpdateRoomCartItemRequest(BaseModel):
    """Set the absolute quantity for a room cart item."""

    quantity: int = Field(..., ge=1, description="Must be at least 1")


class RoomCartItemResponse(BaseModel):
    item_id: int
    name: str
    unit_price: float
    quantity: int
    line_total: float
    is_available: bool


class RoomCartResponse(BaseModel):
    """Full room cart contents including server-computed totals."""

    session_id: str
    restaurant_id: int
    room_id: int
    room_number: str
    items: list[RoomCartItemResponse]
    total: float
    item_count: int


class GenericMessageResponse(BaseModel):
    message: str


# ── Room orders ───────────────────────────────────────────────────────────────

class PlaceRoomOrderRequest(BaseModel):
    """Body for POST /room-orders.

    restaurant_id and room context come from the validated room session —
    the client must NOT supply them.
    """

    notes: str | None = Field(default=None, max_length=500)
    customer_name: str | None = Field(default=None, max_length=255)
    customer_phone: str | None = Field(default=None, max_length=50)


class RoomOrderDetailResponse(BaseModel):
    """Full room order detail returned after placement or retrieval."""

    id: int
    order_number: str
    session_id: str
    restaurant_id: int
    order_source: str
    room_id: int | None
    room_number: str | None
    customer_name: str | None
    status: str
    subtotal_amount: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    placed_at: datetime
    confirmed_at: datetime | None
    processing_at: datetime | None
    completed_at: datetime | None
    rejected_at: datetime | None
    notes: str | None
    items: list[RoomOrderItemResponse]

    model_config = {"from_attributes": True}


class PlaceRoomOrderResponse(BaseModel):
    order: RoomOrderDetailResponse
    message: str = "Room order placed successfully."


class RoomOrderListResponse(BaseModel):
    """List of room orders for a guest's room session."""
    orders: list[RoomOrderDetailResponse]
    total: int
