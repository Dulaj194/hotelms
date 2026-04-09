from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

SettingsRequestStatusValue = Literal["PENDING", "APPROVED", "REJECTED"]
REVIEW_REASON_MIN_LENGTH = 24
REVIEW_REASON_POLICY_TEMPLATE = (
    "Policy: <policy-check>; Evidence: <facts>; Decision: <approve/reject impact>."
)


class SettingsRequestCreateRequest(BaseModel):
    requested_changes: dict[str, Any] = Field(default_factory=dict)
    request_reason: str | None = Field(default=None, max_length=2000)


class SettingsRequestReviewRequest(BaseModel):
    status: Literal["APPROVED", "REJECTED"]
    review_notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_reason_policy(self):
        if self.status == "REJECTED":
            if not self.review_notes or len(self.review_notes.strip()) < REVIEW_REASON_MIN_LENGTH:
                raise ValueError(
                    "Rejected reviews require a structured reason. "
                    f"Use template: {REVIEW_REASON_POLICY_TEMPLATE}"
                )
        return self


class SettingsRequestBulkReviewRequest(BaseModel):
    request_ids: list[int] = Field(default_factory=list, min_length=1, max_length=100)
    status: Literal["APPROVED", "REJECTED"]
    review_notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_bulk_reason_policy(self):
        if self.status == "REJECTED":
            if not self.review_notes or len(self.review_notes.strip()) < REVIEW_REASON_MIN_LENGTH:
                raise ValueError(
                    "Rejected bulk reviews require a structured reason. "
                    f"Use template: {REVIEW_REASON_POLICY_TEMPLATE}"
                )
        return self


class SettingsRequestBulkReviewResultItem(BaseModel):
    request_id: int
    status: Literal["ok", "error"]
    message: str


class SettingsRequestBulkReviewResponse(BaseModel):
    total_requested: int
    succeeded: int
    failed: int
    results: list[SettingsRequestBulkReviewResultItem]


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
    next_cursor: str | None = None
    has_more: bool = False


class SettingsRequestPendingCountResponse(BaseModel):
    pending_count: int


class SettingsRequestReviewResponse(BaseModel):
    message: str
    request: SettingsRequestResponse
