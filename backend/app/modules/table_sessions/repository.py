from __future__ import annotations
from datetime import UTC, datetime

from sqlalchemy.orm import Session
from app.core.logging import get_logger

logger = get_logger(__name__)

from app.modules.table_sessions.model import TableSession, TableSessionStatus, TableServiceRequest


def create_session(
    db: Session,
    session_id: str,
    restaurant_id: int,
    table_number: str,
    customer_name: str,
    expires_at: datetime,
) -> TableSession:
    """Persist a new table session record."""
    session = TableSession(
        session_id=session_id,
        restaurant_id=restaurant_id,
        table_number=table_number,
        customer_name=customer_name,
        expires_at=expires_at,
        is_active=True,
        session_status=TableSessionStatus.OPEN,
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
        session.session_status = TableSessionStatus.CLOSED

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
            TableSession.session_status.in_(
                [TableSessionStatus.OPEN, TableSessionStatus.BILL_REQUESTED]
            ),
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
        session.session_status = TableSessionStatus.CLOSED
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


def list_sessions_by_id_prefix(
    db: Session,
    restaurant_id: int,
    session_id_prefix: str,
    limit: int = 5,
) -> list[TableSession]:
    """Return recent sessions where session_id starts with a prefix.

    Used by staff billing lookup to support short session id input.
    Caller is responsible for handling ambiguous prefix matches.
    """
    prefix = (session_id_prefix or "").strip()
    if not prefix:
        return []

    return (
        db.query(TableSession)
        .filter(
            TableSession.restaurant_id == restaurant_id,
            TableSession.session_id.like(f"{prefix}%"),
        )
        .order_by(TableSession.created_at.desc(), TableSession.id.desc())
        .limit(limit)
        .all()
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
        session.session_status = TableSessionStatus.CLOSED
        db.flush()
    return session
def list_bill_requests_for_restaurant(
    db: Session,
    restaurant_id: int,
) -> list[TableSession]:
    """Return all active sessions that have requested a bill."""
    now = datetime.now(UTC)
    return (
        db.query(TableSession)
        .filter(
            TableSession.restaurant_id == restaurant_id,
            TableSession.is_active.is_(True),
            TableSession.session_status == TableSessionStatus.BILL_REQUESTED,
            TableSession.expires_at > now,
        )
        .order_by(TableSession.updated_at.desc())
        .all()
    )


def create_service_request(
    db: Session,
    restaurant_id: int,
    session_id: str,
    table_number: str,
    customer_name: str | None,
    service_type: str,
    message: str | None = None,
) -> TableServiceRequest:
    """Create and persist a new guest service request."""
    request = TableServiceRequest(
        restaurant_id=restaurant_id,
        session_id=session_id,
        table_number=table_number,
        customer_name=customer_name,
        service_type=service_type,
        message=message,
    )
    db.add(request)
    db.flush()
    db.refresh(request)
    return request


def list_active_service_requests(
    db: Session,
    restaurant_id: int,
) -> list[TableServiceRequest]:
    """Return all non-completed service requests for a restaurant."""
    try:
        return (
            db.query(TableServiceRequest)
            .filter(
                TableServiceRequest.restaurant_id == restaurant_id,
                TableServiceRequest.is_completed.is_(False),
                TableServiceRequest.acknowledged_by.is_(None),
            )
            .order_by(TableServiceRequest.requested_at.desc())
            .all()
        )
    except Exception as exc:
        # Fallback if table doesn't exist yet or other DB issue
        logger.error("Failed to list active service requests: %s", str(exc))
        return []


def complete_service_request(
    db: Session,
    request_id: int,
    restaurant_id: int,
) -> bool:
    """Mark a service request as completed/resolved."""
    request = (
        db.query(TableServiceRequest)
        .filter(
            TableServiceRequest.id == request_id,
            TableServiceRequest.restaurant_id == restaurant_id,
        )
        .first()
    )
    if request:
        request.is_completed = True
        request.completed_at = datetime.now(UTC)
        db.flush()
        return True
    return False


def acknowledge_service_request(
    db: Session,
    request_id: int,
    restaurant_id: int,
    user_id: int,
) -> bool:
    """Mark a service request as acknowledged by a staff member."""
    request = (
        db.query(TableServiceRequest)
        .filter(
            TableServiceRequest.id == request_id,
            TableServiceRequest.restaurant_id == restaurant_id,
        )
        .first()
    )
    if request:
        request.acknowledged_by = user_id
        request.acknowledged_at = datetime.now(UTC)
        db.flush()
        return True
    return False
