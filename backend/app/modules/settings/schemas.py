from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

SettingsRequestStatusValue = Literal["PENDING", "APPROVED", "REJECTED"]


class SettingsRequestCreateRequest(BaseModel):
    requested_changes: dict[str, Any] = Field(default_factory=dict)
    request_reason: str | None = Field(default=None, max_length=2000)


class SettingsRequestReviewRequest(BaseModel):
    status: Literal["APPROVED", "REJECTED"]
    review_notes: str | None = Field(default=None, max_length=2000)


class SettingsRequestResponse(BaseModel):
    request_id: int
    restaurant_id: int
    requested_by: int
    requested_changes: dict[str, Any]
    current_settings: dict[str, Any]
    status: SettingsRequestStatusValue
    request_reason: str | None
    reviewed_by: int | None
    review_notes: str | None
    reviewed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SettingsRequestListResponse(BaseModel):
    items: list[SettingsRequestResponse]
    total: int


class SettingsRequestReviewResponse(BaseModel):
    message: str
    request: SettingsRequestResponse
