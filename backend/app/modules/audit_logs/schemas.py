from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field
from pydantic import model_validator


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

    @model_validator(mode="after")
    def validate_has_action(self):
        if not self.model_fields_set:
            raise ValueError("At least one queue action field must be provided.")
        return self


class SuperAdminNotificationAssigneeResponse(BaseModel):
    user_id: int
    full_name: str
    email: str


class SuperAdminNotificationAssigneeListResponse(BaseModel):
    items: list[SuperAdminNotificationAssigneeResponse]
    total: int
