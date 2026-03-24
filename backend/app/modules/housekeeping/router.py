"""Housekeeping router."""
from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_restaurant_id,
    get_current_room_session,
    get_db,
    require_privilege,
    require_room_session_privilege,
    require_roles,
)
from app.modules.housekeeping import service
from app.modules.housekeeping.schemas import (
    GenericMessageResponse,
    HousekeepingAssignRequest,
    HousekeepingBlockRequest,
    HousekeepingChecklistUpdateRequest,
    HousekeepingDailySummaryResponse,
    HousekeepingInspectRequest,
    HousekeepingManualTaskCreateRequest,
    HousekeepingPendingListResponse,
    HousekeepingRequestCreateRequest,
    HousekeepingRequestCreateResponse,
    HousekeepingRequestListResponse,
    HousekeepingRequestResponse,
    HousekeepingRequestStatusResponse,
    HousekeepingResolveTicketRequest,
    HousekeepingStaffPerformanceResponse,
    HousekeepingSubmitRequest,
)
from app.modules.room_sessions.model import RoomSession
from app.modules.users.model import User

router = APIRouter()

_HK_ROLES = ("owner", "admin", "housekeeper")
_SUPERVISOR_ROLES = ("owner", "admin")


@router.post("", response_model=HousekeepingRequestCreateResponse, status_code=201)
def submit_housekeeping_request(
    payload: HousekeepingRequestCreateRequest,
    session: RoomSession = Depends(get_current_room_session),
    _=Depends(require_room_session_privilege("HOUSEKEEPING")),
    db: Session = Depends(get_db),
) -> HousekeepingRequestCreateResponse:
    return service.submit_request(db, session, payload)


@router.get("/my-requests", response_model=HousekeepingRequestListResponse)
def list_my_requests(
    session: RoomSession = Depends(get_current_room_session),
    _=Depends(require_room_session_privilege("HOUSEKEEPING")),
    db: Session = Depends(get_db),
) -> HousekeepingRequestListResponse:
    return service.list_my_requests(db, session)


@router.patch("/{request_id}/cancel", response_model=HousekeepingRequestStatusResponse)
def cancel_my_request(
    request_id: int,
    session: RoomSession = Depends(get_current_room_session),
    _=Depends(require_room_session_privilege("HOUSEKEEPING")),
    db: Session = Depends(get_db),
) -> HousekeepingRequestStatusResponse:
    return service.cancel_my_request(db, request_id=request_id, room_session=session)


