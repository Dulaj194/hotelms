"""Business logic for the housekeeping module.

Responsibilities:
- Derive room/restaurant context from validated room session (guest flow).
- Enforce tenant isolation on all staff management operations.
- Centralize status transition logic (pending → done).
- Never accept restaurant_id from client body for protected operations.
"""
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.housekeeping import repository
from app.modules.housekeeping.model import HousekeepingRequest
from app.modules.housekeeping.schemas import (
    HousekeepingRequestCreateRequest,
    HousekeepingRequestCreateResponse,
    HousekeepingRequestListResponse,
    HousekeepingRequestResponse,
    HousekeepingRequestStatusResponse,
)
from app.modules.room_sessions.model import RoomSession


# ── Internal helper ───────────────────────────────────────────────────────────

def _to_response(req: HousekeepingRequest) -> HousekeepingRequestResponse:
    return HousekeepingRequestResponse(
        id=req.id,
        room_id=req.room_id,
        room_number=req.room_number_snapshot,
        guest_name=req.guest_name,
        request_type=req.request_type,
        message=req.message,
        status=req.status,
        submitted_at=req.submitted_at,
        done_at=req.done_at,
    )


# ── Guest submission ──────────────────────────────────────────────────────────

def submit_request(
    db: Session,
    room_session: RoomSession,
    payload: HousekeepingRequestCreateRequest,
) -> HousekeepingRequestCreateResponse:
    """Create a housekeeping request from a room guest.

    SECURITY: restaurant_id, room_id, and room_number all come from the
    validated room session object — not from the request body.
    """
    req = repository.create_housekeeping_request(
        db,
        restaurant_id=room_session.restaurant_id,
        room_id=room_session.room_id,
        room_session_id=room_session.session_id,
        room_number_snapshot=room_session.room_number_snapshot,
        guest_name=payload.guest_name,
        request_type=payload.request_type,
        message=payload.message,
    )
    return HousekeepingRequestCreateResponse(
        id=req.id,
        room_number=req.room_number_snapshot,
        request_type=req.request_type,
        message=req.message,
        status=req.status,
        submitted_at=req.submitted_at,
    )


# ── Staff / admin management ──────────────────────────────────────────────────

def list_requests(
    db: Session,
    restaurant_id: int,
    *,
    status: str | None = None,
    room_number: str | None = None,
    request_type: str | None = None,
) -> HousekeepingRequestListResponse:
    """List housekeeping requests for a restaurant with optional filters."""
    reqs = repository.list_requests_by_restaurant(
        db,
        restaurant_id,
        status=status,
        room_number=room_number,
        request_type=request_type,
    )
    return HousekeepingRequestListResponse(
        requests=[_to_response(r) for r in reqs],
        total=len(reqs),
    )


def get_request(
    db: Session, request_id: int, restaurant_id: int
) -> HousekeepingRequestResponse:
    """Return a single request detail. Raises 404 if not found or wrong tenant."""
    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Housekeeping request not found.",
        )
    return _to_response(req)


def mark_done(
    db: Session, request_id: int, restaurant_id: int
) -> HousekeepingRequestStatusResponse:
    """Mark a pending request as done. Raises 404 or 400 appropriately."""
    req = repository.get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Housekeeping request not found.",
        )
    if req.status == "done":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request is already marked as done.",
        )
    done_at = datetime.now(UTC)
    updated = repository.mark_request_done(db, request_id, restaurant_id, done_at)
    return HousekeepingRequestStatusResponse(
        id=updated.id,
        status=updated.status,
        done_at=updated.done_at,
    )
