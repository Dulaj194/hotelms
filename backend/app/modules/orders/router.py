"""Orders router — thin HTTP layer.

Route groups:
  POST   /orders               — guest: place order from cart
  GET    /orders/my            — guest: list all own orders (X-Guest-Session required)
  GET    /orders/my/{order_id} — guest: view own order (X-Guest-Session required)
  GET    /orders/pending       — staff: pending orders (kitchen dashboard)
  GET    /orders/processing    — staff: confirmed + processing orders (kitchen)
  GET    /orders/completed     — staff: recently completed orders (kitchen)
  GET    /orders/active        — staff: all active orders
  GET    /orders/history       — staff: completed/paid/rejected order history
  GET    /orders/{order_id}    — staff: full order detail
  PATCH  /orders/{order_id}/status — staff: update order status + publish event
"""
import redis as redis_lib
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_guest_session,
    get_current_restaurant_id,
    get_db,
    get_redis,
    require_module_access,
    require_roles,
)
from app.modules.access import role_catalog
from app.modules.orders import service
from app.modules.orders.model import OrderStatus
from app.modules.orders.schemas import (
    ActiveOrderListResponse,
    KitchenOrderListResponse,
    OrderDetailResponse,
    OrderStatusResponse,
    PlaceOrderRequest,
    PlaceOrderResponse,
    UpdateOrderStatusRequest,
)
from app.modules.table_sessions.model import TableSession

router = APIRouter()

# ── Staff auth shorthand ──────────────────────────────────────────────────────
_STAFF_ROLES = role_catalog.QR_MENU_STAFF_ROLES


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


@router.get("/my", response_model=ActiveOrderListResponse)
def list_my_orders(
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
) -> ActiveOrderListResponse:
    """Return all orders for the guest's current session.

    Includes all order statuses (pending, confirmed, processing, completed, paid, rejected).
    Scoped to the guest session — a guest can only see their own orders.
    """
    return service.list_orders_for_guest(db, session)


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


@router.post("/my/{order_id}/cancel", response_model=OrderStatusResponse)
def cancel_my_order(
    order_id: int,
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> OrderStatusResponse:
    """Cancel a guest's own pending order within the 5-second grace window."""
    return service.cancel_order_for_guest(db, order_id, session, r)


# ── Kitchen dashboard endpoints ───────────────────────────────────────────────

@router.get("/pending", response_model=KitchenOrderListResponse)
def list_pending_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> KitchenOrderListResponse:
    """List pending orders with item summaries for the kitchen dashboard."""
    return service.list_pending_orders(db, restaurant_id)


@router.get("/processing", response_model=KitchenOrderListResponse)
def list_processing_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> KitchenOrderListResponse:
    """List confirmed + processing orders with item summaries for the kitchen."""
    return service.list_processing_orders(db, restaurant_id)


@router.get("/completed", response_model=KitchenOrderListResponse)
def list_completed_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> KitchenOrderListResponse:
    """List recently completed orders for the kitchen completed section."""
    return service.list_kitchen_completed_orders(db, restaurant_id)


# ── Staff / admin list endpoints ──────────────────────────────────────────────

@router.get("/active", response_model=ActiveOrderListResponse)
def list_active_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> ActiveOrderListResponse:
    """List all non-finalized orders (pending / confirmed / processing)."""
    return service.list_active_orders(db, restaurant_id)


@router.get("/history", response_model=ActiveOrderListResponse)
def list_history_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> ActiveOrderListResponse:
    """List completed / paid / rejected orders for the restaurant."""
    return service.list_history_orders(db, restaurant_id)


@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order_detail(
    order_id: int,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> OrderDetailResponse:
    """Return full order details for staff/admin, scoped to their restaurant."""
    return service.get_order_for_staff(db, order_id, restaurant_id)


@router.patch("/{order_id}/status", response_model=OrderStatusResponse)
def update_order_status(
    order_id: int,
    payload: UpdateOrderStatusRequest,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> OrderStatusResponse:
    """Update order status with transition validation.

    Publishes a real-time event to the restaurant's Redis pub/sub channel
    so connected kitchen clients receive the update instantly.
    """
    return service.update_order_status(db, order_id, restaurant_id, payload.status, r)
