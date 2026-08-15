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
from fastapi import APIRouter, Depends, Header, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_language
from app.core.dependencies import (
    get_current_guest_session,
    get_current_restaurant_id,
    get_db,
    get_redis,
    resolve_guest_session_token,
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
    UpdateOrderItemStatusRequest,
)
from app.core.pagination import PaginationParams, FilterParams, create_paginated_response, pagination_depends
from app.core.response_utils import success_response
from app.core.response_schemas import ApiResponse
from typing import Any
from app.modules.table_sessions.model import TableSession

router = APIRouter()

# ── Staff auth shorthand ──────────────────────────────────────────────────────
_STAFF_ROLES = role_catalog.QR_MENU_STAFF_ROLES


# ── Guest endpoints ───────────────────────────────────────────────────────────

@router.post("", response_model=ApiResponse[PlaceOrderResponse], status_code=201)
def place_order(
    payload: PlaceOrderRequest,
    request: Request,
    x_guest_session: str | None = Header(default=None, alias="X-Guest-Session"),
    x_table_key: str | None = Header(default=None, alias="X-Table-Key"),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> ApiResponse:
    """Place a table order at checkout.

    Accepts either an existing X-Guest-Session token or the original X-Table-Key
    QR credential. restaurant_id and table context are validated server-side.
    """
    lang = get_language(request)
    if x_guest_session:
        session = resolve_guest_session_token(x_guest_session, db)
        return success_response(data=service.place_order(db, r, session, payload, lang=lang), message="Order placed successfully")
    if x_table_key:
        return success_response(data=service.place_order_from_qr_key(db, r, x_table_key, payload, lang=lang), message="Order placed successfully")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing table checkout credential.",
    )


@router.get("/my", response_model=ApiResponse[ActiveOrderListResponse])
def list_my_orders(
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Return all orders for the guest's current session.

    Includes all order statuses (pending, confirmed, processing, completed, paid, rejected).
    Scoped to the guest session — a guest can only see their own orders.
    """
    return success_response(data=service.list_orders_for_guest(db, session), message="Guest orders retrieved")


@router.get("/my/{order_id}", response_model=ApiResponse[OrderDetailResponse])
def get_my_order(
    order_id: int,
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Return order details for the guest who placed it.

    Scoped to the guest session — a guest cannot view another session's order.
    """
    return success_response(data=service.get_order_for_guest(db, order_id, session), message="Order detail retrieved")


@router.post("/my/{order_id}/cancel", response_model=ApiResponse[OrderStatusResponse])
def cancel_my_order(
    order_id: int,
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> ApiResponse:
    """Cancel a guest's own pending order within the 5-second grace window."""
    return success_response(data=service.cancel_order_for_guest(db, order_id, session, r), message="Order cancelled")


# ── Kitchen dashboard endpoints ───────────────────────────────────────────────

@router.get("/pending", response_model=ApiResponse[KitchenOrderListResponse])
def list_pending_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> ApiResponse:
    """List pending orders with item summaries for the kitchen dashboard."""
    return success_response(data=service.list_pending_orders(db, restaurant_id), message="Pending orders retrieved")


@router.get("/processing", response_model=ApiResponse[KitchenOrderListResponse])
def list_processing_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> ApiResponse:
    """List confirmed + processing orders with item summaries for the kitchen."""
    return success_response(data=service.list_processing_orders(db, restaurant_id), message="Processing orders retrieved")


@router.get("/completed", response_model=ApiResponse[KitchenOrderListResponse])
def list_completed_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> ApiResponse:
    """List recently completed orders for the kitchen completed section."""
    return success_response(data=service.list_kitchen_completed_orders(db, restaurant_id), message="Completed orders retrieved")


# ── Staff / admin list endpoints ──────────────────────────────────────────────

@router.get("/active", response_model=ApiResponse[Any])
def list_active_orders(
    restaurant_id: int = Depends(get_current_restaurant_id),
    pagination: PaginationParams = Depends(pagination_depends),
    filters: FilterParams = Depends(),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> ApiResponse:
    """List all non-finalized orders (pending / confirmed / processing)."""
    orders, total = service.list_active_orders(
        db, 
        restaurant_id,
        skip=pagination.skip,
        limit=pagination.limit,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order.value if filters.sort_order else "asc"
    )
    paginated_data = create_paginated_response(orders, total, pagination.page, pagination.limit)
    return success_response(data=paginated_data, message="Active orders listed successfully.")


@router.get("/history", response_model=ApiResponse[Any])
def list_history_orders(
    status: OrderStatus | None = None,
    restaurant_id: int = Depends(get_current_restaurant_id),
    pagination: PaginationParams = Depends(pagination_depends),
    filters: FilterParams = Depends(),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> ApiResponse:
    """List completed / paid / rejected orders for the restaurant."""
    orders, total = service.list_history_orders(
        db, 
        restaurant_id, 
        status=status,
        skip=pagination.skip,
        limit=pagination.limit,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order.value if filters.sort_order else "desc"
    )
    paginated_data = create_paginated_response(orders, total, pagination.page, pagination.limit)
    return success_response(data=paginated_data, message="History orders listed successfully.")


@router.get("/history/stats", response_model=ApiResponse[dict[str, int]])
def get_history_stats(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> ApiResponse:
    """Return counts for history order statuses."""
    return success_response(data=service.get_history_stats(db, restaurant_id), message="Stats retrieved")


@router.get("/badge-counts", response_model=ApiResponse[dict[str, int]])
def get_badge_counts(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
) -> ApiResponse:
    """Return counts for sidebar notification badges."""
    return success_response(data=service.get_badge_counts(db, restaurant_id), message="Badge counts retrieved")


@router.get("/{order_id}", response_model=ApiResponse[OrderDetailResponse])
def get_order_detail(
    order_id: int,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> ApiResponse:
    """Return full order details for staff/admin, scoped to their restaurant."""
    return success_response(data=service.get_order_for_staff(db, order_id, restaurant_id), message="Order detail retrieved")


@router.patch("/{order_id}/status", response_model=ApiResponse[OrderStatusResponse])
def update_order_status(
    order_id: int,
    payload: UpdateOrderStatusRequest,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> ApiResponse:
    """Update order status with transition validation.

    Publishes a real-time event to the restaurant's Redis pub/sub channel
    so connected kitchen clients receive the update instantly.
    """
    return success_response(data=service.update_order_status(db, order_id, restaurant_id, payload.status, r), message="Order status updated")


@router.patch("/{order_id}/items/{item_id}/status", response_model=ApiResponse[OrderStatusResponse])
def update_order_item_status(
    order_id: int,
    item_id: int,
    payload: UpdateOrderItemStatusRequest,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("kds")),
) -> ApiResponse:
    """Update an individual order item's status and derive parent order status.

    Publishes a real-time event to the restaurant's Redis pub/sub channel.
    """
    return success_response(data=service.update_order_item_status(db, order_id, item_id, restaurant_id, payload.status, r), message="Item status updated")


@router.post("/staff/place-order", response_model=ApiResponse[PlaceOrderResponse], status_code=201)
def staff_place_order(
    payload: PlaceOrderRequest,
    session_id: str,
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user=Depends(require_roles(*role_catalog.QR_MENU_STAFF_ROLES)),
) -> ApiResponse:
    """Place an order for a guest session as a staff member."""
    return success_response(data=service.place_staff_order(db, r, restaurant_id, session_id, payload), message="Order placed successfully")
