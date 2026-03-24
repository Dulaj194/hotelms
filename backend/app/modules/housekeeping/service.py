
"""Business logic for housekeeping tasks."""
from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.housekeeping import repository
from app.modules.housekeeping.model import (
    HousekeepingChecklistItem,
    HousekeepingEventLog,
    HousekeepingMaintenanceTicket,
    HousekeepingRequest,
    RequestPriority,
)
from app.modules.housekeeping.schemas import (
    HousekeepingAssignRequest,
    HousekeepingBlockRequest,
    HousekeepingDailySummaryResponse,
    HousekeepingInspectRequest,
    HousekeepingMaintenanceTicketResponse,
    HousekeepingPendingListResponse,
    HousekeepingRequestCreateRequest,
    HousekeepingRequestCreateResponse,
    HousekeepingRequestListResponse,
    HousekeepingRequestResponse,
    HousekeepingRequestStatusResponse,
    HousekeepingResolveTicketRequest,
    HousekeepingStaffPerformanceItem,
    HousekeepingStaffPerformanceResponse,
    HousekeepingSubmitRequest,
)
from app.modules.room_sessions.model import RoomSession
from app.modules.rooms import repository as room_repository
from app.modules.rooms.model import RoomHousekeepingStatus
from app.modules.users.model import User, UserRole

SUPERVISOR_ROLES = {"owner", "admin"}

CHECKLIST_TEMPLATES: dict[str, list[tuple[str, str, bool]]] = {
    "cleaning": [
        ("linen_change", "Linen / bed setup", True),
        ("bathroom_sanitize", "Bathroom sanitize", True),
        ("amenities_refill", "Amenities refill", True),
        ("dusting_floor", "Dusting + floor cleaning", True),
        ("bin_disposal", "Bin disposal", True),
        ("minibar_check", "Minibar / room inventory check", False),
    ],
    "towels": [
        ("linen_change", "Fresh towels / linen replacement", True),
        ("bathroom_sanitize", "Bathroom refresh", True),
        ("bin_disposal", "Bin disposal", True),
    ],
    "water": [
        ("amenities_refill", "Water bottles refill", True),
        ("room_check", "Quick room condition check", True),
    ],
    "maintenance": [
        ("issue_verify", "Issue verification completed", True),
    ],
    "other": [
        ("request_verify", "Request reviewed", True),
        ("room_refresh", "Basic room refresh", True),
    ],
}


def _normalize_status(value: str) -> str:
    if value == "pending":
        return "pending_assignment"
    if value == "done":
        return "ready"
    return value


def _is_supervisor(user: User) -> bool:
    return user.role.value in SUPERVISOR_ROLES


def _resolve_requested_for_at(payload: HousekeepingRequestCreateRequest) -> datetime | None:
    date_value = payload.request_date
    time_value = payload.request_time

    if (date_value is None) != (time_value is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both request_date and request_time are required together.",
        )
    if date_value is None or time_value is None:
        return None

    scheduled_time = time.fromisoformat(time_value)
    requested_for_at = datetime.combine(date_value, scheduled_time, tzinfo=UTC)
    if requested_for_at < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Requested date/time cannot be in the past.",
        )
    return requested_for_at


def _default_priority(request_type: str) -> str:
    if request_type == "maintenance":
        return RequestPriority.high.value
    if request_type == "water":
        return RequestPriority.normal.value
    return RequestPriority.normal.value


def _default_due_at(*, requested_for_at: datetime | None, priority: str) -> datetime:
    if requested_for_at is not None:
        return requested_for_at
    now = datetime.now(UTC)
    if priority == "high":
        return now + timedelta(minutes=30)
    if priority == "low":
        return now + timedelta(hours=4)
    return now + timedelta(hours=2)


def _to_checklist_response(item: HousekeepingChecklistItem):
    from app.modules.housekeeping.schemas import HousekeepingChecklistItemResponse

    return HousekeepingChecklistItemResponse(
        id=item.id,
        item_code=item.item_code,
        label=item.label,
        is_mandatory=item.is_mandatory,
        is_completed=item.is_completed,
        completed_at=item.completed_at,
        completed_by_user_id=item.completed_by_user_id,
    )


