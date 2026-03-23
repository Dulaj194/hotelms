"""Repository layer for room_sessions.

All methods are tenant-scoped where restaurant context is needed.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.modules.room_sessions.model import RoomSession


def create_room_session(
    db: Session,
    *,
    session_id: str,
    restaurant_id: int,
    room_id: int,
    room_number_snapshot: str,
    expires_at: datetime,
) -> RoomSession:
    """Persist a new room session record. Does NOT store the raw signed token."""
    session = RoomSession(
        session_id=session_id,
        restaurant_id=restaurant_id,
        room_id=room_id,
        room_number_snapshot=room_number_snapshot,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def deactivate_active_sessions_for_room(
    db: Session,
    *,
    restaurant_id: int,
    room_id: int,
) -> int:
    """Deactivate all currently active sessions for the given room."""
    sessions = (
        db.query(RoomSession)
        .filter(
            RoomSession.restaurant_id == restaurant_id,
            RoomSession.room_id == room_id,
            RoomSession.is_active.is_(True),
        )
        .all()
    )
    for session in sessions:
        session.is_active = False

    if sessions:
        db.commit()
    return len(sessions)


def cleanup_stale_room_sessions(
    db: Session,
    *,
    idle_timeout_minutes: int,
) -> int:
    """Deactivate active sessions that are expired or idle beyond the timeout."""
    now = datetime.now(UTC)
    idle_cutoff = now - timedelta(minutes=max(idle_timeout_minutes, 1))
    sessions = (
        db.query(RoomSession)
        .filter(
            RoomSession.is_active.is_(True),
            (RoomSession.expires_at <= now) | (RoomSession.last_activity_at < idle_cutoff),
        )
        .all()
    )
    for session in sessions:
        session.is_active = False

    if sessions:
        db.commit()
    return len(sessions)


def get_active_room_session_by_session_id(
    db: Session, session_id: str
) -> RoomSession | None:
    """Fetch an active, non-expired room session by its session_id.

    Used by the get_current_room_session dependency to authorize guest requests.
    """
    now = datetime.now(UTC)
    return (
        db.query(RoomSession)
        .filter(
            RoomSession.session_id == session_id,
            RoomSession.is_active.is_(True),
            RoomSession.expires_at > now,
        )
        .first()
    )


def get_room_session_by_id_and_restaurant(
    db: Session, session_id: str, restaurant_id: int
) -> RoomSession | None:
    """Fetch a session regardless of active/expiry state — for admin/billing use."""
    return (
        db.query(RoomSession)
        .filter(
            RoomSession.session_id == session_id,
            RoomSession.restaurant_id == restaurant_id,
        )
        .first()
    )


def touch_room_session_activity(
    db: Session,
    *,
    session_id: str,
    restaurant_id: int,
) -> None:
    """Update last_activity_at timestamp."""
    session = (
        db.query(RoomSession)
        .filter(
            RoomSession.session_id == session_id,
            RoomSession.restaurant_id == restaurant_id,
        )
        .first()
    )
    if session:
        session.last_activity_at = datetime.now(UTC)
        db.commit()


def deactivate_room_session(
    db: Session,
    *,
    session_id: str,
    restaurant_id: int,
) -> None:
    """Mark a room session as inactive."""
    session = (
        db.query(RoomSession)
        .filter(
            RoomSession.session_id == session_id,
            RoomSession.restaurant_id == restaurant_id,
        )
        .first()
    )
    if session:
        session.is_active = False
        db.commit()
