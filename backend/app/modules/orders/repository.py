"""Repository layer for order_headers and order_items.

All methods are tenant-scoped (restaurant_id is always required for ownership
checks). No tenant-agnostic queries exist for order management.
"""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session, joinedload

from app.modules.orders.model import (
    ALLOWED_TRANSITIONS,
    OrderHeader,
    OrderItem,
    OrderSource,
    OrderStatus,
)


# ── Creation ──────────────────────────────────────────────────────────────────

def create_order_header(
    db: Session,
    *,
    session_id: str,
    restaurant_id: int,
    table_number: str | None,
    order_source: OrderSource | str = OrderSource.table,
    room_id: int | None = None,
    room_number: str | None = None,
    initial_status: OrderStatus = OrderStatus.pending,
    subtotal_amount: float,
    tax_amount: float,
    discount_amount: float,
    total_amount: float,
    notes: str | None,
    customer_name: str | None,
    customer_phone: str | None,
) -> OrderHeader:
    now = datetime.now(UTC)
    source_value = (
        order_source
        if isinstance(order_source, OrderSource)
        else OrderSource(str(order_source))
    )
    lifecycle_timestamps: dict[str, datetime] = {}
    if initial_status == OrderStatus.confirmed:
        lifecycle_timestamps["confirmed_at"] = now
    elif initial_status == OrderStatus.processing:
        lifecycle_timestamps["processing_at"] = now
    elif initial_status == OrderStatus.completed:
        lifecycle_timestamps["completed_at"] = now
    elif initial_status == OrderStatus.rejected:
        lifecycle_timestamps["rejected_at"] = now
    elif initial_status == OrderStatus.paid:
        lifecycle_timestamps["paid_at"] = now

    order = OrderHeader(
        session_id=session_id,
        restaurant_id=restaurant_id,
        table_number=table_number,
        order_source=source_value,
        room_id=room_id,
        room_number=room_number,
        status=initial_status,
        subtotal_amount=round(subtotal_amount, 2),
        tax_amount=round(tax_amount, 2),
        discount_amount=round(discount_amount, 2),
        total_amount=round(total_amount, 2),
        notes=notes,
        customer_name=customer_name,
        customer_phone=customer_phone,
        **lifecycle_timestamps,
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
      item_id, item_name_snapshot, item_image_snapshot, unit_price_snapshot, quantity, line_total
    """
    order_items = []
    for item_data in items:
        oi = OrderItem(
            order_id=order_id,
            restaurant_id=restaurant_id,
            item_id=item_data["item_id"],
            item_name_snapshot=item_data["item_name_snapshot"],
            item_image_snapshot=item_data.get("item_image_snapshot"),
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
        .options(joinedload(OrderHeader.items))
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
        .options(joinedload(OrderHeader.items))
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status.in_(active_statuses),
        )
        .order_by(OrderHeader.placed_at.asc())
        .all()
    )


def list_history_orders_by_restaurant(
    db: Session, 
    restaurant_id: int, 
    status: OrderStatus | None = None,
    limit: int = 100
) -> list[OrderHeader]:
    """Return completed, paid, and rejected orders for a restaurant."""
    history_statuses = {OrderStatus.completed, OrderStatus.paid, OrderStatus.rejected}
    query = (
        db.query(OrderHeader)
        .options(joinedload(OrderHeader.items))
        .filter(OrderHeader.restaurant_id == restaurant_id)
    )
    
    if status:
        query = query.filter(OrderHeader.status == status)
    else:
        query = query.filter(OrderHeader.status.in_(history_statuses))
        
    return query.order_by(OrderHeader.placed_at.desc()).limit(limit).all()


def count_history_orders_by_restaurant(
    db: Session, 
    restaurant_id: int
) -> dict[str, int]:
    """Return counts for completed, paid, and rejected orders."""
    history_statuses = {OrderStatus.completed, OrderStatus.paid, OrderStatus.rejected}
    
    from sqlalchemy import func
    results = (
        db.query(OrderHeader.status, func.count(OrderHeader.id))
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status.in_(history_statuses)
        )
        .group_by(OrderHeader.status)
        .all()
    )
    
    # Initialize with 0s
    counts = {"completed": 0, "paid": 0, "rejected": 0}
    for status_val, count in results:
        if status_val.value in counts:
            counts[status_val.value] = count
            
    return counts


def count_active_steward_stats(db: Session, restaurant_id: int) -> int:
    """Return the count of pending orders (Awaiting confirmation)."""
    return (
        db.query(OrderHeader)
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status == OrderStatus.pending,
        )
        .count()
    )


# ── Kitchen-specific queries (include items for dashboard display) ─────────────

def list_processing_orders_by_restaurant(
    db: Session, restaurant_id: int
) -> list[OrderHeader]:
    """Return confirmed + processing orders with items eagerly loaded."""
    in_progress = {OrderStatus.confirmed, OrderStatus.processing}
    return (
        db.query(OrderHeader)
        .options(joinedload(OrderHeader.items))
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status.in_(in_progress),
        )
        .order_by(OrderHeader.placed_at.asc())
        .all()
    )


def list_kitchen_completed_orders_by_restaurant(
    db: Session, restaurant_id: int, limit: int = 50
) -> list[OrderHeader]:
    """Return recently completed orders with items eagerly loaded."""
    return (
        db.query(OrderHeader)
        .options(joinedload(OrderHeader.items))
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status == OrderStatus.completed,
        )
        .order_by(OrderHeader.completed_at.desc())
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


# ── Billing queries (session-scoped) ──────────────────────────────────────────

def list_billable_orders_by_session(
    db: Session,
    session_id: str,
    restaurant_id: int,
) -> list[OrderHeader]:
    """Return completed, not-yet-paid orders for a session.

    'Billable' == status is exactly OrderStatus.completed.
    Orders in paid/rejected/pending/confirmed/processing states are excluded.
    Items are eagerly loaded so the caller can build line-item breakdowns.
    """
    return (
        db.query(OrderHeader)
        .options(joinedload(OrderHeader.items))
        .filter(
            OrderHeader.session_id == session_id,
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status == OrderStatus.completed,
        )
        .order_by(OrderHeader.placed_at.asc())
        .all()
    )


def list_orders_by_session(
    db: Session,
    session_id: str,
    restaurant_id: int,
    *,
    statuses: list[OrderStatus] | None = None,
) -> list[OrderHeader]:
    query = (
        db.query(OrderHeader)
        .options(joinedload(OrderHeader.items))
        .filter(
            OrderHeader.session_id == session_id,
            OrderHeader.restaurant_id == restaurant_id,
        )
    )
    if statuses:
        query = query.filter(OrderHeader.status.in_(statuses))
    return query.order_by(OrderHeader.placed_at.asc()).all()


def mark_orders_paid_by_ids(
    db: Session,
    *,
    order_ids: list[int],
    restaurant_id: int,
    paid_at: datetime,
) -> None:
    """Bulk-update order statuses to paid and set paid_at.

    Uses a WHERE … IN filter so only orders belonging to this restaurant
    can ever be updated. The caller is responsible for committing.
    """
    if not order_ids:
        return
    (
        db.query(OrderHeader)
        .filter(
            OrderHeader.id.in_(order_ids),
            OrderHeader.restaurant_id == restaurant_id,
        )
        .update(
            {
                OrderHeader.status: OrderStatus.paid,
                OrderHeader.paid_at: paid_at,
            },
            synchronize_session=False,
        )
    )
    db.flush()


def mark_orders_completed_by_ids(
    db: Session,
    *,
    order_ids: list[int],
    restaurant_id: int,
    completed_at: datetime,
) -> None:
    """Bulk-update order statuses back to completed and clear paid_at.

    Used by billing reversal flows (refund/void/reversal) to reopen
    previously paid orders for reconciliation-safe recovery.
    """
    if not order_ids:
        return
    (
        db.query(OrderHeader)
        .filter(
            OrderHeader.id.in_(order_ids),
            OrderHeader.restaurant_id == restaurant_id,
        )
        .update(
            {
                OrderHeader.status: OrderStatus.completed,
                OrderHeader.completed_at: completed_at,
                OrderHeader.paid_at: None,
            },
            synchronize_session=False,
        )
    )
    db.flush()
