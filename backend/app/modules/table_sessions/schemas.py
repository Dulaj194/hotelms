from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TableSessionStartRequest(BaseModel):
    """Body for POST /table-sessions/start.

    SECURITY: This endpoint accepts restaurant_id + table_number to issue
    a signed guest session token. These values alone are never used for cart
    authorization. The returned signed token is the authorization credential.
    """

    restaurant_id: int
    table_number: str = Field(..., min_length=1, max_length=50)


class TableSessionStartResponse(BaseModel):
    """Returned after a successful session start.

    guest_token: signed JWT-style token the client must include in cart requests.
    session_id: opaque reference for client-side storage/display if needed.
    expires_at: ISO timestamp so client can warn user of expiry.
    """

    session_id: str
    guest_token: str
    restaurant_id: int
    table_number: str
    expires_at: datetime

    model_config = {"from_attributes": True}


class GuestSessionInfoResponse(BaseModel):
    """Minimal session info returned from token validation."""

    session_id: str
    restaurant_id: int
    table_number: str
    expires_at: datetime
    is_active: bool
