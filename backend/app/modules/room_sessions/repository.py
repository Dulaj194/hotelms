"""Repository layer for room_sessions."""
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
    db: Session,
    session_id: str,
) -> RoomSession | None:
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
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> RoomSession | None:
    return (
        db.query(RoomSession)
        .filter(
            RoomSession.session_id == session_id,
            RoomSession.restaurant_id == restaurant_id,
        )
        .first()
    )


def get_latest_session_by_room_number(
    db: Session,
    restaurant_id: int,
    room_number: str,
) -> RoomSession | None:
    return (
        db.query(RoomSession)
        .filter(
            RoomSession.restaurant_id == restaurant_id,
            RoomSession.room_number_snapshot == room_number,
        )
        .order_by(RoomSession.created_at.desc(), RoomSession.id.desc())
        .first()
    )


def list_sessions_by_id_prefix(
    db: Session,
    *,
    restaurant_id: int,
    session_id_prefix: str,
    limit: int = 5,
) -> list[RoomSession]:
    prefix = (session_id_prefix or "").strip()
    if not prefix:
        return []

    return (
        db.query(RoomSession)
        .filter(
            RoomSession.restaurant_id == restaurant_id,
            RoomSession.session_id.like(f"{prefix}%"),
        )
        .order_by(RoomSession.created_at.desc(), RoomSession.id.desc())
        .limit(limit)
        .all()
    )


def list_sessions_by_room_number(
    db: Session,
    *,
    restaurant_id: int,
    room_number: str,
    limit: int = 5,
) -> list[RoomSession]:
    candidate = (room_number or "").strip()
    if not candidate:
        return []

    return (
        db.query(RoomSession)
        .filter(
            RoomSession.restaurant_id == restaurant_id,
            RoomSession.room_number_snapshot == candidate,
        )
        .order_by(RoomSession.created_at.desc(), RoomSession.id.desc())
        .limit(limit)
        .all()
    )


def touch_room_session_activity(
    db: Session,
    *,
    session_id: str,
    restaurant_id: int,
) -> None:
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


def close_session_by_id(
    db: Session,
    *,
    session_id: str,
    restaurant_id: int,
) -> RoomSession | None:
    session = get_room_session_by_id_and_restaurant(db, session_id, restaurant_id)
    if session:
        session.is_active = False
        db.flush()
    return session