def _to_ticket_response(ticket: HousekeepingMaintenanceTicket) -> HousekeepingMaintenanceTicketResponse:
    return HousekeepingMaintenanceTicketResponse(
        id=ticket.id,
        issue_type=ticket.issue_type,
        description=ticket.description,
        photo_proof_url=ticket.photo_proof_url,
        status=ticket.status,
        created_by_user_id=ticket.created_by_user_id,
        resolved_by_user_id=ticket.resolved_by_user_id,
        created_at=ticket.created_at,
        resolved_at=ticket.resolved_at,
    )


def _to_event_response(event: HousekeepingEventLog):
    from app.modules.housekeeping.schemas import HousekeepingEventLogResponse

    return HousekeepingEventLogResponse(
        id=event.id,
        actor_user_id=event.actor_user_id,
        event_type=event.event_type,
        from_status=event.from_status,
        to_status=event.to_status,
        note=event.note,
        created_at=event.created_at,
    )


def _to_response(req: HousekeepingRequest) -> HousekeepingRequestResponse:
    status_value = _normalize_status(req.status)
    checklist = sorted(req.checklist_items, key=lambda x: x.id)
    tickets = sorted(req.maintenance_tickets, key=lambda x: x.id, reverse=True)
    events = sorted(req.event_logs, key=lambda x: x.id, reverse=True)
    return HousekeepingRequestResponse(
        id=req.id,
        room_id=req.room_id,
        room_number=req.room_number_snapshot,
        room_session_id=req.room_session_id,
        guest_name=req.guest_name,
        request_type=req.request_type,
        priority=req.priority,
        message=req.message,
        requested_for_at=req.requested_for_at,
        due_at=req.due_at,
        audio_url=req.audio_url,
        photo_proof_url=req.photo_proof_url,
        status=status_value,
        assigned_to_user_id=req.assigned_to_user_id,
        assigned_by_user_id=req.assigned_by_user_id,
        assigned_at=req.assigned_at,
        started_at=req.started_at,
        inspection_submitted_at=req.inspection_submitted_at,
        inspected_at=req.inspected_at,
        inspected_by_user_id=req.inspected_by_user_id,
        inspection_notes=req.inspection_notes,
        blocked_reason=req.blocked_reason,
        delay_reason=req.delay_reason,
        remarks=req.remarks,
        rework_count=req.rework_count,
        sla_breached=req.sla_breached,
        submitted_at=req.submitted_at,
        done_at=req.done_at,
        cancelled_at=req.cancelled_at,
        checklist_items=[_to_checklist_response(item) for item in checklist],
        maintenance_tickets=[_to_ticket_response(ticket) for ticket in tickets],
        event_logs=[_to_event_response(event) for event in events],
    )


def _to_status_response(
    req: HousekeepingRequest,
    *,
    room_housekeeping_status: str | None = None,
    maintenance_required: bool | None = None,
) -> HousekeepingRequestStatusResponse:
    return HousekeepingRequestStatusResponse(
        id=req.id,
        status=_normalize_status(req.status),
        done_at=req.done_at,
        cancelled_at=req.cancelled_at,
        inspected_at=req.inspected_at,
        room_housekeeping_status=room_housekeeping_status,
        maintenance_required=maintenance_required,
    )


def _set_room_status(
    db: Session,
    *,
    restaurant_id: int,
    room_id: int,
    housekeeping_status: str | None = None,
    maintenance_required: bool | None = None,
) -> tuple[str | None, bool | None]:
    room = room_repository.get_room_by_id_and_restaurant(db, room_id, restaurant_id)
    if room is None:
        return None, None
    updates: dict[str, object] = {}
    if housekeeping_status is not None:
        updates["housekeeping_status"] = housekeeping_status
    if maintenance_required is not None:
        updates["maintenance_required"] = maintenance_required
    if updates:
        room = room_repository.update_room_by_id(db, room_id, restaurant_id, updates)
    if room is None:
        return None, None
    return room.housekeeping_status, room.maintenance_required


def _append_event(
    db: Session,
    *,
    req: HousekeepingRequest,
    actor_user_id: int | None,
    event_type: str,
    from_status: str | None,
    to_status: str | None,
    note: str | None = None,
) -> None:
    repository.create_event_log(
        db,
        request_id=req.id,
        restaurant_id=req.restaurant_id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        note=note,
    )


