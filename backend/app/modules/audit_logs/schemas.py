from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field
from pydantic import model_validator

REVIEW_REASON_MIN_LENGTH = 24
REVIEW_REASON_POLICY_TEMPLATE = (
    "Policy: <policy-check>; Evidence: <facts>; Decision: <approve/reject impact>."
)


class AuditLogActorResponse(BaseModel):
    user_id: int | None = None
    full_name: str | None = None
    email: str | None = None


class AuditLogRestaurantResponse(BaseModel):
    restaurant_id: int | None = None
    name: str | None = None


class AuditLogEntryResponse(BaseModel):
    id: int
    event_type: str
    category: str
    severity: str
    title: str
    message: str
    ip_address: str | None
    user_agent: str | None
    actor: AuditLogActorResponse = Field(default_factory=AuditLogActorResponse)
    restaurant: AuditLogRestaurantResponse = Field(default_factory=AuditLogRestaurantResponse)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditLogEntryResponse]
    total: int


class AuditLogExportRequest(BaseModel):
    event_type: str | None = None
    restaurant_id: int | None = Field(default=None, ge=1)
    search: str | None = None
    actor_search: str | None = None
    severity: str | None = None
    category: str | None = None
    created_from: datetime | None = None
    created_to: datetime | None = None


class AuditLogExportJobResponse(BaseModel):
    id: str
    status: str
    row_count: int | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    expires_at: datetime | None = None


class SuperAdminNotificationResponse(BaseModel):
    id: str
    audit_log_id: int
    event_type: str
    category: str
    severity: str
    title: str
    message: str
    actor: AuditLogActorResponse = Field(default_factory=AuditLogActorResponse)
    restaurant: AuditLogRestaurantResponse = Field(default_factory=AuditLogRestaurantResponse)
    metadata: dict[str, Any] = Field(default_factory=dict)
    queue_status: str
    is_read: bool = False
    read_at: datetime | None = None
    read_by: AuditLogActorResponse = Field(default_factory=AuditLogActorResponse)
    assigned_to: AuditLogActorResponse = Field(default_factory=AuditLogActorResponse)
    assigned_at: datetime | None = None
    is_acknowledged: bool = False
    acknowledged_at: datetime | None = None
    acknowledged_by: AuditLogActorResponse = Field(default_factory=AuditLogActorResponse)
    is_snoozed: bool = False
    snoozed_until: datetime | None = None
    is_archived: bool = False
    archived_at: datetime | None = None
    archived_by: AuditLogActorResponse = Field(default_factory=AuditLogActorResponse)
    created_at: datetime


class SuperAdminNotificationListResponse(BaseModel):
    items: list[SuperAdminNotificationResponse]
    total: int
    next_cursor: str | None = None
    has_more: bool = False


class SuperAdminNotificationUpdateRequest(BaseModel):
    is_read: bool | None = None
    assigned_user_id: int | None = Field(default=None, ge=1)
    is_acknowledged: bool | None = None
    snoozed_until: datetime | None = None
    is_archived: bool | None = None
    action_reason: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_has_action(self):
        effective_fields = set(self.model_fields_set) - {"action_reason"}
        if not effective_fields:
            raise ValueError("At least one queue action field must be provided.")
        requires_reason = bool(
            self.is_acknowledged is True
            or self.is_archived is True
            or self.is_archived is False
        )
        if requires_reason:
            if not self.action_reason or len(self.action_reason.strip()) < REVIEW_REASON_MIN_LENGTH:
                raise ValueError(
                    "Critical queue actions require a structured reason. "
                    f"Use template: {REVIEW_REASON_POLICY_TEMPLATE}"
                )
        return self


class SuperAdminNotificationBulkUpdateRequest(BaseModel):
    notification_ids: list[str] = Field(default_factory=list, min_length=1, max_length=200)
    assigned_user_id: int | None = Field(default=None, ge=1)
    is_read: bool | None = None
    is_acknowledged: bool | None = None
    is_archived: bool | None = None
    action_reason: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_has_action(self):
        action_fields = [
            self.assigned_user_id is not None,
            self.is_read is not None,
            self.is_acknowledged is not None,
            self.is_archived is not None,
        ]
        if not any(action_fields):
            raise ValueError("At least one bulk action field must be provided.")

        requires_reason = bool(
            self.is_acknowledged is True
            or self.is_archived is True
            or self.is_archived is False
        )
        if requires_reason:
            if not self.action_reason or len(self.action_reason.strip()) < REVIEW_REASON_MIN_LENGTH:
                raise ValueError(
                    "Critical bulk queue actions require a structured reason. "
                    f"Use template: {REVIEW_REASON_POLICY_TEMPLATE}"
                )
        return self


class SuperAdminNotificationBulkUpdateResultItem(BaseModel):
    notification_id: str
    status: str
    message: str


class SuperAdminNotificationBulkUpdateResponse(BaseModel):
    total_requested: int
    succeeded: int
    failed: int
    results: list[SuperAdminNotificationBulkUpdateResultItem]


class SuperAdminNotificationAssigneeResponse(BaseModel):
    user_id: int
    full_name: str
    email: str


class SuperAdminNotificationAssigneeListResponse(BaseModel):
    items: list[SuperAdminNotificationAssigneeResponse]
    total: int
