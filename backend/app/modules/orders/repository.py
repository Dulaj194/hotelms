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
    """Creates a new order header.

    Args:
        db (Session): The database session.
        session_id (str): The ID of the session placing the order.
        restaurant_id (int): The ID of the restaurant.
        table_number (str | None): The table number, if applicable.
        order_source (OrderSource | str, optional): The origin of the order. Defaults to OrderSource.table.
        room_id (int | None, optional): The room ID, if applicable. Defaults to None.
        room_number (str | None, optional): The room number, if applicable. Defaults to None.
        initial_status (OrderStatus, optional): The starting status of the order. Defaults to OrderStatus.pending.
        subtotal_amount (float): The subtotal before tax and discounts.
        tax_amount (float): The applied tax.
        discount_amount (float): The applied discount.
        total_amount (float): The final total amount.
        notes (str | None): Any special notes.
        customer_name (str | None): The customer's name.
        customer_phone (str | None): The customer's phone.

    Returns:
        OrderHeader: The created order header record.
    """
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
    elif initial_status == OrderStatus.served:
        lifecycle_timestamps["served_at"] = now
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
    """Inserts all order line items for an order.

    Each dict in `items` must have:
      - item_id (int)
      - item_name_snapshot (str)
      - item_image_snapshot (str | None)
      - unit_price_snapshot (float)
      - quantity (int)
      - line_total (float)
      - note (str | None)

    Args:
        db (Session): The database session.
        order_id (int): The ID of the associated order.
        restaurant_id (int): The ID of the restaurant.
        items (list[dict]): A list of dictionaries containing item details.

    Returns:
        list[OrderItem]: A list of the created order items.
    """
    order_items = []
    for item_data in items:
        oi = OrderItem(
            order_id=order_id,
            restaurant_id=restaurant_id,
            item_id=item_data["item_id"],
            item_name_snapshot=item_data["item_name_snapshot"],
            item_name_snapshot_localized=item_data.get("item_name_snapshot_localized"),
            item_image_snapshot=item_data.get("item_image_snapshot"),
            unit_price_snapshot=round(item_data["unit_price_snapshot"], 2),
            quantity=item_data["quantity"],
            line_total=round(item_data["line_total"], 2),
            notes=item_data.get("note"),
        )
        db.add(oi)
        order_items.append(oi)
    db.flush()
    return order_items


# ── Read ──────────────────────────────────────────────────────────────────────

def get_order_by_id_and_restaurant(
    db: Session, order_id: int, restaurant_id: int
) -> OrderHeader | None:
    """Loads a full order (with items + payments) scoped to the restaurant.

    Args:
        db (Session): The database session.
        order_id (int): The order ID.
        restaurant_id (int): The restaurant ID.

    Returns:
        OrderHeader | None: The loaded order header, or None if not found.
    """
    return (
        db.query(OrderHeader)
        .options(joinedload(OrderHeader.items), joinedload(OrderHeader.payments))
        .filter(OrderHeader.id == order_id, OrderHeader.restaurant_id == restaurant_id)
        .first()
    )


def get_order_by_id_and_session(
    db: Session, order_id: int, session_id: str, restaurant_id: int
) -> OrderHeader | None:
    """Loads an order scoped to both session and restaurant (for guest access).

    Args:
        db (Session): The database session.
        order_id (int): The order ID.
        session_id (str): The session ID that placed the order.
        restaurant_id (int): The restaurant ID.

    Returns:
        OrderHeader | None: The loaded order header, or None if not found.
    """
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
    """Loads an order by its order_number scoped to the session (for guest polling).

    Args:
        db (Session): The database session.
        order_number (str): The human-readable order number.
        session_id (str): The session ID that placed the order.
        restaurant_id (int): The restaurant ID.

    Returns:
        OrderHeader | None: The loaded order header, or None if not found.
    """
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
    """Retrieves all pending orders for a given restaurant.

    Args:
        db (Session): The database session.
        restaurant_id (int): The ID of the restaurant.

    Returns:
        list[OrderHeader]: A list of pending order headers.
    """
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


from sqlalchemy import or_

def list_active_orders_by_restaurant(
    db: Session, 
    restaurant_id: int,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "asc",
) -> tuple[list[OrderHeader], int]:
    """Returns all non-finalized orders (pending / confirmed / processing).

    Args:
        db (Session): The database session.
        restaurant_id (int): The restaurant ID.
        skip (int, optional): Pagination offset. Defaults to 0.
        limit (int, optional): Pagination limit. Defaults to 50.
        search (str | None, optional): Optional search filter. Defaults to None.
        sort_by (str | None, optional): Column to sort by. Defaults to None.
        sort_order (str, optional): Sorting order ("asc" or "desc"). Defaults to "asc".

    Returns:
        tuple[list[OrderHeader], int]: A tuple containing the list of orders and the total count.
    """
    active_statuses = {OrderStatus.pending, OrderStatus.confirmed, OrderStatus.processing}
    query = (
        db.query(OrderHeader)
        .options(joinedload(OrderHeader.items))
        .filter(
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status.in_(active_statuses),
        )
    )
    
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                OrderHeader.order_number.ilike(pattern),
                OrderHeader.table_number.ilike(pattern),
                OrderHeader.room_number.ilike(pattern),
                OrderHeader.customer_name.ilike(pattern),
            )
        )
        
    total = query.count()
    
    # Sorting
    if sort_by == "order_number":
        order_col = OrderHeader.order_number
    elif sort_by == "total_amount":
        order_col = OrderHeader.total_amount
    else:
        order_col = OrderHeader.placed_at
        
    if sort_order.lower() == "desc":
        query = query.order_by(order_col.desc())
    else:
        query = query.order_by(order_col.asc())
        
    items = query.offset(skip).limit(limit).all()
    return items, total