def submit_request(
    db: Session,
    room_session: RoomSession,
    payload: HousekeepingRequestCreateRequest,
) -> HousekeepingRequestCreateResponse:
    requested_for_at = _resolve_requested_for_at(payload)
    priority = _default_priority(payload.request_type)
    due_at = _default_due_at(requested_for_at=requested_for_at, priority=priority)
    checklist_template = CHECKLIST_TEMPLATES.get(payload.request_type, CHECKLIST_TEMPLATES["other"])
    initial_status = "pending_assignment"

    req = repository.create_housekeeping_request(
        db,
        restaurant_id=room_session.restaurant_id,
        room_id=room_session.room_id,
        room_session_id=room_session.session_id,
        room_number_snapshot=room_session.room_number_snapshot,
        guest_name=payload.guest_name,
        request_type=payload.request_type,
        priority=priority,
        message=payload.message,
        requested_for_at=requested_for_at,
        due_at=due_at,
        audio_url=payload.audio_url,
        status=initial_status,
        checklist_items=checklist_template,
    )

    _append_event(
        db,
        req=req,
        actor_user_id=None,
        event_type="task_created",
        from_status=None,
        to_status=initial_status,
        note="Guest request created",
    )

    if payload.request_type == "maintenance":
        req = repository.get_request_by_id_and_restaurant(db, req.id, req.restaurant_id) or req
        req.status = "blocked"
        req.blocked_reason = "Guest maintenance issue reported"
        repository.save_request(db, req)
        repository.create_maintenance_ticket(
            db,
            request_id=req.id,
            restaurant_id=req.restaurant_id,
            room_id=req.room_id,
            issue_type="guest_reported_maintenance",
            description=payload.message,
            photo_proof_url=None,
            created_by_user_id=None,
        )
        _set_room_status(
            db,
            restaurant_id=req.restaurant_id,
            room_id=req.room_id,
            maintenance_required=True,
        )
        _append_event(
            db,
            req=req,
            actor_user_id=None,
            event_type="task_blocked",
            from_status="pending_assignment",
            to_status="blocked",
            note="Maintenance ticket auto-created from guest request",
        )
    else:
        _set_room_status(
            db,
            restaurant_id=req.restaurant_id,
            room_id=req.room_id,
            housekeeping_status=RoomHousekeepingStatus.vacant_dirty.value,
        )

    return HousekeepingRequestCreateResponse(
        id=req.id,
        room_number=req.room_number_snapshot,
        request_type=req.request_type,
        message=req.message,
        priority=req.priority,
        requested_for_at=req.requested_for_at,
        due_at=req.due_at,
        audio_url=req.audio_url,
        status=_normalize_status(req.status),
        submitted_at=req.submitted_at,
    )


def list_my_requests(
    db: Session,
    room_session: RoomSession,
) -> HousekeepingRequestListResponse:
    reqs = repository.list_requests_by_session(
        db,
        restaurant_id=room_session.restaurant_id,
        room_session_id=room_session.session_id,
    )
    return HousekeepingRequestListResponse(requests=[_to_response(r) for r in reqs], total=len(reqs))


def cancel_my_request(
    db: Session,
    *,
    request_id: int,
    room_session: RoomSession,
) -> HousekeepingRequestStatusResponse:
    req = repository.get_request_by_id_and_session(
        db,
        request_id=request_id,
        restaurant_id=room_session.restaurant_id,
        room_session_id=room_session.session_id,
    )
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping request not found.")

    current_status = _normalize_status(req.status)
    if current_status not in {"pending_assignment", "assigned"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only unstarted requests can be cancelled (current: {current_status}).",
        )

    previous_status = req.status
    req.status = "cancelled"
    req.cancelled_at = datetime.now(UTC)
    req = repository.save_request(db, req)
    _append_event(
        db,
        req=req,
        actor_user_id=None,
        event_type="task_cancelled",
        from_status=_normalize_status(previous_status),
        to_status="cancelled",
        note="Cancelled by guest",
    )
    return _to_status_response(req)


def list_requests(
    db: Session,
    restaurant_id: int,
    *,
    status: str | None = None,
    room_number: str | None = None,
    request_type: str | None = None,
    priority: str | None = None,
    assigned_to_user_id: int | None = None,
) -> HousekeepingRequestListResponse:
    reqs = repository.list_requests_by_restaurant(
        db,
        restaurant_id,
        status=status,
        room_number=room_number,
        request_type=request_type,
        priority=priority,
        assigned_to_user_id=assigned_to_user_id,
    )
    return HousekeepingRequestListResponse(requests=[_to_response(r) for r in reqs], total=len(reqs))


