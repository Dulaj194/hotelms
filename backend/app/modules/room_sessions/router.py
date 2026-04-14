"""Room sessions router — three endpoint groups registered separately.

Exports:
  session_router  → mounted at /room-sessions   (session start)
  cart_router     → mounted at /room-cart        (room cart CRUD)
  orders_router   → mounted at /room-orders      (room order placement + retrieval)

All guest routes are public-facing — they require a signed room session token
in the X-Room-Session header (handled by get_current_room_session dependency),
NOT a staff Bearer JWT.
"""
import redis as redis_lib
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_room_session, get_db, get_redis
from app.modules.room_sessions import service
from app.modules.room_sessions.model import RoomSession
from app.modules.room_sessions.schemas import (
    AddRoomCartItemRequest,
    GenericMessageResponse,
    PlaceRoomOrderRequest,
    PlaceRoomOrderResponse,
    RoomCartResponse,
    RoomOrderDetailResponse,
    RoomSessionStartRequest,
    RoomSessionStartResponse,
    UpdateRoomCartItemRequest,
)

# ── Session router ────────────────────────────────────────────────────────────

session_router = APIRouter()


@session_router.post("/start", response_model=RoomSessionStartResponse)
def start_room_session(
    payload: RoomSessionStartRequest,
    db: Session = Depends(get_db),
) -> RoomSessionStartResponse:
    """Start a guest room session from a QR scan context.

    Public endpoint — no login required.

    SECURITY: Returns a signed room_session_token. All subsequent room cart and
    room order operations require this token via X-Room-Session header.
    Plain room_number alone is never sufficient for authorization.
    """
    return service.start_room_session(db, payload)


# ── Room cart router ──────────────────────────────────────────────────────────

cart_router = APIRouter()


@cart_router.get("", response_model=RoomCartResponse)
def get_room_cart(
    session: RoomSession = Depends(get_current_room_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> RoomCartResponse:
    """Return current room cart contents with DB-backed totals.

    Requires X-Room-Session header with a valid signed room session token.
    """
    return service.get_room_cart(db, r, session)


@cart_router.post("/items", response_model=RoomCartResponse)
def add_room_cart_item(
    payload: AddRoomCartItemRequest,
    session: RoomSession = Depends(get_current_room_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> RoomCartResponse:
    """Add an item to the room cart.

    SECURITY: Price not accepted from client. Item validated against session restaurant.
    """
    return service.add_room_cart_item(db, r, session, payload)


@cart_router.patch("/items/{item_id}", response_model=RoomCartResponse)
def update_room_cart_item(
    item_id: int,
    payload: UpdateRoomCartItemRequest,
    session: RoomSession = Depends(get_current_room_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> RoomCartResponse:
    """Update quantity of a room cart item."""
    return service.update_room_cart_item(db, r, session, item_id, payload)


@cart_router.delete("/items/{item_id}", response_model=RoomCartResponse)
def remove_room_cart_item(
    item_id: int,
    session: RoomSession = Depends(get_current_room_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> RoomCartResponse:
    """Remove one item from the room cart."""
    return service.remove_room_cart_item(db, r, session, item_id)


@cart_router.delete("", response_model=GenericMessageResponse)
def clear_room_cart(
    session: RoomSession = Depends(get_current_room_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> GenericMessageResponse:
    """Clear the entire room cart."""
    return service.clear_room_cart(db, r, session)


# ── Room orders router ────────────────────────────────────────────────────────

orders_router = APIRouter()


@orders_router.post("", response_model=PlaceRoomOrderResponse, status_code=201)
def place_room_order(
    payload: PlaceRoomOrderRequest,
    session: RoomSession = Depends(get_current_room_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> PlaceRoomOrderResponse:
    """Place a room order from the guest's current room cart.

    Requires X-Room-Session header. restaurant_id and room context come
    from the validated session — not from the request body.
    """
    return service.place_room_order(db, r, session, payload)


@orders_router.get("/{order_id}", response_model=RoomOrderDetailResponse)
def get_room_order(
    order_id: int,
    session: RoomSession = Depends(get_current_room_session),
    db: Session = Depends(get_db),
) -> RoomOrderDetailResponse:
    """Return room order details for the guest who placed it.

    SECURITY: scoped to the guest's room session — cannot access other sessions' orders.
    """
    return service.get_room_order_for_guest(db, order_id, session)


@orders_router.post("/{order_id}/cancel", response_model=GenericMessageResponse)
def cancel_room_order(
    order_id: int,
    session: RoomSession = Depends(get_current_room_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> GenericMessageResponse:
    """Cancel a guest room order within the 5-second grace window."""
    return service.cancel_room_order_for_guest(db, r, order_id, session)
