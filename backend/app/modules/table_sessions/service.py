import uuid
from datetime import UTC, datetime, timedelta

import redis as redis_lib
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.security import create_guest_session_token, decode_table_qr_access_token
from app.modules.realtime import service as realtime_service
from app.modules.restaurants.repository import get_by_id as get_restaurant
from app.modules.table_sessions import repository
from app.modules.table_sessions.model import TableSession, TableSessionStatus
from app.modules.table_sessions.schemas import (
    TableSessionStartRequest,
    TableSessionStartResponse,
)


def start_table_session(
    db: Session,
    data: TableSessionStartRequest,
) -> TableSessionStartResponse:
    """Create a signed guest table session.

    Flow:
    1. Validate the restaurant exists and is active.
    2. Generate a unique session_id.
    3. Persist session metadata to DB.
    4. Sign a guest token (JWT-style) encoding session_id + restaurant_id + table_number.
    5. Return token to the client — client must include it in X-Guest-Session header.

    SECURITY: The returned guest_token is the authorization credential.
    table_number and restaurant_id alone are never sufficient for cart operations.
    """
    table_number = data.table_number.strip()
    if not table_number:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Table number is required.",
        )

    customer_name = data.customer_name.strip()
    if not customer_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Customer name is required.",
        )

    restaurant = get_restaurant(db, data.restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    if not restaurant.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant is not currently available.",
        )

    try:
        qr_payload = decode_table_qr_access_token(data.qr_access_key)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired table QR credential. Please scan the table QR again.",
        )

    try:
        payload_restaurant_id = int(qr_payload.get("restaurant_id", -1))
    except (TypeError, ValueError):
        payload_restaurant_id = -1
    payload_table_number = str(qr_payload.get("table_number", "")).strip()
    if payload_restaurant_id != data.restaurant_id or payload_table_number != table_number:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Table QR credential does not match this table context.",
        )

    session_id = uuid.uuid4().hex
    expire_minutes = settings.guest_session_expire_minutes
    expires_at = datetime.now(UTC) + timedelta(minutes=expire_minutes)

    try:
        # Keep a single active session per restaurant table.
        repository.deactivate_active_sessions_for_table(
            db,
            restaurant_id=data.restaurant_id,
            table_number=table_number,
        )

        # Persist session record — does NOT store the raw token
        repository.create_session(
            db,
            session_id=session_id,
            restaurant_id=data.restaurant_id,
            table_number=table_number,
            customer_name=customer_name,
            expires_at=expires_at,
        )

        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

    # Create signed guest token
    guest_token = create_guest_session_token(
        session_id=session_id,
        restaurant_id=data.restaurant_id,
        table_number=table_number,
        expire_minutes=expire_minutes,
    )

    return TableSessionStartResponse(
        session_id=session_id,
        guest_token=guest_token,
        restaurant_id=data.restaurant_id,
        table_number=table_number,
        customer_name=customer_name,
        session_status="OPEN",
        expires_at=expires_at,
    )


def request_bill(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
) -> TableSession:
    """Mark the table session as requesting the bill and alert staff."""
    try:
        session.session_status = TableSessionStatus.BILL_REQUESTED
        session.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(session)
        
        # Broadcast real-time notification to staff
        realtime_service.publish_bill_requested(
            r,
            restaurant_id=session.restaurant_id,
            table_number=session.table_number,
            session_id=session.session_id,
            customer_name=session.customer_name,
        )
        
        return session
    except SQLAlchemyError:
        db.rollback()
        raise
def list_bill_requests(
    db: Session,
    restaurant_id: int,
) -> list[TableSession]:
    """Return all active sessions with status BILL_REQUESTED."""
    return repository.list_bill_requests_for_restaurant(db, restaurant_id)


def request_service(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
    service_type: str,
    message: str | None = None,
) -> None:
    """Publish a real-time service request from a guest table."""
    realtime_service.publish_service_requested(
        r,
        restaurant_id=session.restaurant_id,
        table_number=session.table_number,
        session_id=session.session_id,
        service_type=service_type,
        customer_name=session.customer_name,
    )

