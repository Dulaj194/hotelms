"""Room sessions service — guest-facing business logic.

Handles:
1. Room session creation (guest scans QR → signed token issued)
2. Room cart operations (add/update/remove/clear)  
3. Room order placement (cart → persisted order → real-time event)

Architecture notes:
- Room cart uses Redis with "room_cart:" key prefix (distinct from table "cart:").
- cart/repository.py functions are reused directly via the prefix parameter.
- Order placement reuses order_repo and payment_repo (same normalized order tables).
- order_source="room" distinguishes room orders from table orders.
- Totals are always server-calculated from DB prices (SECURITY rule).
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import redis as redis_lib
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_room_session_token, decode_room_qr_access_token
from app.modules.cart import repository as cart_repo
from app.modules.items.repository import get_by_id as get_item
from app.modules.orders import repository as order_repo
from app.modules.orders.model import OrderStatus
from app.modules.payments import repository as payment_repo
from app.modules.realtime import service as realtime_service
from app.modules.restaurants.repository import get_by_id as get_restaurant
from app.modules.room_sessions import repository
from app.modules.room_sessions.model import RoomSession
from app.modules.room_sessions.schemas import (
    AddRoomCartItemRequest,
    GenericMessageResponse,
    PlaceRoomOrderRequest,
    PlaceRoomOrderResponse,
    RoomCartItemResponse,
    RoomCartResponse,
    RoomOrderDetailResponse,
    RoomOrderItemResponse,
    RoomSessionStartRequest,
    RoomSessionStartResponse,
    UpdateRoomCartItemRequest,
)
from app.modules.rooms.repository import get_room_by_number_and_restaurant

# Redis key prefix for room carts — keeps room carts distinct from table carts
_ROOM_CART_PREFIX = "room_cart"
GUEST_CANCEL_WINDOW_SECONDS = 5


# ── Session start ─────────────────────────────────────────────────────────────

def start_room_session(
    db: Session, data: RoomSessionStartRequest
) -> RoomSessionStartResponse:
    """Validate restaurant + room, then issue a signed room session token.

    Flow:
    1. Validate restaurant exists and is active.
    2. Validate room exists in that restaurant and is active.
    3. Generate unique session_id.
    4. Persist session metadata (NOT the raw token).
    5. Sign and return the room session token.

    SECURITY: room_number + restaurant_id are validated against DB.
    The returned room_session_token is the authorization credential.
    Plain room_number alone never authorizes cart or order operations.
    """
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

    room = get_room_by_number_and_restaurant(db, data.room_number, data.restaurant_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found.",
        )
    if not room.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room is not currently active.",
        )

    try:
        qr_payload = decode_room_qr_access_token(data.qr_access_key)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired room QR credential. Please scan the room QR again.",
        )

    payload_restaurant_id = int(qr_payload.get("restaurant_id", -1))
    payload_room_number = str(qr_payload.get("room_number", "")).strip()
    if payload_restaurant_id != data.restaurant_id or payload_room_number != room.room_number:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Room QR credential does not match this room context.",
        )

    # Opportunistic cleanup keeps room session table healthy without a separate cron.
    repository.cleanup_stale_room_sessions(
        db,
        idle_timeout_minutes=settings.room_session_idle_timeout_minutes,
    )
    repository.deactivate_active_sessions_for_room(
        db,
        restaurant_id=data.restaurant_id,
        room_id=room.id,
    )

    session_id = uuid.uuid4().hex
    expire_minutes = settings.guest_session_expire_minutes
    expires_at = datetime.now(UTC) + timedelta(minutes=expire_minutes)

    repository.create_room_session(
        db,
        session_id=session_id,
        restaurant_id=data.restaurant_id,
        room_id=room.id,
        room_number_snapshot=room.room_number,
        expires_at=expires_at,
    )

    token = create_room_session_token(
        session_id=session_id,
        restaurant_id=data.restaurant_id,
        room_id=room.id,
        room_number=room.room_number,
        expire_minutes=expire_minutes,
    )

    return RoomSessionStartResponse(
        session_id=session_id,
        room_session_token=token,
        restaurant_id=data.restaurant_id,
        room_id=room.id,
        room_number=room.room_number,
        expires_at=expires_at,
    )


# ── Cart helpers ──────────────────────────────────────────────────────────────

def _build_room_cart_response(
    db: Session, r: redis_lib.Redis, session: RoomSession
) -> RoomCartResponse:
    """Build RoomCartResponse by joining Redis quantities with DB item prices."""
    raw = cart_repo.get_cart_raw(
        r, session.session_id, session.restaurant_id, prefix=_ROOM_CART_PREFIX
    )

    items: list[RoomCartItemResponse] = []
    total = 0.0

    for item_id_str, qty_str in raw.items():
        item_id = int(item_id_str)
        quantity = int(qty_str)

        item = get_item(db, item_id, session.restaurant_id)
        if item is None:
            # Item removed from menu — skip silently
            continue

        unit_price = float(item.price)
        line_total = unit_price * quantity
        total += line_total

        items.append(
            RoomCartItemResponse(
                item_id=item.id,
                name=item.name,
                unit_price=unit_price,
                quantity=quantity,
                line_total=round(line_total, 2),
                is_available=item.is_available,
            )
        )

    return RoomCartResponse(
        session_id=session.session_id,
        restaurant_id=session.restaurant_id,
        room_id=session.room_id,
        room_number=session.room_number_snapshot,
        items=items,
        total=round(total, 2),
        item_count=sum(i.quantity for i in items),
    )


# ── Cart operations ───────────────────────────────────────────────────────────

def get_room_cart(
    db: Session, r: redis_lib.Redis, session: RoomSession
) -> RoomCartResponse:
    """Return current room cart with DB-backed prices."""
    cart_repo.refresh_cart_ttl(
        r, session.session_id, session.restaurant_id, prefix=_ROOM_CART_PREFIX
    )
    return _build_room_cart_response(db, r, session)


def add_room_cart_item(
    db: Session,
    r: redis_lib.Redis,
    session: RoomSession,
    data: AddRoomCartItemRequest,
) -> RoomCartResponse:
    """Add or increment an item in the room cart.

    SECURITY: item validated against session's restaurant (cross-tenant blocked).
    Unavailable items cannot be added.
    """
    item = get_item(db, data.item_id, session.restaurant_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )
    if not item.is_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{item.name}' is currently unavailable.",
        )

    raw = cart_repo.get_cart_raw(
        r, session.session_id, session.restaurant_id, prefix=_ROOM_CART_PREFIX
    )
    existing_qty = int(raw.get(str(data.item_id), 0))
    new_qty = existing_qty + data.quantity

    cart_repo.set_cart_item(
        r,
        session.session_id,
        session.restaurant_id,
        data.item_id,
        new_qty,
        prefix=_ROOM_CART_PREFIX,
    )
    return _build_room_cart_response(db, r, session)


def update_room_cart_item(
    db: Session,
    r: redis_lib.Redis,
    session: RoomSession,
    item_id: int,
    data: UpdateRoomCartItemRequest,
) -> RoomCartResponse:
    """Set absolute quantity for a room cart item."""
    item = get_item(db, item_id, session.restaurant_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )

    cart_repo.set_cart_item(
        r,
        session.session_id,
        session.restaurant_id,
        item_id,
        data.quantity,
        prefix=_ROOM_CART_PREFIX,
    )
    return _build_room_cart_response(db, r, session)


def remove_room_cart_item(
    db: Session,
    r: redis_lib.Redis,
    session: RoomSession,
    item_id: int,
) -> RoomCartResponse:
    """Remove one item line from the room cart."""
    cart_repo.remove_cart_item(
        r,
        session.session_id,
        session.restaurant_id,
        item_id,
        prefix=_ROOM_CART_PREFIX,
    )
    return _build_room_cart_response(db, r, session)


def clear_room_cart(
    db: Session,
    r: redis_lib.Redis,
    session: RoomSession,
) -> GenericMessageResponse:
    """Clear the entire room cart."""
    cart_repo.clear_cart(
        r, session.session_id, session.restaurant_id, prefix=_ROOM_CART_PREFIX
    )
    return GenericMessageResponse(message="Room cart cleared.")


# ── Room order placement ──────────────────────────────────────────────────────

def _build_room_order_detail(order) -> RoomOrderDetailResponse:
    """Build RoomOrderDetailResponse from an OrderHeader ORM object."""
    return RoomOrderDetailResponse(
        id=order.id,
        order_number=order.order_number,
        session_id=order.session_id,
        restaurant_id=order.restaurant_id,
        order_source=order.order_source.value,
        room_id=order.room_id,
        room_number=order.room_number,
        customer_name=order.customer_name,
        status=order.status.value,
        subtotal_amount=float(order.subtotal_amount),
        tax_amount=float(order.tax_amount),
        discount_amount=float(order.discount_amount),
        total_amount=float(order.total_amount),
        placed_at=order.placed_at,
        confirmed_at=order.confirmed_at,
        processing_at=order.processing_at,
        completed_at=order.completed_at,
        rejected_at=order.rejected_at,
        notes=order.notes,
        items=[
            RoomOrderItemResponse(
                id=oi.id,
                item_id=oi.item_id,
                item_name_snapshot=oi.item_name_snapshot,
                unit_price_snapshot=float(oi.unit_price_snapshot),
                quantity=oi.quantity,
                line_total=float(oi.line_total),
                notes=oi.notes,
            )
            for oi in order.items
        ],
    )


def place_room_order(
    db: Session,
    r: redis_lib.Redis,
    session: RoomSession,
    payload: PlaceRoomOrderRequest,
) -> PlaceRoomOrderResponse:
    """Convert the guest's room cart into a persisted room order.

    SECURITY:
    - restaurant_id, room_id, room_number come from the validated RoomSession.
    - All prices are loaded from the DB — client totals are never accepted.
    - Cart is cleared only after a successful DB commit.
    - order_source="room" distinguishes this order from table orders.
    """
    raw_cart = cart_repo.get_cart_raw(
        r, session.session_id, session.restaurant_id, prefix=_ROOM_CART_PREFIX
    )
    if not raw_cart:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cart is empty. Add items before placing an order.",
        )

    # Build line items with DB-authoritative prices
    line_items: list[dict] = []
    subtotal = 0.0

    for item_id_str, qty_str in raw_cart.items():
        item_id = int(item_id_str)
        quantity = int(qty_str)

        item = get_item(db, item_id, session.restaurant_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Item {item_id} not found in this restaurant.",
            )
        if not item.is_available:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Item '{item.name}' is currently unavailable.",
            )

        unit_price = float(item.price)
        line_total = unit_price * quantity
        subtotal += line_total

        line_items.append(
            {
                "item_id": item.id,
                "item_name_snapshot": item.name,
                "unit_price_snapshot": unit_price,
                "quantity": quantity,
                "line_total": line_total,
            }
        )

    tax_amount = 0.0
    discount_amount = 0.0
    total_amount = subtotal + tax_amount - discount_amount

    # Persist order atomically
    try:
        order = order_repo.create_order_header(
            db,
            session_id=session.session_id,
            restaurant_id=session.restaurant_id,
            table_number=None,
            order_source="room",
            room_id=session.room_id,
            room_number=session.room_number_snapshot,
            initial_status=OrderStatus.confirmed,
            subtotal_amount=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            total_amount=total_amount,
            notes=payload.notes,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
        )

        order_repo.create_order_items(
            db,
            order_id=order.id,
            restaurant_id=session.restaurant_id,
            items=line_items,
        )

        payment_repo.create_payment_record(
            db,
            order_id=order.id,
            restaurant_id=session.restaurant_id,
            amount=total_amount,
        )

        db.commit()
    except Exception:
        db.rollback()
        raise

    # Clear room cart only after successful commit
    cart_repo.clear_cart(
        r, session.session_id, session.restaurant_id, prefix=_ROOM_CART_PREFIX
    )

    # Reload with relationships for response
    placed = order_repo.get_order_by_id_and_session(
        db, order.id, session.session_id, session.restaurant_id
    )

    # Publish real-time event with explicit room metadata.
    try:
        realtime_service.publish_new_order(
            r,
            restaurant_id=session.restaurant_id,
            order_id=placed.id,
            order_number=placed.order_number,
            table_number=None,
            order_source="room",
            room_id=session.room_id,
            room_number=session.room_number_snapshot,
            status=placed.status.value,
            total_amount=float(placed.total_amount),
            placed_at=placed.placed_at,
            items=[
                {
                    "item_name_snapshot": oi.item_name_snapshot,
                    "quantity": oi.quantity,
                    "line_total": float(oi.line_total),
                }
                for oi in placed.items
            ],
        )
    except Exception:
        # Real-time failure must never block the order placement response.
        pass

    # Keep room session activity fresh after successful order placement.
    repository.touch_room_session_activity(
        db,
        session_id=session.session_id,
        restaurant_id=session.restaurant_id,
    )

    return PlaceRoomOrderResponse(order=_build_room_order_detail(placed))


def get_room_order_for_guest(
    db: Session,
    order_id: int,
    session: RoomSession,
) -> RoomOrderDetailResponse:
    """Return a room order detail for the guest who placed it.

    SECURITY: scoped to both session_id and restaurant_id — guests cannot
    access orders from other sessions or other restaurants.
    """
    order = order_repo.get_order_by_id_and_session(
        db, order_id, session.session_id, session.restaurant_id
    )
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )
    return _build_room_order_detail(order)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def cancel_room_order_for_guest(
    db: Session,
    r: redis_lib.Redis,
    order_id: int,
    session: RoomSession,
) -> GenericMessageResponse:
    """Cancel a guest room order within 5 seconds while status is pending/confirmed.

    Room orders are auto-confirmed at placement, so both pending and confirmed
    are treated as customer-cancellable during the short grace window.
    """
    order = order_repo.get_order_by_id_and_session(
        db, order_id, session.session_id, session.restaurant_id
    )
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    if order.order_source.value != "room":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    if order.status not in {OrderStatus.pending, OrderStatus.confirmed}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only pending or confirmed room orders can be cancelled by customer.",
        )

    elapsed_seconds = (datetime.now(UTC) - _as_utc(order.placed_at)).total_seconds()
    if elapsed_seconds > GUEST_CANCEL_WINDOW_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cancellation window expired. Orders can be cancelled within 5 seconds only.",
        )

    updated = order_repo.update_order_status(db, order, OrderStatus.rejected)
    db.commit()
    db.refresh(updated)

    try:
        realtime_service.publish_order_status_updated(
            r,
            restaurant_id=session.restaurant_id,
            order_id=updated.id,
            order_number=updated.order_number,
            table_number=updated.table_number,
            order_source=updated.order_source.value,
            room_id=updated.room_id,
            room_number=updated.room_number,
            status=updated.status.value,
            updated_at=datetime.now(UTC),
        )
    except Exception:
        pass

    return GenericMessageResponse(message="Room order cancelled successfully.")
