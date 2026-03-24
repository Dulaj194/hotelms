"""Pydantic schemas for the housekeeping module."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

REQUEST_TYPE_VALUES = ("cleaning", "towels", "water", "maintenance", "other")
TASK_STATUS_VALUES = (
    "pending_assignment",
    "assigned",
    "in_progress",
    "inspection",
    "ready",
    "blocked",
    "rework_required",
    "cancelled",
)

RequestTypeLiteral = Literal["cleaning", "towels", "water", "maintenance", "other"]
RequestPriorityLiteral = Literal["high", "normal", "low"]
TaskStatusLiteral = Literal[
    "pending_assignment",
    "assigned",
    "in_progress",
    "inspection",
    "ready",
    "blocked",
    "rework_required",
    "cancelled",
]
InspectionDecisionLiteral = Literal["pass", "fail"]


class HousekeepingChecklistItemResponse(BaseModel):
    id: int
    item_code: str
    label: str
    is_mandatory: bool
    is_completed: bool
    completed_at: datetime | None
    completed_by_user_id: int | None

    model_config = {"from_attributes": True}


class HousekeepingMaintenanceTicketResponse(BaseModel):
    id: int
    issue_type: str
    description: str
    photo_proof_url: str | None
    status: str
    created_by_user_id: int | None
    resolved_by_user_id: int | None
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class HousekeepingEventLogResponse(BaseModel):
    id: int
    actor_user_id: int | None
    event_type: str
    from_status: str | None
    to_status: str | None
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class HousekeepingRequestCreateRequest(BaseModel):
    """Payload submitted by room guest. restaurant/room context comes from room session."""

    request_type: RequestTypeLiteral
    message: str = Field(..., min_length=1, max_length=1000)
    guest_name: str | None = Field(None, max_length=255)
    request_date: date | None = None
    request_time: str | None = Field(None, pattern=r"^([01][0-9]|2[0-3]):[0-5][0-9]$")
    audio_url: str | None = Field(None, max_length=500)


class HousekeepingManualTaskCreateRequest(BaseModel):
    """Manual task creation by owner/admin/supervisor equivalent."""

    room_id: int
    request_type: RequestTypeLiteral
    message: str = Field(..., min_length=1, max_length=1000)
    priority: RequestPriorityLiteral = "normal"
    due_at: datetime | None = None


class HousekeepingRequestCreateResponse(BaseModel):
    id: int
    room_number: str
    request_type: str
    message: str
    priority: str
    requested_for_at: datetime | None
    due_at: datetime | None
    audio_url: str | None
    status: str
    submitted_at: datetime

    model_config = {"from_attributes": True}


class HousekeepingRequestResponse(BaseModel):
    id: int
    room_id: int
    room_number: str
    room_session_id: str | None
    guest_name: str | None
    request_type: str
    priority: str
    message: str
    requested_for_at: datetime | None
    due_at: datetime | None
    audio_url: str | None
    photo_proof_url: str | None
    status: str
    assigned_to_user_id: int | None
    assigned_by_user_id: int | None
    assigned_at: datetime | None
    started_at: datetime | None
    inspection_submitted_at: datetime | None
    inspected_at: datetime | None
    inspected_by_user_id: int | None
    inspection_notes: str | None
    blocked_reason: str | None
    delay_reason: str | None
    remarks: str | None
    rework_count: int
    sla_breached: bool
    submitted_at: datetime
    done_at: datetime | None
    cancelled_at: datetime | None
    checklist_items: list[HousekeepingChecklistItemResponse]
    maintenance_tickets: list[HousekeepingMaintenanceTicketResponse]
    event_logs: list[HousekeepingEventLogResponse]


class HousekeepingRequestListResponse(BaseModel):
    requests: list[HousekeepingRequestResponse]
    total: int


class HousekeepingRequestStatusResponse(BaseModel):
    id: int
    status: str
    done_at: datetime | None
    cancelled_at: datetime | None
    inspected_at: datetime | None
    room_housekeeping_status: str | None = None
    maintenance_required: bool | None = None


class HousekeepingAssignRequest(BaseModel):
    assigned_to_user_id: int
    due_at: datetime | None = None
    priority: RequestPriorityLiteral | None = None


class HousekeepingChecklistUpdateRequest(BaseModel):
    is_completed: bool = True


class HousekeepingSubmitRequest(BaseModel):
    remarks: str | None = Field(None, max_length=1000)
    delay_reason: str | None = Field(None, max_length=1000)
    photo_proof_url: str | None = Field(None, max_length=500)


class HousekeepingInspectRequest(BaseModel):
    decision: InspectionDecisionLiteral
    notes: str | None = Field(None, max_length=1000)
    reassign_to_user_id: int | None = None


class HousekeepingBlockRequest(BaseModel):
    issue_type: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=1000)
    photo_proof_url: str | None = Field(None, max_length=500)


class HousekeepingResolveTicketRequest(BaseModel):
    ticket_id: int
    resolution_note: str | None = Field(None, max_length=1000)


class HousekeepingDailySummaryResponse(BaseModel):
    date: date
    rooms_cleaned: int
    avg_cleaning_minutes: float
    pending_tasks: int
    rework_count: int
    blocked_tasks: int


class HousekeepingPendingListResponse(BaseModel):
    total: int
    requests: list[HousekeepingRequestResponse]


class HousekeepingStaffPerformanceItem(BaseModel):
    staff_user_id: int
    staff_name: str
    assigned_count: int
    started_count: int
    submitted_for_inspection_count: int
    approved_ready_count: int
    avg_cleaning_minutes: float


class HousekeepingStaffPerformanceResponse(BaseModel):
    date: date
    staff: list[HousekeepingStaffPerformanceItem]


class GenericMessageResponse(BaseModel):
    message: str
