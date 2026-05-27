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
    order_source: str = "table",
) -> TableSession:
    """Persists a new table session record.

    Args:
        db (Session): The database session.
        session_id (str): The unique session ID.
        restaurant_id (int): The ID of the restaurant.
        table_number (str): The table number.
        customer_name (str): The name of the customer.
        expires_at (datetime): The expiry time for the session.
        order_source (str, optional): The source of the order. Defaults to "table".

    Returns:
        TableSession: The newly created session.
    """
    session = TableSession(
        session_id=session_id,
        restaurant_id=restaurant_id,
        table_number=table_number,
        customer_name=customer_name,
        order_source=order_source,
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
    """Deactivates currently active, non-expired sessions for a table.

    Uses `db.flush()` — caller manages commit/rollback.

    Args:
        db (Session): The database session.
        restaurant_id (int): The ID of the restaurant.
        table_number (str): The table number.

    Returns:
        int: The number of sessions deactivated.
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
    """Fetches an active, non-expired session by its session_id.

    Args:
        db (Session): The database session.
        session_id (str): The session ID.

    Returns:
        TableSession | None: The active session, or None if not found or expired.
    """
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
    """Updates `last_activity_at` for a session.

    Args:
        db (Session): The database session.
        session_id (str): The session ID to touch.
    """
    session = (
        db.query(TableSession)
        .filter(TableSession.session_id == session_id)
        .first()
    )
    if session:
        session.last_activity_at = datetime.now(UTC)
        db.flush()


def deactivate_session(db: Session, session_id: str) -> None:
    """Marks a session as inactive (logged out / expired).

    Args:
        db (Session): The database session.
        session_id (str): The session ID to deactivate.
    """
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
    """Fetches a session by its session_id scoped to a restaurant.

    Unlike `get_active_session_by_session_id`, this does NOT filter by
    `is_active` or expiry — used by billing staff who need to access any
    session state (active, expired, or already closed).

    Args:
        db (Session): The database session.
        session_id (str): The session ID.
        restaurant_id (int): The ID of the restaurant.

    Returns:
        TableSession | None: The session, or None if not found.
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
    """Returns the most recent session for a table in a restaurant.

    Useful for staff billing flows where operators may enter table number
    instead of a full session_id.

    Args:
        db (Session): The database session.
        restaurant_id (int): The ID of the restaurant.
        table_number (str): The table number.

    Returns:
        TableSession | None: The most recent session, or None if no sessions exist.
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
    """Returns recent sessions where session_id starts with a prefix.

    Used by staff billing lookup to support short session id input.
    Caller is responsible for handling ambiguous prefix matches.

    Args:
        db (Session): The database session.
        restaurant_id (int): The ID of the restaurant.
        session_id_prefix (str): The prefix to match.
        limit (int, optional): The max number of sessions to return. Defaults to 5.

    Returns:
        list[TableSession]: A list of matching table sessions.
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
    """Sets is_active=False for a session.

    Called as part of the billing settlement transaction.
    Uses `db.flush()` — the caller MUST commit.

    Args:
        db (Session): The database session.
        session_id (str): The session ID.
        restaurant_id (int): The ID of the restaurant.

    Returns:
        TableSession | None: The closed session, or None if not found.
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
    """Returns all active sessions that have requested a bill.

    Args:
        db (Session): The database session.
        restaurant_id (int): The ID of the restaurant.

    Returns:
        list[TableSession]: A list of sessions that requested a bill.
    """
    now = datetime.now(UTC)
    return (
        db.query(TableSession)
        .filter(
            TableSession.restaurant_id == restaurant_id,
            TableSession.is_active.is_(True),
            TableSession.session_status.in_([TableSessionStatus.BILL_REQUESTED, TableSessionStatus.BILL_ACKNOWLEDGED]),
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
    order_source: str = "table",
) -> TableServiceRequest:
    """Creates and persists a new guest service request.

    Args:
        db (Session): The database session.
        restaurant_id (int): The ID of the restaurant.
        session_id (str): The session ID.
        table_number (str): The table number.
        customer_name (str | None): The name of the customer.
        service_type (str): The type of service requested.
        message (str | None, optional): An optional message. Defaults to None.
        order_source (str, optional): The source of the request. Defaults to "table".

    Returns:
        TableServiceRequest: The newly created service request.
    """
    request = TableServiceRequest(
        restaurant_id=restaurant_id,
        session_id=session_id,
        table_number=table_number,
        customer_name=customer_name,
        order_source=order_source,
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
    """Returns all non-completed service requests for a restaurant.

    Args:
        db (Session): The database session.
        restaurant_id (int): The ID of the restaurant.

    Returns:
        list[TableServiceRequest]: A list of active service requests.
    """
    try:
        return (
            db.query(TableServiceRequest)
            .filter(
                TableServiceRequest.restaurant_id == restaurant_id,
                TableServiceRequest.is_completed.is_(False),
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
    """Marks a service request as completed/resolved.

    Args:
        db (Session): The database session.
        request_id (int): The ID of the service request.
        restaurant_id (int): The ID of the restaurant.

    Returns:
        bool: True if marked as completed, False if not found.
    """
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
    """Marks a service request as acknowledged by a staff member.

    Args:
        db (Session): The database session.
        request_id (int): The ID of the service request.
        restaurant_id (int): The ID of the restaurant.
        user_id (int): The ID of the staff user acknowledging it.

    Returns:
        bool: True if acknowledged, False if not found.
    """
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


def count_active_requests_stats(db: Session, restaurant_id: int) -> int:
    """Returns the combined count of active bill requests and service requests.

    Args:
        db (Session): The database session.
        restaurant_id (int): The ID of the restaurant.

    Returns:
        int: The total count of active requests.
    """
    now = datetime.now(UTC)
    try:
        bill_count = (
            db.query(TableSession)
            .filter(
                TableSession.restaurant_id == restaurant_id,
                TableSession.is_active.is_(True),
                TableSession.session_status.in_(
                    [TableSessionStatus.BILL_REQUESTED, TableSessionStatus.BILL_ACKNOWLEDGED]
                ),
                TableSession.expires_at > now,
            )
            .count()
        )

        service_count = (
            db.query(TableServiceRequest)
            .filter(
                TableServiceRequest.restaurant_id == restaurant_id,
                TableServiceRequest.is_completed.is_(False),
            )
            .count()
        )

        return bill_count + service_count
    except Exception as exc:
        logger.error("Failed to count active requests stats: %s", str(exc))
        return 0


def update_table_number_for_session(
    db: Session,
    session_id: str,
    restaurant_id: int,
    new_table_number: str,
) -> None:
    """Updates the table number for all orders and service requests in a session.

    Args:
        db (Session): The database session.
        session_id (str): The session ID.
        restaurant_id (int): The ID of the restaurant.
        new_table_number (str): The new table number.
    """
    from app.modules.orders.model import OrderHeader
    
    db.query(OrderHeader).filter(
        OrderHeader.session_id == session_id,
        OrderHeader.restaurant_id == restaurant_id
    ).update({"table_number": new_table_number}, synchronize_session=False)
    
    db.query(TableServiceRequest).filter(
        TableServiceRequest.session_id == session_id,
        TableServiceRequest.restaurant_id == restaurant_id
    ).update({"table_number": new_table_number}, synchronize_session=False)
