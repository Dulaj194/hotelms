from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.table_sessions.model import TableSession


def create_session(
    db: Session,
    session_id: str,
    restaurant_id: int,
    table_number: str,
    expires_at: datetime,
) -> TableSession:
    """Persist a new table session record."""
    session = TableSession(
        session_id=session_id,
        restaurant_id=restaurant_id,
        table_number=table_number,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(session)
    db.flush()
    db.refresh(session)
    return session


def deactivate_active_sessions_for_table(
    db: Session,
    restaurant_id: int,
    table_number: str,
) -> int:
    """Deactivate currently active, non-expired sessions for a table.

    Returns number of sessions deactivated.
    Uses db.flush() — caller manages commit/rollback.
    """
    now = datetime.now(UTC)
    sessions = (
        db.query(TableSession)
        .filter(
            TableSession.restaurant_id == restaurant_id,
            TableSession.table_number == table_number,
            TableSession.is_active.is_(True),
            TableSession.expires_at > now,
        )
        .all()
    )

    for session in sessions:
        session.is_active = False

    if sessions:
        db.flush()

    return len(sessions)


def get_active_session_by_session_id(
    db: Session, session_id: str
) -> TableSession | None:
    """Fetch an active, non-expired session by its session_id."""
    now = datetime.now(UTC)
    return (
        db.query(TableSession)
        .filter(
            TableSession.session_id == session_id,
            TableSession.is_active.is_(True),
            TableSession.expires_at > now,
        )
        .first()
    )


def touch_session_activity(db: Session, session_id: str) -> None:
    """Update last_activity_at for a session."""
    session = (
        db.query(TableSession)
        .filter(TableSession.session_id == session_id)
        .first()
    )
    if session:
        session.last_activity_at = datetime.now(UTC)
        db.flush()


def deactivate_session(db: Session, session_id: str) -> None:
    """Mark a session as inactive (logged out / expired)."""
    session = (
        db.query(TableSession)
        .filter(TableSession.session_id == session_id)
        .first()
    )
    if session:
        session.is_active = False
        db.flush()


def get_session_by_id_and_restaurant(
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> TableSession | None:
    """Fetch a session by its session_id scoped to a restaurant.

    Unlike get_active_session_by_session_id, this does NOT filter by
    is_active or expiry — used by billing staff who need to access any
    session state (active, expired, or already closed).
    """
    return (
        db.query(TableSession)
        .filter(
            TableSession.session_id == session_id,
            TableSession.restaurant_id == restaurant_id,
        )
        .first()
    )


def get_latest_session_by_table_number(
    db: Session,
    restaurant_id: int,
    table_number: str,
) -> TableSession | None:
    """Return the most recent session for a table in a restaurant.

    Useful for staff billing flows where operators may enter table number
    instead of a full session_id.
    """
    return (
        db.query(TableSession)
        .filter(
            TableSession.restaurant_id == restaurant_id,
            TableSession.table_number == table_number,
        )
        .order_by(TableSession.created_at.desc(), TableSession.id.desc())
        .first()
    )


def close_session_by_id(
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> TableSession | None:
    """Set is_active=False for a session.

    Called as part of the billing settlement transaction.
    Uses db.flush() — the caller MUST commit.
    """
    session = get_session_by_id_and_restaurant(db, session_id, restaurant_id)
    if session:
        session.is_active = False
        db.flush()
    return session
