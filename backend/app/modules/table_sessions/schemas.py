from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TableSessionStartRequest(BaseModel):
    """Body for POST /table-sessions/start.

    SECURITY: restaurant_id is NOT accepted from the client body for
    cart authorization. It is embedded in the signed QR URL path param
    and validated by the backend directly.

    The client sends table_number and restaurant_id only as path/context
    because these come from the QR URL already — they are NOT used to
    authorize cart operations. The returned signed token is the authorization.
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
