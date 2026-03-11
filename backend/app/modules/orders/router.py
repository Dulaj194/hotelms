"""Orders router — thin HTTP layer.

Route groups:
  POST   /orders               — guest: place order from cart
  GET    /orders/{order_id}    — guest: view own order (X-Guest-Session required)
  GET    /orders/pending       — staff: list pending orders for restaurant
  GET    /orders/active        — staff: list active orders for restaurant
  GET    /orders/history       — staff: list completed/paid/rejected orders
  PATCH  /orders/{order_id}/status — staff: update order status
"""
import redis as redis_lib
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_guest_session,
    get_current_restaurant_id,
    get_db,
    get_redis,
    require_roles,
)
from app.modules.orders import service
from app.modules.orders.model import OrderStatus
from app.modules.orders.schemas import (
    ActiveOrderListResponse,
    OrderDetailResponse,
    OrderStatusResponse,
    PendingOrderListResponse,
    PlaceOrderRequest,
    PlaceOrderResponse,
    UpdateOrderStatusRequest,
)
from app.modules.table_sessions.model import TableSession

router = APIRouter()

# ── Staff auth shorthand ──────────────────────────────────────────────────────
_STAFF_ROLES = ("owner", "admin", "steward")


# ── Guest endpoints ───────────────────────────────────────────────────────────

@router.post("", response_model=PlaceOrderResponse, status_code=201)
def place_order(
    payload: PlaceOrderRequest,
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> PlaceOrderResponse:
    """Place an order from the guest's current cart.

    Requires X-Guest-Session header. restaurant_id comes from the validated
    session — not from the request body.
    """
    return service.place_order(db, r, session, payload)


@router.get("/my/{order_id}", response_model=OrderDetailResponse)
def get_my_order(
    order_id: int,
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    """Return order details for the guest who placed it.

    Scoped to the guest session — a guest cannot view another session's order.
    """
    return service.get_order_for_guest(db, order_id, session)


# ── Staff / admin endpoints ───────────────────────────────────────────────────

@router.get("/pending", response_model=PendingOrderListResponse)
def list_pending_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
) -> PendingOrderListResponse:
    """List all pending orders for the authenticated user's restaurant."""
    return service.list_pending_orders(db, restaurant_id)


@router.get("/active", response_model=ActiveOrderListResponse)
def list_active_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
) -> ActiveOrderListResponse:
    """List all non-finalized orders (pending / confirmed / processing)."""
    return service.list_active_orders(db, restaurant_id)


@router.get("/history", response_model=ActiveOrderListResponse)
def list_history_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
) -> ActiveOrderListResponse:
    """List completed / paid / rejected orders for the restaurant."""
    return service.list_history_orders(db, restaurant_id)


@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order_detail(
    order_id: int,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
) -> OrderDetailResponse:
    """Return full order details for staff/admin, scoped to their restaurant."""
    return service.get_order_for_staff(db, order_id, restaurant_id)


@router.patch("/{order_id}/status", response_model=OrderStatusResponse)
def update_order_status(
    order_id: int,
    payload: UpdateOrderStatusRequest,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
) -> OrderStatusResponse:
    """Update the status of an order with transition validation."""
    return service.update_order_status(db, order_id, restaurant_id, payload.status)