def get_request(
    db: Session,
    request_id: int,
    restaurant_id: int,
) -> HousekeepingRequestResponse:
    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping request not found.")
    return _to_response(req)


def assign_request(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    actor_user: User,
    payload: HousekeepingAssignRequest,
) -> HousekeepingRequestStatusResponse:
    if not _is_supervisor(actor_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor approval required.")

    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping request not found.")

    current_status = _normalize_status(req.status)
    if current_status not in {"pending_assignment", "rework_required", "assigned"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task cannot be assigned from status '{current_status}'.",
        )

    previous_status = current_status
    req.assigned_to_user_id = payload.assigned_to_user_id
    req.assigned_by_user_id = actor_user.id
    req.assigned_at = datetime.now(UTC)
    req.status = "assigned"
    if payload.due_at is not None:
        req.due_at = payload.due_at
    if payload.priority is not None:
        req.priority = payload.priority

    req = repository.save_request(db, req)
    room_status, maintenance_required = _set_room_status(
        db,
        restaurant_id=restaurant_id,
        room_id=req.room_id,
        housekeeping_status=RoomHousekeepingStatus.assigned.value,
    )
    _append_event(
        db,
        req=req,
        actor_user_id=actor_user.id,
        event_type="task_assigned",
        from_status=previous_status,
        to_status="assigned",
        note=f"Assigned to user #{payload.assigned_to_user_id}",
    )
    return _to_status_response(req, room_housekeeping_status=room_status, maintenance_required=maintenance_required)


def claim_request(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    actor_user: User,
) -> HousekeepingRequestStatusResponse:
    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping request not found.")

    current_status = _normalize_status(req.status)
    if current_status not in {"pending_assignment", "assigned", "rework_required"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task cannot be claimed from status '{current_status}'.",
        )
    if req.assigned_to_user_id is not None and req.assigned_to_user_id != actor_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task is already assigned to another staff member.",
        )

    previous_status = current_status
    req.assigned_to_user_id = actor_user.id
    req.assigned_at = req.assigned_at or datetime.now(UTC)
    req.status = "assigned"
    req = repository.save_request(db, req)
    room_status, maintenance_required = _set_room_status(
        db,
        restaurant_id=restaurant_id,
        room_id=req.room_id,
        housekeeping_status=RoomHousekeepingStatus.assigned.value,
    )
    _append_event(
        db,
        req=req,
        actor_user_id=actor_user.id,
        event_type="task_claimed",
        from_status=previous_status,
        to_status="assigned",
        note="Self-claimed by housekeeper",
    )
    return _to_status_response(req, room_housekeeping_status=room_status, maintenance_required=maintenance_required)


def start_request(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    actor_user: User,
) -> HousekeepingRequestStatusResponse:
    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping request not found.")

    current_status = _normalize_status(req.status)
    if current_status not in {"assigned", "rework_required"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task cannot be started from status '{current_status}'.",
        )
    if req.assigned_to_user_id is not None and req.assigned_to_user_id != actor_user.id and not _is_supervisor(actor_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only assigned staff can start this task.")

    previous_status = current_status
    req.status = "in_progress"
    req.started_at = datetime.now(UTC)
    req = repository.save_request(db, req)
    room_status, maintenance_required = _set_room_status(
        db,
        restaurant_id=restaurant_id,
        room_id=req.room_id,
        housekeeping_status=RoomHousekeepingStatus.in_progress.value,
    )
    _append_event(
        db,
        req=req,
        actor_user_id=actor_user.id,
        event_type="task_started",
        from_status=previous_status,
        to_status="in_progress",
    )
    return _to_status_response(req, room_housekeeping_status=room_status, maintenance_required=maintenance_required)


def update_checklist_item_status(
    db: Session,
    *,
    request_id: int,
    checklist_item_id: int,
    restaurant_id: int,
    actor_user: User,
    is_completed: bool,
) -> HousekeepingRequestResponse:
    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping request not found.")
    current_status = _normalize_status(req.status)
    if current_status not in {"in_progress", "rework_required"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Checklist can only be updated in active execution states (current: {current_status}).",
        )

    item = repository.get_checklist_item_for_request(
        db,
        request_id=request_id,
        item_id=checklist_item_id,
        restaurant_id=restaurant_id,
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist item not found.")

    item.is_completed = is_completed
    if is_completed:
        item.completed_at = datetime.now(UTC)
        item.completed_by_user_id = actor_user.id
    else:
        item.completed_at = None
        item.completed_by_user_id = None
    db.add(item)
    db.commit()
    db.refresh(item)

    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id) or req
    _append_event(
        db,
        req=req,
        actor_user_id=actor_user.id,
        event_type="checklist_item_updated",
        from_status=current_status,
        to_status=current_status,
        note=f"Checklist item #{checklist_item_id} set to {is_completed}",
    )
    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id) or req
    return _to_response(req)


