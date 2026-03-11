"""Repository layer for order_headers and order_items.

All methods are tenant-scoped (restaurant_id is always required for ownership
checks). No tenant-agnostic queries exist for order management.
"""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session, joinedload

from app.modules.orders.model import ALLOWED_TRANSITIONS, OrderHeader, OrderItem, OrderStatus


# ── Creation ──────────────────────────────────────────────────────────────────

def create_order_header(
    db: Session,
    *,
    session_id: str,
    restaurant_id: int,
    table_number: str,
    subtotal_amount: float,
    tax_amount: float,
    discount_amount: float,
    total_amount: float,
    notes: str | None,
    customer_name: str | None,
    customer_phone: str | None,
) -> OrderHeader:
    order = OrderHeader(
        session_id=session_id,
        restaurant_id=restaurant_id,
        table_number=table_number,
        subtotal_amount=round(subtotal_amount, 2),
        tax_amount=round(tax_amount, 2),
        discount_amount=round(discount_amount, 2),
        total_amount=round(total_amount, 2),
        notes=notes,
        customer_name=customer_name,
        customer_phone=customer_phone,
    )
    db.add(order)
    db.flush()  # get order.id without committing
    return order


def create_order_items(
    db: Session,
    order_id: int,
    restaurant_id: int,
    items: list[dict],
) -> list[OrderItem]:
    """Insert all order line items.

    Each dict in `items` must have:
      item_id, item_name_snapshot, unit_price_snapshot, quantity, line_total
    """
    order_items = []
    for item_data in items:
        oi = OrderItem(
            order_id=order_id,
            restaurant_id=restaurant_id,
            item_id=item_data["item_id"],
            item_name_snapshot=item_data["item_name_snapshot"],
            unit_price_snapshot=round(item_data["unit_price_snapshot"], 2),
            quantity=item_data["quantity"],
            line_total=round(item_data["line_total"], 2),
        )
        db.add(oi)
        order_items.append(oi)
    db.flush()
    return order_items


# ── Read ──────────────────────────────────────────────────────────────────────

def get_order_by_id_and_restaurant(
    db: Session, order_id: int, restaurant_id: int
) -> OrderHeader | None:
    """Load a full order (with items + payments) scoped to the restaurant."""
    return (
        db.query(OrderHeader)
        .options(joinedload(OrderHeader.items), joinedload(OrderHeader.payments))
        .filter(OrderHeader.id == order_id, OrderHeader.restaurant_id == restaurant_id)
        .first()
    )


def get_order_by_id_and_session(
    db: Session, order_id: int, session_id: str, restaurant_id: int
) -> OrderHeader | None:
    """Load order scoped to both session and restaurant (for guest access)."""
    return (
        db.query(OrderHeader)
        .options(joinedload(OrderHeader.items), joinedload(OrderHeader.payments))
        .filter(
            OrderHeader.id == order_id,
            OrderHeader.session_id == session_id,
            OrderHeader.restaurant_id == restaurant_id,
        )
        .first()
    )


def get_order_by_number_and_session(
    db: Session, order_number: str, session_id: str, restaurant_id: int
) -> OrderHeader | None:
    """Load order by order_number scoped to the session (for guest polling)."""
    return (
        db.query(OrderHeader)
        .options(joinedload(OrderHeader.items), joinedload(OrderHeader.payments))
        .filter(
            OrderHeader.order_number == order_number,
            OrderHeader.session_id == session_id,
            OrderHeader.restaurant_id == restaurant_id,
        )
        .first()
    )


def list_pending_orders_by_restaurant(
    db: Session, restaurant_id: int
) -> list[OrderHeader]:
    return (
        db.query(OrderHeader)
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status == OrderStatus.pending,
        )
        .order_by(OrderHeader.placed_at.asc())
        .all()
    )


def list_active_orders_by_restaurant(
    db: Session, restaurant_id: int
) -> list[OrderHeader]:
    """Return all non-finalized orders (pending / confirmed / processing)."""
    active_statuses = {OrderStatus.pending, OrderStatus.confirmed, OrderStatus.processing}
    return (
        db.query(OrderHeader)
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status.in_(active_statuses),
        )
        .order_by(OrderHeader.placed_at.asc())
        .all()
    )


def list_history_orders_by_restaurant(
    db: Session, restaurant_id: int, limit: int = 100
) -> list[OrderHeader]:
    """Return completed, paid, and rejected orders for a restaurant."""
    history_statuses = {OrderStatus.completed, OrderStatus.paid, OrderStatus.rejected}
    return (
        db.query(OrderHeader)
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status.in_(history_statuses),
        )
        .order_by(OrderHeader.placed_at.desc())
        .limit(limit)
        .all()
    )


# ── Update ────────────────────────────────────────────────────────────────────

def update_order_status(
    db: Session,
    order: OrderHeader,
    new_status: OrderStatus,
) -> OrderHeader:
    """Persist new status + the matching lifecycle timestamp."""
    order.status = new_status
    now = datetime.now(UTC)

    timestamp_map: dict[OrderStatus, str] = {
        OrderStatus.confirmed: "confirmed_at",
        OrderStatus.processing: "processing_at",
        OrderStatus.completed: "completed_at",
        OrderStatus.rejected: "rejected_at",
        OrderStatus.paid: "paid_at",
    }
    field = timestamp_map.get(new_status)
    if field:
        setattr(order, field, now)

    db.flush()
    return order


def is_transition_allowed(current: OrderStatus, target: OrderStatus) -> bool:
    """Return True if the status transition is permitted."""
    return target in ALLOWED_TRANSITIONS.get(current, set())
