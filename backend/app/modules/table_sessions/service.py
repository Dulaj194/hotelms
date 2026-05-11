from __future__ import annotations
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
from app.modules.table_sessions.model import TableSession, TableSessionStatus, TableServiceRequest
from app.modules.table_sessions.schemas import (
    TableSessionStartRequest,
    TableSessionStartResponse,
)

from app.core.logging import get_logger

logger = get_logger(__name__)


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
        # We no longer deactivate other sessions for the table to support separate billing
        # for multiple guests at the same table (Standard Hospitality Pattern).
        # repository.deactivate_active_sessions_for_table(
        #     db,
        #     restaurant_id=data.restaurant_id,
        #     table_number=table_number,
        # )

        # Persist session record — does NOT store the raw token
        repository.create_session(
            db,
            session_id=session_id,
            restaurant_id=data.restaurant_id,
            table_number=table_number,
            customer_name=customer_name,
            expires_at=expires_at,
            order_source=data.order_source,
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
        order_source=data.order_source,
        session_status="OPEN",
        expires_at=expires_at,
    )


def request_bill(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
    order_source: str | None = None,
) -> TableSession:
    """Mark the table session as requesting the bill and alert staff."""
    source = order_source or getattr(session, "order_source", "table")
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
            order_source=source,
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
    session: TableSession | object, # Accept anything with these attrs
    service_type: str,
    message: str | None = None,
    order_source: str | None = None,
) -> None:
    """Publish a real-time service request from a guest table or room."""
    source = order_source or getattr(session, "order_source", "table")
    # For room sessions, we use room_number_snapshot as table_number
    table_num = getattr(session, "table_number", None) or getattr(session, "room_number_snapshot", "Unknown")
    cust_name = getattr(session, "customer_name", None) or getattr(session, "guest_name", "Guest")

    try:
        # 1. Persist the request to the database
        new_request = repository.create_service_request(
            db,
            restaurant_id=session.restaurant_id,
            session_id=session.session_id,
            table_number=table_num,
            customer_name=cust_name,
            service_type=service_type,
            message=message,
            order_source=source,
        )
        db.commit()
        
        # 2. Broadcast the real-time event to connected staff
        realtime_service.publish_service_requested(
            r,
            restaurant_id=session.restaurant_id,
            table_number=table_num,
            session_id=session.session_id,
            service_type=service_type,
            request_id=new_request.id,
            customer_name=cust_name,
            message=message,
            order_source=source,
        )
    except Exception as exc:
        logger.error("Failed to process service request: %s", str(exc), exc_info=True)
        db.rollback()
        raise


def list_service_requests(
    db: Session,
    restaurant_id: int,
) -> list[TableServiceRequest]:
    """Return all active service requests for the restaurant."""
    return repository.list_active_service_requests(db, restaurant_id)


def resolve_service_request(
    db: Session,
    r: redis_lib.Redis,
    request_id: int,
    restaurant_id: int,
) -> bool:
    """Complete a service request."""
    try:
        success = repository.complete_service_request(db, request_id, restaurant_id)
        if success:
            db.commit()
            realtime_service.publish_service_resolved(
                r,
                restaurant_id=restaurant_id,
                request_id=request_id,
            )
        return success
    except Exception:
        db.rollback()
        raise


def acknowledge_service_request(
    db: Session,
    r: redis_lib.Redis,
    request_id: int,
    restaurant_id: int,
    user_id: int,
) -> bool:
    """Mark a service request as acknowledged by a staff member and broadcast."""
    try:
        success = repository.acknowledge_service_request(db, request_id, restaurant_id, user_id)
        if success:
            db.commit()
            # Broadcast the acknowledgement so other dashboards can remove it
            realtime_service.publish_service_acknowledged(
                r,
                restaurant_id=restaurant_id,
                request_id=request_id,
                acknowledged_by=user_id,
            )
        return success
    except Exception:
        db.rollback()
        raise


def acknowledge_bill(
    db: Session,
    r: redis_lib.Redis,
    session_id: str,
    restaurant_id: int,
    user_id: int,
) -> bool:
    """Mark a bill request as acknowledged and broadcast."""
    try:
        session = repository.get_session_by_id_and_restaurant(db, session_id, restaurant_id)
        if session and session.session_status == TableSessionStatus.BILL_REQUESTED:
            session.session_status = TableSessionStatus.BILL_ACKNOWLEDGED
            session.updated_at = datetime.now(UTC)
            db.commit()
            
            # Broadcast the acknowledgement
            realtime_service.publish_bill_acknowledged(
                r,
                restaurant_id=restaurant_id,
                session_id=session_id,
                acknowledged_by=user_id,
            )
            return True
        return False
    except Exception:
        db.rollback()
        raise


def present_bill(
    db: Session,
    r: redis_lib.Redis,
    session_id: str,
    restaurant_id: int,
) -> bool:
    """Mark a bill as presented to the customer and notify them."""
    try:
        session = repository.get_session_by_id_and_restaurant(db, session_id, restaurant_id)
        if not session:
            return False
            
        # Transition status
        session.session_status = TableSessionStatus.BILL_PRESENTED
        session.updated_at = datetime.now(UTC)
        db.commit()
        
        # Calculate current total for the notification
        from app.modules.orders.repository import list_billable_orders_by_session
        billable = list_billable_orders_by_session(db, session_id)
        total = sum(order.total_amount for order in billable)
        
        # Notify guest via real-time channel
        realtime_service.publish_bill_presented(
            r,
            restaurant_id=restaurant_id,
            session_id=session_id,
            table_number=session.table_number,
            total_amount=float(total),
        )
        return True
    except Exception:
        db.rollback()
        raise


def confirm_bill(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
) -> None:
    """Mark a bill as confirmed by the guest and notify staff."""
    try:
        session.session_status = TableSessionStatus.BILL_CONFIRMED
        session.updated_at = datetime.now(UTC)
        db.commit()
        
        # Notify staff via billing channel
        realtime_service.publish_bill_confirmed(
            r,
            restaurant_id=session.restaurant_id,
            session_id=session.session_id,
            customer_name=session.customer_name or "Guest",
        )
    except Exception:
        db.rollback()
        raise


def change_table(
    db: Session,
    r: redis_lib.Redis,
    session_id: str,
    restaurant_id: int,
    new_table_number: str,
) -> bool:
    """Move an active session and all its associated orders to a new table."""
    try:
        session = repository.get_session_by_id_and_restaurant(db, session_id, restaurant_id)
        if not session:
            return False
            
        old_table = session.table_number
        session.table_number = new_table_number
        session.updated_at = datetime.now(UTC)
        
        # Update all orders in this session so kitchen/steward knows where to go
        from app.modules.orders.model import OrderHeader
        db.query(OrderHeader).filter(
            OrderHeader.session_id == session_id,
            OrderHeader.restaurant_id == restaurant_id
        ).update({"table_number": new_table_number}, synchronize_session=False)
        
        # Update any active service requests
        from app.modules.table_sessions.model import TableServiceRequest
        db.query(TableServiceRequest).filter(
            TableServiceRequest.session_id == session_id,
            TableServiceRequest.restaurant_id == restaurant_id
        ).update({"table_number": new_table_number}, synchronize_session=False)
        
        db.commit()
        
        # Broadcast real-time event
        realtime_service.publish_table_changed(
            r,
            restaurant_id=restaurant_id,
            session_id=session_id,
            old_table=old_table,
            new_table=new_table_number,
        )
        return True
    except Exception:
        db.rollback()
        raise