@router.post("/manual", response_model=HousekeepingRequestCreateResponse, status_code=201)
def create_manual_task(
    payload: HousekeepingManualTaskCreateRequest,
    current_user: User = Depends(require_roles(*_SUPERVISOR_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestCreateResponse:
    return service.create_manual_task(
        db,
        restaurant_id=restaurant_id,
        actor_user=current_user,
        room_id=payload.room_id,
        request_type=payload.request_type,
        message=payload.message,
        priority=payload.priority,
        due_at=payload.due_at,
    )


@router.get("/reports/daily-summary", response_model=HousekeepingDailySummaryResponse)
def get_daily_summary(
    date_value: date | None = Query(None, description="YYYY-MM-DD"),
    _=Depends(require_roles(*_SUPERVISOR_ROLES)),
    __=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingDailySummaryResponse:
    report_date = date_value or datetime.now(UTC).date()
    return service.get_daily_summary(db, restaurant_id=restaurant_id, report_date=report_date)


@router.get("/reports/pending-list", response_model=HousekeepingPendingListResponse)
def get_pending_list(
    _=Depends(require_roles(*_SUPERVISOR_ROLES)),
    __=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingPendingListResponse:
    return service.get_pending_list(db, restaurant_id=restaurant_id)


@router.get("/reports/staff-performance", response_model=HousekeepingStaffPerformanceResponse)
def get_staff_performance(
    date_value: date | None = Query(None, description="YYYY-MM-DD"),
    _=Depends(require_roles(*_SUPERVISOR_ROLES)),
    __=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingStaffPerformanceResponse:
    report_date = date_value or datetime.now(UTC).date()
    return service.get_staff_performance(db, restaurant_id=restaurant_id, report_date=report_date)


@router.get("/history", response_model=HousekeepingRequestListResponse)
def list_request_history(
    room_number: Optional[str] = Query(None, description="Filter by room number"),
    request_type: Optional[str] = Query(None, description="Filter by request type"),
    current_user=Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestListResponse:
    return service.list_requests(
        db,
        restaurant_id,
        status="ready",
        room_number=room_number,
        request_type=request_type,
    )


@router.get("", response_model=HousekeepingRequestListResponse)
def list_requests(
    status: Optional[str] = Query(None),
    room_number: Optional[str] = Query(None, description="Filter by room number"),
    request_type: Optional[str] = Query(None, description="Filter by request type"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    assigned_to_user_id: Optional[int] = Query(None, description="Filter by assignee"),
    current_user=Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestListResponse:
    return service.list_requests(
        db,
        restaurant_id,
        status=status,
        room_number=room_number,
        request_type=request_type,
        priority=priority,
        assigned_to_user_id=assigned_to_user_id,
    )


@router.get("/{request_id}", response_model=HousekeepingRequestResponse)
def get_request(
    request_id: int,
    current_user=Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestResponse:
    return service.get_request(db, request_id, restaurant_id)


@router.patch("/{request_id}/assign", response_model=HousekeepingRequestStatusResponse)
def assign_request(
    request_id: int,
    payload: HousekeepingAssignRequest,
    current_user: User = Depends(require_roles(*_SUPERVISOR_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestStatusResponse:
    return service.assign_request(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
        actor_user=current_user,
        payload=payload,
    )


@router.patch("/{request_id}/claim", response_model=HousekeepingRequestStatusResponse)
def claim_request(
    request_id: int,
    current_user: User = Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestStatusResponse:
    return service.claim_request(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
        actor_user=current_user,
    )


@router.patch("/{request_id}/start", response_model=HousekeepingRequestStatusResponse)
def start_request(
    request_id: int,
    current_user: User = Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestStatusResponse:
    return service.start_request(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
        actor_user=current_user,
    )


@router.patch("/{request_id}/checklist/{item_id}", response_model=HousekeepingRequestResponse)
def update_checklist_item(
    request_id: int,
    item_id: int,
    payload: HousekeepingChecklistUpdateRequest,
    current_user: User = Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestResponse:
    return service.update_checklist_item_status(
        db,
        request_id=request_id,
        checklist_item_id=item_id,
        restaurant_id=restaurant_id,
        actor_user=current_user,
        is_completed=payload.is_completed,
    )


@router.patch("/{request_id}/submit", response_model=HousekeepingRequestStatusResponse)
def submit_request_for_inspection(
    request_id: int,
    payload: HousekeepingSubmitRequest,
    current_user: User = Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestStatusResponse:
    return service.submit_for_inspection(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
        actor_user=current_user,
        payload=payload,
    )


@router.patch("/{request_id}/inspect", response_model=HousekeepingRequestStatusResponse)
def inspect_request(
    request_id: int,
    payload: HousekeepingInspectRequest,
    current_user: User = Depends(require_roles(*_SUPERVISOR_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestStatusResponse:
    return service.inspect_request(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
        actor_user=current_user,
        payload=payload,
    )


@router.patch("/{request_id}/block", response_model=HousekeepingRequestResponse)
def block_request(
    request_id: int,
    payload: HousekeepingBlockRequest,
    current_user: User = Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestResponse:
    return service.block_request_for_issue(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
        actor_user=current_user,
        payload=payload,
    )


@router.patch("/{request_id}/resolve-ticket", response_model=HousekeepingRequestResponse)
def resolve_maintenance_ticket(
    request_id: int,
    payload: HousekeepingResolveTicketRequest,
    current_user: User = Depends(require_roles(*_SUPERVISOR_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestResponse:
    return service.resolve_maintenance_ticket(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
        actor_user=current_user,
        payload=payload,
    )


@router.patch("/{request_id}/done", response_model=HousekeepingRequestStatusResponse)
def mark_request_done(
    request_id: int,
    current_user: User = Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestStatusResponse:
    return service.mark_done(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
        actor_user=current_user,
    )


@router.delete("/{request_id}", response_model=GenericMessageResponse)
def delete_request(
    request_id: int,
    _=Depends(require_roles(*_HK_ROLES)),
    __=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> GenericMessageResponse:
    service.delete_request(db, request_id=request_id, restaurant_id=restaurant_id)
    return GenericMessageResponse(message="Housekeeping request deleted.")
