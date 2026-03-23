"""Housekeeping router.

Route groups:
  POST   /housekeeping             — guest: submit request (X-Room-Session)
  GET    /housekeeping/my-requests — guest: list own session requests
  PATCH  /housekeeping/{id}/cancel — guest: cancel own pending request
  GET    /housekeeping             — staff: list requests (Bearer, admin/housekeeper)
  GET    /housekeeping/history     — staff: list done requests (Bearer, admin/housekeeper)
  GET    /housekeeping/{id}        — staff: get request detail (Bearer, admin/housekeeper)
  PATCH  /housekeeping/{id}/done   — staff: mark as done (Bearer, admin/housekeeper)
  DELETE /housekeeping/{id}        — staff: delete request

IMPORTANT: /history is registered before /{request_id} to avoid path shadowing.
"""
from __future__ import annotations

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
    HousekeepingRequestCreateRequest,
    HousekeepingRequestCreateResponse,
    HousekeepingRequestListResponse,
    HousekeepingRequestResponse,
    HousekeepingRequestStatusResponse,
)
from app.modules.room_sessions.model import RoomSession

router = APIRouter()

# Roles permitted to manage housekeeping requests
_HK_ROLES = ("owner", "admin", "housekeeper")


# ── Guest submission ──────────────────────────────────────────────────────────

@router.post("", response_model=HousekeepingRequestCreateResponse, status_code=201)
def submit_housekeeping_request(
    payload: HousekeepingRequestCreateRequest,
    session: RoomSession = Depends(get_current_room_session),
    _=Depends(require_room_session_privilege("HOUSEKEEPING")),
    db: Session = Depends(get_db),
) -> HousekeepingRequestCreateResponse:
    """Submit a housekeeping or service request from the guest's room.

    Requires X-Room-Session header with a valid signed room session token.
    Room and restaurant context are derived entirely from the validated session —
    client-supplied tenant identifiers are ignored.
    """
    return service.submit_request(db, session, payload)


@router.get("/my-requests", response_model=HousekeepingRequestListResponse)
def list_my_requests(
    session: RoomSession = Depends(get_current_room_session),
    _=Depends(require_room_session_privilege("HOUSEKEEPING")),
    db: Session = Depends(get_db),
) -> HousekeepingRequestListResponse:
    """List housekeeping requests created from the current room session."""
    return service.list_my_requests(db, session)


@router.patch("/{request_id}/cancel", response_model=HousekeepingRequestStatusResponse)
def cancel_my_request(
    request_id: int,
    session: RoomSession = Depends(get_current_room_session),
    _=Depends(require_room_session_privilege("HOUSEKEEPING")),
    db: Session = Depends(get_db),
) -> HousekeepingRequestStatusResponse:
    """Cancel a pending housekeeping request from the current room session."""
    return service.cancel_my_request(db, request_id=request_id, room_session=session)


# ── Staff / admin — /history MUST come before /{request_id} ──────────────────

@router.get("/history", response_model=HousekeepingRequestListResponse)
def list_request_history(
    room_number: Optional[str] = Query(None, description="Filter by room number"),
    request_type: Optional[str] = Query(None, description="Filter by request type"),
    current_user=Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestListResponse:
    """List completed (done) housekeeping requests for this restaurant."""
    return service.list_requests(
        db, restaurant_id, status="done", room_number=room_number, request_type=request_type
    )


@router.get("", response_model=HousekeepingRequestListResponse)
def list_requests(
    status: Optional[str] = Query(None, pattern="^(pending|done|cancelled)$"),
    room_number: Optional[str] = Query(None, description="Filter by room number"),
    request_type: Optional[str] = Query(None, description="Filter by request type"),
    current_user=Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestListResponse:
    """List housekeeping requests for this restaurant.

    Optional query filters: status (pending|done), room_number, request_type.
    Omitting status returns all requests.
    """
    return service.list_requests(
        db, restaurant_id, status=status, room_number=room_number, request_type=request_type
    )


@router.get("/{request_id}", response_model=HousekeepingRequestResponse)
def get_request(
    request_id: int,
    current_user=Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestResponse:
    """Get a single housekeeping request by ID. Tenant-scoped."""
    return service.get_request(db, request_id, restaurant_id)


@router.patch("/{request_id}/done", response_model=HousekeepingRequestStatusResponse)
def mark_request_done(
    request_id: int,
    current_user=Depends(require_roles(*_HK_ROLES)),
    _=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> HousekeepingRequestStatusResponse:
    """Mark a housekeeping request as done. Sets done_at timestamp."""
    return service.mark_done(db, request_id, restaurant_id)


@router.delete("/{request_id}", response_model=GenericMessageResponse)
def delete_request(
    request_id: int,
    _=Depends(require_roles(*_HK_ROLES)),
    __=Depends(require_privilege("HOUSEKEEPING")),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
) -> GenericMessageResponse:
    """Delete a housekeeping request (admin/housekeeper)."""
    service.delete_request(db, request_id=request_id, restaurant_id=restaurant_id)
    return GenericMessageResponse(message="Housekeeping request deleted.")