def list_history_orders_by_restaurant(
    db: Session, 
    restaurant_id: int, 
    status: OrderStatus | None = None,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
) -> tuple[list[OrderHeader], int]:
    """Returns completed, paid, and rejected orders for a restaurant.

    Args:
        db (Session): The database session.
        restaurant_id (int): The restaurant ID.
        status (OrderStatus | None, optional): A specific status to filter by. Defaults to None.
        skip (int, optional): Pagination offset. Defaults to 0.
        limit (int, optional): Pagination limit. Defaults to 50.
        search (str | None, optional): Optional search filter. Defaults to None.
        sort_by (str | None, optional): Column to sort by. Defaults to None.
        sort_order (str, optional): Sorting order ("asc" or "desc"). Defaults to "desc".

    Returns:
        tuple[list[OrderHeader], int]: A tuple containing the list of orders and the total count.
    """
    history_statuses = {OrderStatus.completed, OrderStatus.served, OrderStatus.paid, OrderStatus.rejected}
    try:
        query = (
            db.query(OrderHeader)
            .options(joinedload(OrderHeader.items))
            .filter(OrderHeader.restaurant_id == restaurant_id)
        )
        
        if status:
            query = query.filter(OrderHeader.status == status)
        else:
            query = query.filter(OrderHeader.status.in_(history_statuses))
            
        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    OrderHeader.order_number.ilike(pattern),
                    OrderHeader.table_number.ilike(pattern),
                    OrderHeader.room_number.ilike(pattern),
                    OrderHeader.customer_name.ilike(pattern),
                )
            )
            
        total = query.count()
        
        # Sorting
        if sort_by == "order_number":
            order_col = OrderHeader.order_number
        elif sort_by == "total_amount":
            order_col = OrderHeader.total_amount
        else:
            order_col = OrderHeader.placed_at
            
        if sort_order.lower() == "asc":
            query = query.order_by(order_col.asc())
        else:
            query = query.order_by(order_col.desc())
            
        items = query.offset(skip).limit(limit).all()
        return items, total
    except Exception as exc:
        from app.core.logging import get_logger
        get_logger(__name__).error("Failed to list history orders: %s", str(exc), exc_info=True)
        return [], 0


def count_history_orders_by_restaurant(
    db: Session, 
    restaurant_id: int
) -> dict[str, int]:
    """Return counts for completed, served, paid, and rejected orders."""
    history_statuses = {OrderStatus.completed, OrderStatus.served, OrderStatus.paid, OrderStatus.rejected}
    
    # Initialize with 0s
    counts = {"completed": 0, "served": 0, "paid": 0, "rejected": 0}
    
    try:
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
        
        for status_val, count in results:
            if status_val in counts:
                counts[status_val] = count
    except Exception as exc:
        from app.core.logging import get_logger
        get_logger(__name__).error("Failed to count history orders: %s", str(exc), exc_info=True)
            
    return counts


def count_active_steward_stats(db: Session, restaurant_id: int) -> int:
    """Return the count of pending orders (Awaiting confirmation)."""
    try:
        return (
            db.query(OrderHeader)
            .filter(
                OrderHeader.restaurant_id == restaurant_id,
                OrderHeader.status == OrderStatus.pending,
            )
            .count()
        )
    except Exception as exc:
        from app.core.logging import get_logger
        get_logger(__name__).error("Failed to count active steward stats: %s", str(exc))
        return 0


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
            OrderHeader.status.in_({OrderStatus.completed, OrderStatus.served}),
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
        OrderStatus.served: "served_at",
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

    'Billable' == status is any active status except paid or rejected.
    Orders in pending, confirmed, processing, served, and completed states are included.
    Items are eagerly loaded so the caller can build line-item breakdowns.
    """
    billable_statuses = {
        OrderStatus.pending,
        OrderStatus.confirmed,
        OrderStatus.processing,
        OrderStatus.served,
        OrderStatus.completed,
    }
    return (
        db.query(OrderHeader)
        .options(joinedload(OrderHeader.items))
        .filter(
            OrderHeader.session_id == session_id,
            OrderHeader.restaurant_id == restaurant_id,
            OrderHeader.status.in_(billable_statuses),
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