def submit_for_inspection(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    actor_user: User,
    payload: HousekeepingSubmitRequest,
) -> HousekeepingRequestStatusResponse:
    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping request not found.")

    current_status = _normalize_status(req.status)
    if current_status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task can only be submitted from in_progress (current: {current_status}).",
        )
    if req.assigned_to_user_id is not None and req.assigned_to_user_id != actor_user.id and not _is_supervisor(actor_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only assigned staff can submit this task.")

    incomplete_count = repository.count_incomplete_mandatory_checklist_items(db, request_id=req.id)
    if incomplete_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Checklist incomplete. {incomplete_count} mandatory item(s) remaining.",
        )

    previous_status = current_status
    now_utc = datetime.now(UTC)
    req.status = "inspection"
    req.inspection_submitted_at = now_utc
    req.remarks = payload.remarks
    req.delay_reason = payload.delay_reason
    if payload.photo_proof_url:
        req.photo_proof_url = payload.photo_proof_url
    if req.due_at and now_utc > req.due_at:
        req.sla_breached = True

    req = repository.save_request(db, req)
    room_status, maintenance_required = _set_room_status(
        db,
        restaurant_id=restaurant_id,
        room_id=req.room_id,
        housekeeping_status=RoomHousekeepingStatus.inspection.value,
    )
    _append_event(
        db,
        req=req,
        actor_user_id=actor_user.id,
        event_type="task_submitted_for_inspection",
        from_status=previous_status,
        to_status="inspection",
        note=payload.remarks,
    )
    return _to_status_response(req, room_housekeeping_status=room_status, maintenance_required=maintenance_required)


def inspect_request(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    actor_user: User,
    payload: HousekeepingInspectRequest,
) -> HousekeepingRequestStatusResponse:
    if not _is_supervisor(actor_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor approval required.")

    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping request not found.")

    current_status = _normalize_status(req.status)
    if current_status != "inspection":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Inspection can only be performed from inspection status (current: {current_status}).",
        )

    now_utc = datetime.now(UTC)
    previous_status = current_status
    req.inspected_at = now_utc
    req.inspected_by_user_id = actor_user.id
    req.inspection_notes = payload.notes

    if payload.decision == "pass":
        req.status = "ready"
        req.done_at = now_utc
        req = repository.save_request(db, req)
        room_status, maintenance_required = _set_room_status(
            db,
            restaurant_id=restaurant_id,
            room_id=req.room_id,
            housekeeping_status=RoomHousekeepingStatus.ready.value,
        )
        _append_event(
            db,
            req=req,
            actor_user_id=actor_user.id,
            event_type="inspection_passed",
            from_status=previous_status,
            to_status="ready",
            note=payload.notes,
        )
        return _to_status_response(req, room_housekeeping_status=room_status, maintenance_required=maintenance_required)

    req.status = "rework_required"
    req.rework_count += 1
    if payload.reassign_to_user_id is not None:
        req.assigned_to_user_id = payload.reassign_to_user_id
        req.assigned_by_user_id = actor_user.id
        req.assigned_at = now_utc
    req = repository.save_request(db, req)
    room_status, maintenance_required = _set_room_status(
        db,
        restaurant_id=restaurant_id,
        room_id=req.room_id,
        housekeeping_status=RoomHousekeepingStatus.assigned.value,
    )
    _append_event(
        db,
        req=req,
        actor_user_id=actor_user.id,
        event_type="inspection_failed",
        from_status=previous_status,
        to_status="rework_required",
        note=payload.notes,
    )
    return _to_status_response(req, room_housekeeping_status=room_status, maintenance_required=maintenance_required)


