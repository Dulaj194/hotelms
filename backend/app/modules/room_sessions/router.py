"""Room sessions router — three endpoint groups registered separately.

Exports:
  session_router  → mounted at /room-sessions   (session start)
  cart_router     → mounted at /room-cart        (room cart CRUD)
  orders_router   → mounted at /room-orders      (room order placement + retrieval)

Guest retrieval/cart routes require a signed room session token in the
X-Room-Session header. Order placement can also bootstrap from X-Room-Key
when the checkout payload contains the client-side cart.
"""
import redis as redis_lib
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_room_session,
    get_db,
    get_redis,
    resolve_room_session_token,
)
from app.modules.table_sessions.schemas import TableServiceRequestPayload
from app.modules.room_sessions import service
from app.modules.room_sessions.model import RoomSession
from app.modules.room_sessions.schemas import (
    AddRoomCartItemRequest,
    GenericMessageResponse,
    PlaceRoomOrderRequest,
    PlaceRoomOrderResponse,
    RoomCartResponse,
    RoomOrderDetailResponse,
    RoomOrderListResponse,
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
    x_room_session: str | None = Header(default=None, alias="X-Room-Session"),
    x_room_key: str | None = Header(default=None, alias="X-Room-Key"),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> PlaceRoomOrderResponse:
    """Place a room order at checkout.

    Accepts either an existing X-Room-Session token or the original X-Room-Key
    QR credential. restaurant_id and room context are validated server-side.
    """
    if x_room_session:
        session = resolve_room_session_token(x_room_session, db)
        return service.place_room_order(db, r, session, payload)
    if x_room_key:
        return service.place_room_order_from_qr_key(db, r, x_room_key, payload)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing room checkout credential.",
    )


@orders_router.get("", response_model=RoomOrderListResponse)
def list_room_orders(
    session: RoomSession = Depends(get_current_room_session),
    db: Session = Depends(get_db),
) -> RoomOrderListResponse:
    """Return all room orders for the guest's current session.

    SECURITY: scoped to the guest's room session — cannot access other sessions' orders.
    """
    return service.list_room_orders_for_guest(db, session)


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


@orders_router.post("/request-service", response_model=GenericMessageResponse)
def request_room_service(
    payload: TableServiceRequestPayload,
    session: RoomSession = Depends(get_current_room_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> GenericMessageResponse:
    """Create a service request (Water, Steward, etc.) for a room."""
    from app.modules.table_sessions import service as table_session_service
    
    table_session_service.request_service(
        db, 
        r, 
        session_id=session.session_id,
        restaurant_id=session.restaurant_id,
        table_number=session.room_number_snapshot,
        customer_name=session.guest_name,
        service_type=payload.service_type,
        message=payload.message,
        order_source="room"
    )
    return GenericMessageResponse(message="Request sent to staff.")


@orders_router.post("/request-bill", response_model=GenericMessageResponse)
def request_room_bill(
    session: RoomSession = Depends(get_current_room_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> GenericMessageResponse:
    """Request the bill for a room session."""
    from app.modules.table_sessions import service as table_session_service
    
    table_session_service.request_service(
        db,
        r,
        session=session,
        service_type="BILL",
        order_source="room"
    )
    return GenericMessageResponse(message="Bill request sent to staff.")
