from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


# ── Requests ──────────────────────────────────────────────────────────────────

class RoomCreateRequest(BaseModel):
    """Create a new room in the authenticated restaurant.

    restaurant_id is intentionally absent — it comes from the auth context.
    """

    room_number: str = Field(..., min_length=1, max_length=50)
    room_name: str | None = Field(default=None, max_length=255)
    floor_number: int | None = Field(default=None, ge=0)


class RoomUpdateRequest(BaseModel):
    """Partial update for a room. Only supplied fields are changed."""

    room_number: str | None = Field(default=None, min_length=1, max_length=50)
    room_name: str | None = Field(default=None, max_length=255)
    floor_number: int | None = Field(default=None, ge=0)


# ── Responses ─────────────────────────────────────────────────────────────────

class RoomResponse(BaseModel):
    id: int
    restaurant_id: int
    room_number: str
    room_name: str | None
    floor_number: int | None
    qr_code_path: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoomListResponse(BaseModel):
    rooms: list[RoomResponse]
    total: int


class RoomStatusResponse(BaseModel):
    id: int
    room_number: str
    is_active: bool

    model_config = {"from_attributes": True}
