"""Cart service — business logic layer.

All totals are computed from DB-authoritative item records.
Redis holds only item_id -> quantity mappings.

SECURITY guarantees:
- Guest session token is validated before any cart operation.
- cart items must belong to the session's restaurant (cross-tenant blocked).
- Prices come from the DB, never from the client.
- Unavailable items cannot be added (can remain in cart if they become unavailable later,
  but are flagged clearly in the cart response).
"""

import redis as redis_lib
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.cart import repository as cart_repo
from app.modules.cart.schemas import (
    AddCartItemRequest,
    CartItemResponse,
    CartResponse,
    CartSummaryResponse,
    GenericMessageResponse,
    UpdateCartItemRequest,
)
from app.modules.items.repository import get_by_id as get_item
from app.modules.table_sessions.model import TableSession


def _build_cart_response(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
) -> CartResponse:
    """Build a full CartResponse by joining Redis quantities with DB item data."""
    raw = cart_repo.get_cart_raw(r, session.session_id, session.restaurant_id)

    items: list[CartItemResponse] = []
    total = 0.0

    for item_id_str, qty_str in raw.items():
        item_id = int(item_id_str)
        quantity = int(qty_str)

        # Fetch item from DB — scoped to the session's restaurant for cross-tenant safety
        item = get_item(db, item_id, session.restaurant_id)
        if item is None:
            # Item was deleted or moved — silently skip (will clean up on clear)
            continue

        unit_price = float(item.price)
        line_total = unit_price * quantity
        total += line_total

        items.append(
            CartItemResponse(
                item_id=item.id,
                name=item.name,
                unit_price=unit_price,
                quantity=quantity,
                line_total=round(line_total, 2),
                is_available=item.is_available,
            )
        )

    return CartResponse(
        session_id=session.session_id,
        restaurant_id=session.restaurant_id,
        table_number=session.table_number,
        items=items,
        total=round(total, 2),
        item_count=sum(i.quantity for i in items),
    )


def get_cart(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
) -> CartResponse:
    """Return current cart contents with DB-backed prices."""
    cart_repo.refresh_cart_ttl(r, session.session_id, session.restaurant_id)
    return _build_cart_response(db, r, session)


def get_cart_summary(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
) -> CartSummaryResponse:
    cart = _build_cart_response(db, r, session)
    return CartSummaryResponse(item_count=cart.item_count, total=cart.total)


def add_item(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
    data: AddCartItemRequest,
) -> CartResponse:
    """Add or increment an item in the cart.

    SECURITY:
    - item_id is validated against the session's restaurant (cross-tenant blocked).
    - Unavailable items cannot be added.
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

    # Get existing quantity and add to it
    raw = cart_repo.get_cart_raw(r, session.session_id, session.restaurant_id)
    existing_qty = int(raw.get(str(data.item_id), 0))
    new_qty = existing_qty + data.quantity

    cart_repo.set_cart_item(r, session.session_id, session.restaurant_id, data.item_id, new_qty)
    return _build_cart_response(db, r, session)


def update_item(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
    item_id: int,
    data: UpdateCartItemRequest,
) -> CartResponse:
    """Set absolute quantity for an item. Must be >= 1."""
    item = get_item(db, item_id, session.restaurant_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )

    cart_repo.set_cart_item(r, session.session_id, session.restaurant_id, item_id, data.quantity)
    return _build_cart_response(db, r, session)


def remove_item(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
    item_id: int,
) -> CartResponse:
    """Remove one line from the cart."""
    cart_repo.remove_cart_item(r, session.session_id, session.restaurant_id, item_id)
    return _build_cart_response(db, r, session)


def clear_cart(
    db: Session,
    r: redis_lib.Redis,
    session: TableSession,
) -> GenericMessageResponse:
    """Clear all items from the cart."""
    cart_repo.clear_cart(r, session.session_id, session.restaurant_id)
    return GenericMessageResponse(message="Cart cleared.")
