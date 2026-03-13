"""Pydantic schemas for the housekeeping module."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

# Valid request types — both backend validation and frontend dropdown share this set.
REQUEST_TYPE_VALUES = ("cleaning", "towels", "water", "maintenance", "other")

RequestTypeLiteral = Literal["cleaning", "towels", "water", "maintenance", "other"]


# ── Guest submission schemas ──────────────────────────────────────────────────

class HousekeepingRequestCreateRequest(BaseModel):
    """Payload submitted by room guest. restaurant_id/room context comes from session."""

    request_type: RequestTypeLiteral
    message: str = Field(..., min_length=1, max_length=1000)
    guest_name: Optional[str] = Field(None, max_length=255)


class HousekeepingRequestCreateResponse(BaseModel):
    id: int
    room_number: str
    request_type: str
    message: str
    status: str
    submitted_at: datetime

    model_config = {"from_attributes": True}


# ── Staff / admin schemas ─────────────────────────────────────────────────────

class HousekeepingRequestResponse(BaseModel):
    id: int
    room_id: int
    room_number: str
    guest_name: Optional[str]
    request_type: str
    message: str
    status: str
    submitted_at: datetime
    done_at: Optional[datetime]

    model_config = {"from_attributes": True}


class HousekeepingRequestListResponse(BaseModel):
    requests: list[HousekeepingRequestResponse]
    total: int


class HousekeepingRequestStatusResponse(BaseModel):
    id: int
    status: str
    done_at: Optional[datetime]

    model_config = {"from_attributes": True}


class GenericMessageResponse(BaseModel):
    message: str