def block_request_for_issue(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    actor_user: User,
    payload: HousekeepingBlockRequest,
) -> HousekeepingRequestResponse:
    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping request not found.")

    current_status = _normalize_status(req.status)
    if current_status in {"ready", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot block closed tasks.")

    previous_status = current_status
    req.status = "blocked"
    req.blocked_reason = payload.description
    req = repository.save_request(db, req)
    repository.create_maintenance_ticket(
        db,
        request_id=req.id,
        restaurant_id=req.restaurant_id,
        room_id=req.room_id,
        issue_type=payload.issue_type,
        description=payload.description,
        photo_proof_url=payload.photo_proof_url,
        created_by_user_id=actor_user.id,
    )
    _set_room_status(
        db,
        restaurant_id=restaurant_id,
        room_id=req.room_id,
        maintenance_required=True,
    )
    _append_event(
        db,
        req=req,
        actor_user_id=actor_user.id,
        event_type="task_blocked",
        from_status=previous_status,
        to_status="blocked",
        note=payload.description,
    )
    req = repository.get_request_by_id_and_restaurant(db, req.id, req.restaurant_id) or req
    return _to_response(req)


def resolve_maintenance_ticket(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    actor_user: User,
    payload: HousekeepingResolveTicketRequest,
) -> HousekeepingRequestResponse:
    if not _is_supervisor(actor_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor approval required.")

    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping request not found.")

    ticket = repository.get_maintenance_ticket(
        db,
        ticket_id=payload.ticket_id,
        request_id=request_id,
        restaurant_id=restaurant_id,
    )
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance ticket not found.")
    if ticket.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maintenance ticket already resolved.")

    now_utc = datetime.now(UTC)
    ticket.status = "resolved"
    ticket.resolved_at = now_utc
    ticket.resolved_by_user_id = actor_user.id
    repository.save_maintenance_ticket(db, ticket)

    previous_status = _normalize_status(req.status)
    if previous_status == "blocked":
        req.status = "assigned" if req.assigned_to_user_id else "pending_assignment"
        req.blocked_reason = None
        req = repository.save_request(db, req)

    room_has_open_ticket = repository.has_open_maintenance_ticket_for_room(
        db,
        restaurant_id=restaurant_id,
        room_id=req.room_id,
    )
    _set_room_status(
        db,
        restaurant_id=restaurant_id,
        room_id=req.room_id,
        maintenance_required=room_has_open_ticket,
    )
    _append_event(
        db,
        req=req,
        actor_user_id=actor_user.id,
        event_type="maintenance_resolved",
        from_status=previous_status,
        to_status=_normalize_status(req.status),
        note=payload.resolution_note,
    )
    req = repository.get_request_by_id_and_restaurant(db, req.id, req.restaurant_id) or req
    return _to_response(req)


def mark_done(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    actor_user: User,
) -> HousekeepingRequestStatusResponse:
    """Legacy endpoint compatibility.

    Old UI used /done directly. We now map it to submit-for-inspection so that
    supervisor approval remains mandatory.
    """
    return submit_for_inspection(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
        actor_user=actor_user,
        payload=HousekeepingSubmitRequest(),
    )


def delete_request(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
) -> None:
    deleted = repository.delete_request_by_restaurant(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Housekeeping request not found.")


def create_manual_task(
    db: Session,
    *,
    restaurant_id: int,
    actor_user: User,
    room_id: int,
    request_type: str,
    message: str,
    priority: str,
    due_at: datetime | None,
) -> HousekeepingRequestCreateResponse:
    if not _is_supervisor(actor_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor approval required.")

    checklist_template = CHECKLIST_TEMPLATES.get(request_type, CHECKLIST_TEMPLATES["other"])
    effective_due_at = due_at or _default_due_at(requested_for_at=None, priority=priority)

    room = room_repository.get_room_by_id_and_restaurant(db, room_id, restaurant_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")

    req = repository.create_housekeeping_request(
        db,
        restaurant_id=restaurant_id,
        room_id=room_id,
        room_session_id=None,
        room_number_snapshot=room.room_number,
        guest_name=None,
        request_type=request_type,
        priority=priority,
        message=message,
        requested_for_at=None,
        due_at=effective_due_at,
        audio_url=None,
        status="pending_assignment",
        checklist_items=checklist_template,
    )
    _append_event(
        db,
        req=req,
        actor_user_id=actor_user.id,
        event_type="task_created_manual",
        from_status=None,
        to_status="pending_assignment",
        note="Manual task created by supervisor",
    )
    _set_room_status(
        db,
        restaurant_id=restaurant_id,
        room_id=room_id,
        housekeeping_status=RoomHousekeepingStatus.vacant_dirty.value,
    )
    return HousekeepingRequestCreateResponse(
        id=req.id,
        room_number=req.room_number_snapshot,
        request_type=req.request_type,
        message=req.message,
        priority=req.priority,
        requested_for_at=req.requested_for_at,
        due_at=req.due_at,
        audio_url=req.audio_url,
        status=_normalize_status(req.status),
        submitted_at=req.submitted_at,
    )


def get_daily_summary(
    db: Session,
    *,
    restaurant_id: int,
    report_date: date,
) -> HousekeepingDailySummaryResponse:
    from_dt = datetime.combine(report_date, time.min)
    to_dt = datetime.combine(report_date, time.max)
    rows = repository.list_requests_by_date_range(
        db,
        restaurant_id=restaurant_id,
        from_dt=from_dt,
        to_dt=to_dt,
    )
    pending_rows = repository.list_pending_requests(db, restaurant_id=restaurant_id)

    rooms_cleaned = 0
    blocked_tasks = 0
    rework_count = 0
    durations: list[float] = []

    for row in rows:
        normalized_status = _normalize_status(row.status)
        if normalized_status == "ready":
            rooms_cleaned += 1
            if row.started_at and row.done_at:
                delta = row.done_at - row.started_at
                durations.append(max(delta.total_seconds() / 60, 0))
        if normalized_status == "blocked":
            blocked_tasks += 1
        rework_count += int(row.rework_count or 0)

    avg_cleaning_minutes = round(sum(durations) / len(durations), 2) if durations else 0.0
    pending_tasks = len(pending_rows)

    return HousekeepingDailySummaryResponse(
        date=report_date,
        rooms_cleaned=rooms_cleaned,
        avg_cleaning_minutes=avg_cleaning_minutes,
        pending_tasks=pending_tasks,
        rework_count=rework_count,
        blocked_tasks=blocked_tasks,
    )


def get_pending_list(
    db: Session,
    *,
    restaurant_id: int,
) -> HousekeepingPendingListResponse:
    pending = repository.list_pending_requests(db, restaurant_id=restaurant_id)
    return HousekeepingPendingListResponse(
        total=len(pending),
        requests=[_to_response(item) for item in pending],
    )


def get_staff_performance(
    db: Session,
    *,
    restaurant_id: int,
    report_date: date,
) -> HousekeepingStaffPerformanceResponse:
    from_dt = datetime.combine(report_date, time.min)
    to_dt = datetime.combine(report_date, time.max)
    rows = repository.list_requests_by_date_range(
        db,
        restaurant_id=restaurant_id,
        from_dt=from_dt,
        to_dt=to_dt,
    )

    staff_users = (
        db.query(User)
        .filter(
            User.restaurant_id == restaurant_id,
            User.role == UserRole.housekeeper,
        )
        .all()
    )
    user_name_map = {u.id: u.full_name for u in staff_users}
    grouped: dict[int, list[HousekeepingRequest]] = defaultdict(list)
    for row in rows:
        if row.assigned_to_user_id is not None:
            grouped[row.assigned_to_user_id].append(row)

    staff_response: list[HousekeepingStaffPerformanceItem] = []
    for user_id, full_name in user_name_map.items():
        items = grouped.get(user_id, [])
        assigned_count = len(items)
        started_count = sum(1 for item in items if item.started_at is not None)
        submitted_for_inspection_count = sum(1 for item in items if item.inspection_submitted_at is not None)
        approved_ready_count = sum(1 for item in items if _normalize_status(item.status) == "ready")

        durations: list[float] = []
        for item in items:
            if item.started_at and item.done_at:
                durations.append(max((item.done_at - item.started_at).total_seconds() / 60, 0))
        avg_cleaning_minutes = round(sum(durations) / len(durations), 2) if durations else 0.0

        staff_response.append(
            HousekeepingStaffPerformanceItem(
                staff_user_id=user_id,
                staff_name=full_name,
                assigned_count=assigned_count,
                started_count=started_count,
                submitted_for_inspection_count=submitted_for_inspection_count,
                approved_ready_count=approved_ready_count,
                avg_cleaning_minutes=avg_cleaning_minutes,
            )
        )

    staff_response.sort(key=lambda item: item.staff_name.lower())
    return HousekeepingStaffPerformanceResponse(date=report_date, staff=staff_response)
