"""Repository layer for housekeeping_requests.

All methods are explicit and tenant-scoped.
No unsafe generic queries (get_by_id, list_all) are provided.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.modules.housekeeping.model import HousekeepingRequest


def create_housekeeping_request(
    db: Session,
    *,
    restaurant_id: int,
    room_id: int,
    room_session_id: str | None,
    room_number_snapshot: str,
    guest_name: str | None,
    request_type: str,
    message: str,
    requested_for_at: datetime | None,
    audio_url: str | None,
) -> HousekeepingRequest:
    """Persist a new housekeeping request with status=pending."""
    req = HousekeepingRequest(
        restaurant_id=restaurant_id,
        room_id=room_id,
        room_session_id=room_session_id,
        room_number_snapshot=room_number_snapshot,
        guest_name=guest_name,
        request_type=request_type,
        message=message,
        requested_for_at=requested_for_at,
        audio_url=audio_url,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def get_request_by_id_and_restaurant(
    db: Session, request_id: int, restaurant_id: int
) -> HousekeepingRequest | None:
    """Fetch a single request scoped to a restaurant. Returns None if not found or wrong tenant."""
    return (
        db.query(HousekeepingRequest)
        .filter(
            HousekeepingRequest.id == request_id,
            HousekeepingRequest.restaurant_id == restaurant_id,
        )
        .first()
    )


def list_requests_by_restaurant(
    db: Session,
    restaurant_id: int,
    *,
    status: str | None = None,
    room_number: str | None = None,
    request_type: str | None = None,
) -> list[HousekeepingRequest]:
    """List requests for a restaurant with optional filters.

    Tenant-scoped: restaurant_id is always applied.
    Results ordered by submitted_at descending (newest first).
    """
    q = db.query(HousekeepingRequest).filter(
        HousekeepingRequest.restaurant_id == restaurant_id
    )
    if status:
        q = q.filter(HousekeepingRequest.status == status)
    if room_number:
        q = q.filter(HousekeepingRequest.room_number_snapshot == room_number)
    if request_type:
        q = q.filter(HousekeepingRequest.request_type == request_type)
    return q.order_by(HousekeepingRequest.submitted_at.desc()).all()


def list_requests_by_session(
    db: Session,
    *,
    restaurant_id: int,
    room_session_id: str,
) -> list[HousekeepingRequest]:
    """List requests created from the same room session (guest 'My Requests')."""
    return (
        db.query(HousekeepingRequest)
        .filter(
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.room_session_id == room_session_id,
        )
        .order_by(HousekeepingRequest.submitted_at.desc())
        .all()
    )


def mark_request_done(
    db: Session,
    request_id: int,
    restaurant_id: int,
    done_at: datetime,
) -> HousekeepingRequest | None:
    """Set status=done and done_at timestamp. Tenant-scoped. Returns None if not found."""
    req = get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        return None
    req.status = "done"
    req.done_at = done_at
    db.commit()
    db.refresh(req)
    return req


def get_request_by_id_and_session(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    room_session_id: str,
) -> HousekeepingRequest | None:
    """Fetch a request scoped to restaurant + room session."""
    return (
        db.query(HousekeepingRequest)
        .filter(
            HousekeepingRequest.id == request_id,
            HousekeepingRequest.restaurant_id == restaurant_id,
            HousekeepingRequest.room_session_id == room_session_id,
        )
        .first()
    )


def cancel_request_by_session(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
    room_session_id: str,
    cancelled_at: datetime,
) -> HousekeepingRequest | None:
    """Set status=cancelled for a guest-owned pending request."""
    req = get_request_by_id_and_session(
        db,
        request_id=request_id,
        restaurant_id=restaurant_id,
        room_session_id=room_session_id,
    )
    if req is None:
        return None
    req.status = "cancelled"
    req.cancelled_at = cancelled_at
    db.commit()
    db.refresh(req)
    return req


def delete_request_by_restaurant(
    db: Session,
    *,
    request_id: int,
    restaurant_id: int,
) -> bool:
    """Hard-delete one housekeeping request in the same tenant."""
    req = get_request_by_id_and_restaurant(db, request_id, restaurant_id)
    if req is None:
        return False
    db.delete(req)
    db.commit()
    return True
