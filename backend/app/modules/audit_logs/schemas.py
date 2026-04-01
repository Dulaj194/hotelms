from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


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
    event_type: str
    category: str
    severity: str
    title: str
    message: str
    actor: AuditLogActorResponse = Field(default_factory=AuditLogActorResponse)
    restaurant: AuditLogRestaurantResponse = Field(default_factory=AuditLogRestaurantResponse)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class SuperAdminNotificationListResponse(BaseModel):
    items: list[SuperAdminNotificationResponse]
    total: int
