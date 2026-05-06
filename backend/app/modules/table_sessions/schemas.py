from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TableSessionStartRequest(BaseModel):
    """Body for POST /table-sessions/start.

    SECURITY: Requires a signed qr_access_key that binds restaurant + table.
    restaurant_id + table_number alone are never sufficient to issue a session.
    """

    restaurant_id: int
    table_number: str = Field(..., min_length=1, max_length=50)
    customer_name: str = Field(..., min_length=1, max_length=120)
    qr_access_key: str = Field(..., min_length=16, max_length=2000)
    order_source: str = Field("table", pattern="^(table|room)$")


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
    customer_name: str
    order_source: str
    session_status: str
    expires_at: datetime

    model_config = {"from_attributes": True}


class GuestSessionInfoResponse(BaseModel):
    """Minimal session info returned from token validation."""

    session_id: str
    restaurant_id: int
    table_number: str
    order_source: str
    expires_at: datetime
    is_active: bool


class BillRequestResponse(BaseModel):
    session_id: str
    table_number: str
    customer_name: str | None
    order_source: str = "table"
    requested_at: datetime = Field(alias="updated_at")

    model_config = {"from_attributes": True, "populate_by_name": True}


class BillRequestListResponse(BaseModel):
    requests: list[BillRequestResponse]


class TableServiceRequestPayload(BaseModel):
    service_type: str = Field(..., description="Type of service: WATER, STEWARD, CLEANING, etc.")
    message: str | None = Field(None, max_length=500)


class ServiceRequestResponse(BaseModel):
    id: int
    session_id: str
    table_number: str
    customer_name: str | None
    order_source: str
    service_type: str
    message: str | None
    requested_at: datetime

    model_config = {"from_attributes": True}


class ServiceRequestListResponse(BaseModel):
    requests: list[ServiceRequestResponse]



