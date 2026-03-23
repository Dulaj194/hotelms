"""Order service — all business logic lives here.

Responsibilities:
- Validate guest session context
- Load and validate cart contents from Redis
- Calculate server-authoritative totals from DB item prices
- Atomically create order_header, order_items, and initial payment record
- Clear cart after successful placement
- Publish real-time events via Redis pub/sub after placement and status changes
- Enforce status transition rules
- List pending / active / history / kitchen orders per restaurant
"""
from __future__ import annotations

from datetime import UTC, datetime

import redis as redis_lib
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.cart import repository as cart_repo
from app.modules.items.repository import get_by_id as get_item
from app.modules.orders import repository as order_repo
from app.modules.orders.model import OrderStatus
from app.modules.orders.schemas import (
    ActiveOrderListResponse,
    KitchenOrderCard,
    KitchenOrderItemSummary,
    KitchenOrderListResponse,
    OrderDetailResponse,
    OrderHeaderResponse,
    OrderItemResponse,
    OrderStatusResponse,
    PlaceOrderRequest,
    PlaceOrderResponse,
)
from app.modules.payments import repository as payment_repo
from app.modules.payments.schemas import PaymentResponse
from app.modules.realtime import service as realtime_service
from app.modules.table_sessions.model import TableSession


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_order_detail(order) -> OrderDetailResponse:
    return OrderDetailResponse(
        id=order.id,
        order_number=order.order_number,
        session_id=order.session_id,
        restaurant_id=order.restaurant_id,
        order_source=order.order_source,
        table_number=order.table_number,
        room_id=order.room_id,
        room_number=order.room_number,
        customer_name=order.customer_name,
        status=order.status,
        subtotal_amount=float(order.subtotal_amount),
        tax_amount=float(order.tax_amount),
        discount_amount=float(order.discount_amount),
        total_amount=float(order.total_amount),
        placed_at=order.placed_at,
        confirmed_at=order.confirmed_at,
        processing_at=order.processing_at,
        completed_at=order.completed_at,
        rejected_at=order.rejected_at,
        paid_at=order.paid_at,
        notes=order.notes,
        items=[
            OrderItemResponse(
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
        payments=[
            PaymentResponse(
                id=p.id,
                order_id=p.order_id,
                restaurant_id=p.restaurant_id,
                amount=float(p.amount),
                payment_method=p.payment_method,
                payment_status=p.payment_status,
                transaction_reference=p.transaction_reference,
                paid_at=p.paid_at,
                created_at=p.created_at,
            )
            for p in order.payments
        ],
    )


def _build_order_header(order) -> OrderHeaderResponse:
    return OrderHeaderResponse(
        id=order.id,
        order_number=order.order_number,
        session_id=order.session_id,
        restaurant_id=order.restaurant_id,
        order_source=order.order_source,
        table_number=order.table_number,
        room_id=order.room_id,
        room_number=order.room_number,
        customer_name=order.customer_name,
        status=order.status,
        subtotal_amount=float(order.subtotal_amount),
        tax_amount=float(order.tax_amount),
        discount_amount=float(order.discount_amount),
        total_amount=float(order.total_amount),
        placed_at=order.placed_at,
        confirmed_at=order.confirmed_at,
        processing_at=order.processing_at,
        completed_at=order.completed_at,
        rejected_at=order.rejected_at,
        paid_at=order.paid_at,
    )


def _build_kitchen_order_card(order) -> KitchenOrderCard:
    """Build a kitchen-optimised order card with item summaries."""
    return KitchenOrderCard(
        id=order.id,
        order_number=order.order_number,
        order_source=order.order_source,
        table_number=order.table_number,
        room_number=order.room_number,
        room_id=order.room_id,
        customer_name=order.customer_name,
        status=order.status,
        total_amount=float(order.total_amount),
        placed_at=order.placed_at,
        confirmed_at=order.confirmed_at,
        processing_at=order.processing_at,
        completed_at=order.completed_at,
        rejected_at=order.rejected_at,
        notes=order.notes,
        items=[
            KitchenOrderItemSummary(
                id=oi.id,
                item_id=oi.item_id,
                item_name_snapshot=oi.item_name_snapshot,
                quantity=oi.quantity,
                unit_price_snapshot=float(oi.unit_price_snapshot),
                line_total=float(oi.line_total),
            )
            for oi in order.items
        ],
    )


# ── Place order ───────────────────────────────────────────────────────────────

def place_order(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
    payload: PlaceOrderRequest,
) -> PlaceOrderResponse:
    """Convert the guest's Redis cart into a persisted order.

    SECURITY:
    - restaurant_id and session_id come from the validated TableSession object,
      never from the client request body.
    - All prices are loaded from the DB; client totals are not accepted.
    - The full create/flush/commit is wrapped so cart is only cleared on success.
    """
    # 1. Load raw cart
    raw_cart = cart_repo.get_cart_raw(r, session.session_id, session.restaurant_id)
    if not raw_cart:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cart is empty. Add items before placing an order.",
        )

    # 2. Validate each item and build line items (DB-authoritative prices)
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

    # 3. Persist order atomically
    try:
        order = order_repo.create_order_header(
            db,
            session_id=session.session_id,
            restaurant_id=session.restaurant_id,
            table_number=session.table_number,
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

    # 4. Clear cart only after successful commit
    cart_repo.clear_cart(r, session.session_id, session.restaurant_id)

    # 5. Reload with relationships for response
    db.refresh(order)
    # Reload with eager-loaded relationships
    placed = order_repo.get_order_by_id_and_session(
        db, order.id, session.session_id, session.restaurant_id
    )

    # 6. Publish real-time event so kitchen dashboard sees the order instantly
    try:
        realtime_service.publish_new_order(
            r,
            restaurant_id=session.restaurant_id,
            order_id=placed.id,
            order_number=placed.order_number,
            table_number=placed.table_number,
            order_source=placed.order_source,
            room_id=placed.room_id,
            room_number=placed.room_number,
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
        # Real-time failure must never break the order placement response
        pass

    return PlaceOrderResponse(order=_build_order_detail(placed))


# ── Guest order retrieval ─────────────────────────────────────────────────────

def get_order_for_guest(
    db: Session,
    order_id: int,
    session: TableSession,
) -> OrderDetailResponse:
    """Return order details for the guest who placed it."""
    order = order_repo.get_order_by_id_and_session(
        db, order_id, session.session_id, session.restaurant_id
    )
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )
    return _build_order_detail(order)


# ── Staff / admin order retrieval ─────────────────────────────────────────────

def get_order_for_staff(
    db: Session,
    order_id: int,
    restaurant_id: int,
) -> OrderDetailResponse:
    order = order_repo.get_order_by_id_and_restaurant(db, order_id, restaurant_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )
    return _build_order_detail(order)


def list_pending_orders(
    db: Session, restaurant_id: int
) -> KitchenOrderListResponse:
    """Return pending orders with item summaries for the kitchen dashboard."""
    orders = order_repo.list_pending_orders_by_restaurant(db, restaurant_id)
    return KitchenOrderListResponse(
        orders=[_build_kitchen_order_card(o) for o in orders],
        total=len(orders),
    )


def list_active_orders(
    db: Session, restaurant_id: int
) -> ActiveOrderListResponse:
    orders = order_repo.list_active_orders_by_restaurant(db, restaurant_id)
    return ActiveOrderListResponse(
        orders=[_build_order_header(o) for o in orders],
        total=len(orders),
    )


def list_history_orders(
    db: Session, restaurant_id: int
) -> ActiveOrderListResponse:
    orders = order_repo.list_history_orders_by_restaurant(db, restaurant_id)
    return ActiveOrderListResponse(
        orders=[_build_order_header(o) for o in orders],
        total=len(orders),
    )


def list_processing_orders(
    db: Session, restaurant_id: int
) -> KitchenOrderListResponse:
    """Return confirmed + processing orders with item summaries for the kitchen."""
    orders = order_repo.list_processing_orders_by_restaurant(db, restaurant_id)
    return KitchenOrderListResponse(
        orders=[_build_kitchen_order_card(o) for o in orders],
        total=len(orders),
    )


def list_kitchen_completed_orders(
    db: Session, restaurant_id: int
) -> KitchenOrderListResponse:
    """Return recently completed orders for the kitchen completed section."""
    orders = order_repo.list_kitchen_completed_orders_by_restaurant(db, restaurant_id)
    return KitchenOrderListResponse(
        orders=[_build_kitchen_order_card(o) for o in orders],
        total=len(orders),
    )


# ── Status update ─────────────────────────────────────────────────────────────

def update_order_status(
    db: Session,
    order_id: int,
    restaurant_id: int,
    new_status: OrderStatus,
    r: redis_lib.Redis | None = None,
) -> OrderStatusResponse:
    """Update order status with transition validation.

    Transition rules are defined in model.ALLOWED_TRANSITIONS.
    Publishes a real-time event via Redis pub/sub after a successful update.
    """
    order = order_repo.get_order_by_id_and_restaurant(db, order_id, restaurant_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    if not order_repo.is_transition_allowed(order.status, new_status):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Transition from '{order.status.value}' to '{new_status.value}' is not allowed."
            ),
        )

    updated = order_repo.update_order_status(db, order, new_status)
    db.commit()
    db.refresh(updated)

    # Publish real-time event after successful commit
    if r is not None:
        try:
            realtime_service.publish_order_status_updated(
                r,
                restaurant_id=restaurant_id,
                order_id=updated.id,
                order_number=updated.order_number,
                table_number=updated.table_number,
                order_source=updated.order_source,
                room_id=updated.room_id,
                room_number=updated.room_number,
                status=updated.status.value,
                updated_at=datetime.now(UTC),
            )
        except Exception:
            # Real-time failure must never break the status update response
            pass

    return OrderStatusResponse(
        id=updated.id,
        order_number=updated.order_number,
        status=updated.status,
        updated_at=updated.updated_at,
    )
