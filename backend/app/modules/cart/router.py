import redis as redis_lib
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_guest_session, get_db, get_redis
from app.modules.cart import service
from app.modules.cart.schemas import (
    AddCartItemRequest,
    CartResponse,
    CartSummaryResponse,
    GenericMessageResponse,
    UpdateCartItemRequest,
)
from app.modules.table_sessions.model import TableSession

router = APIRouter()


@router.get("", response_model=CartResponse)
def get_cart(
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> CartResponse:
    """Return current cart contents with DB-backed totals.

    Requires X-Guest-Session header with a valid signed guest token.
    """
    return service.get_cart(db, r, session)


@router.get("/summary", response_model=CartSummaryResponse)
def get_cart_summary(
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> CartSummaryResponse:
    """Lightweight cart summary for badge/header display."""
    return service.get_cart_summary(db, r, session)


@router.post("/items", response_model=CartResponse)
def add_cart_item(
    payload: AddCartItemRequest,
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> CartResponse:
    """Add an item to the cart.

    SECURITY: Price not accepted from client. Item validated against session restaurant.
    """
    return service.add_item(db, r, session, payload)


@router.patch("/items/{item_id}", response_model=CartResponse)
def update_cart_item(
    item_id: int,
    payload: UpdateCartItemRequest,
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> CartResponse:
    """Update quantity of a cart item."""
    return service.update_item(db, r, session, item_id, payload)


@router.delete("/items/{item_id}", response_model=CartResponse)
def remove_cart_item(
    item_id: int,
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> CartResponse:
    """Remove one item from the cart."""
    return service.remove_item(db, r, session, item_id)


@router.delete("", response_model=GenericMessageResponse)
def clear_cart(
    session: TableSession = Depends(get_current_guest_session),
    db: Session = Depends(get_db),
    r: redis_lib.Redis = Depends(get_redis),
) -> GenericMessageResponse:
    """Clear the entire cart."""
    return service.clear_cart(db, r, session)
