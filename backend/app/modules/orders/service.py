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

import uuid
from datetime import UTC, datetime, timedelta

import redis as redis_lib
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_guest_session_token, decode_table_qr_access_token
from app.modules.cart import repository as cart_repo
from app.modules.items.repository import get_by_id as get_item
from app.modules.orders import repository as order_repo
from app.modules.orders.model import OrderStatus
from app.modules.orders.schemas import (
    ActiveOrderListResponse,
    KitchenOrderCard,
)
from app.modules.table_sessions import repository as ts_repo
    KitchenOrderItemSummary,
    KitchenOrderListResponse,
    OrderDetailResponse,
    OrderHeaderResponse,
    OrderItemPreviewResponse,
    OrderItemResponse,
    OrderStatusResponse,
    PlaceOrderRequest,
    PlaceOrderResponse,
)
from app.modules.payments import repository as payment_repo
from app.modules.payments.schemas import PaymentResponse
from app.modules.promo_codes import repository as promo_repo
from app.modules.promo_codes.model import PromoCodeUsage
from app.modules.promo_codes.schemas import PromoCodeValidateRequest
from app.modules.promo_codes.service import validate_promo_for_restaurant
from app.modules.realtime import service as realtime_service
from app.modules.restaurants.repository import get_by_id as get_restaurant
from app.modules.table_sessions import repository as table_session_repo
from app.modules.table_sessions.model import TableSession


GUEST_CANCEL_WINDOW_SECONDS = 10


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_order_detail(order) -> OrderDetailResponse:
    return OrderDetailResponse(
        id=order.id,
        order_number=order.order_number,
        session_id=order.session_id,
        restaurant_id=order.restaurant_id,
        order_source=order.order_source.value,
        table_number=order.table_number,
        room_id=order.room_id,
        room_number=order.room_number,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
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
                item_image_snapshot=oi.item_image_snapshot,
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
    item_previews = [
        OrderItemPreviewResponse(
            item_name_snapshot=oi.item_name_snapshot,
            item_image_snapshot=oi.item_image_snapshot,
            unit_price_snapshot=float(oi.unit_price_snapshot),
            quantity=oi.quantity,
            line_total=float(oi.line_total),
        )
        for oi in order.items
    ]

    return OrderHeaderResponse(
        id=order.id,
        order_number=order.order_number,
        session_id=order.session_id,
        restaurant_id=order.restaurant_id,
        order_source=order.order_source.value,
        table_number=order.table_number,
        room_id=order.room_id,
        room_number=order.room_number,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
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
        primary_item_name=item_previews[0].item_name_snapshot if item_previews else None,
        item_previews=item_previews,
    )


def _build_kitchen_order_card(order) -> KitchenOrderCard:
    """Build a kitchen-optimised order card with item summaries."""
    return KitchenOrderCard(
        id=order.id,
        order_number=order.order_number,
        order_source=order.order_source.value,
        table_number=order.table_number,
        room_number=order.room_number,
        room_id=order.room_id,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
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

def _stage_promo_usage_increment(
    db: Session,
    *,
    restaurant_id: int,
    code: str,
) -> None:
    """Increment promo usage as part of the order transaction."""
    promo = promo_repo.get_promo_code_by_code(db, code)
    if promo is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Promo code could not be applied.",
        )

    usage = promo_repo.get_promo_usage(
        db,
        restaurant_id=restaurant_id,
        promo_code_id=promo.id,
    )
    if usage is None:
        usage = PromoCodeUsage(
            restaurant_id=restaurant_id,
            promo_code_id=promo.id,
            used_count=0,
        )
        db.add(usage)
        db.flush()

    usage.used_count += 1
    usage.last_used_at = datetime.now(UTC)
    promo.used_count += 1


def _quantities_from_payload(payload: PlaceOrderRequest) -> dict[int, int]:
    quantities: dict[int, int] = {}
    for line in payload.items:
        quantities[line.item_id] = quantities.get(line.item_id, 0) + line.quantity
    return quantities


def _quantities_from_redis_cart(
    r: redis_lib.Redis,
    session: TableSession,
) -> dict[int, int]:
    raw_cart = cart_repo.get_cart_raw(r, session.session_id, session.restaurant_id)
    return {int(item_id): int(quantity) for item_id, quantity in raw_cart.items()}


def _build_line_items_from_quantities(
    db: Session,
    *,
    restaurant_id: int,
    quantities: dict[int, int],
) -> tuple[list[dict], float]:
    if not quantities:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cart is empty. Add items before placing an order.",
        )

    line_items: list[dict] = []
    subtotal = 0.0

    for item_id, quantity in quantities.items():
        item = get_item(db, item_id, restaurant_id)
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
                "item_image_snapshot": item.image_path,
                "unit_price_snapshot": unit_price,
                "quantity": quantity,
                "line_total": line_total,
            }
        )

    return line_items, subtotal


def _create_table_session_from_qr_key(
    db: Session,
    *,
    qr_access_key: str,
    customer_name: str | None,
) -> tuple[TableSession, str]:
    try:
        qr_payload = decode_table_qr_access_token(qr_access_key)
        restaurant_id = int(qr_payload.get("restaurant_id", -1))
        table_number = str(qr_payload.get("table_number", "")).strip()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired table QR credential. Please scan the table QR again.",
        )

    if not table_number:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid table QR credential. Please scan the table QR again.",
        )

    restaurant = get_restaurant(db, restaurant_id)
    if restaurant is None or not restaurant.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant is not currently available.",
        )

    table_session_repo.deactivate_active_sessions_for_table(
        db,
        restaurant_id=restaurant_id,
        table_number=table_number,
    )

    session_id = uuid.uuid4().hex
    expire_minutes = settings.guest_session_expire_minutes
    expires_at = datetime.now(UTC) + timedelta(minutes=expire_minutes)
    session = table_session_repo.create_session(
        db,
        session_id=session_id,
        restaurant_id=restaurant_id,
        table_number=table_number,
        customer_name=(customer_name or "Guest").strip() or "Guest",
        expires_at=expires_at,
    )
    guest_token = create_guest_session_token(
        session_id=session_id,
        restaurant_id=restaurant_id,
        table_number=table_number,
        expire_minutes=expire_minutes,
    )
    return session, guest_token


def _place_order_from_quantities(
    db: Session,
    r: redis_lib.Redis | None,
    session: TableSession,
    payload: PlaceOrderRequest,
    quantities: dict[int, int],
    *,
    clear_redis_cart: bool,
    guest_token: str | None = None,
) -> PlaceOrderResponse:
    line_items, subtotal = _build_line_items_from_quantities(
        db,
        restaurant_id=session.restaurant_id,
        quantities=quantities,
    )

    tax_amount = 0.0
    discount_amount = 0.0
    applied_promo_code: str | None = None
    promo_code = (payload.promo_code or "").strip()
    if promo_code:
        validation = validate_promo_for_restaurant(
            db,
            restaurant_id=session.restaurant_id,
            payload=PromoCodeValidateRequest(code=promo_code),
        )
        if not validation.valid or validation.discount_percent is None or not validation.code:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=validation.message,
            )
        applied_promo_code = validation.code
        discount_amount = round(subtotal * float(validation.discount_percent) / 100, 2)

    total_amount = subtotal + tax_amount - discount_amount

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

        if applied_promo_code:
            _stage_promo_usage_increment(
                db,
                restaurant_id=session.restaurant_id,
                code=applied_promo_code,
            )

        db.commit()
    except Exception:
        db.rollback()
        raise

    if clear_redis_cart and r is not None:
        cart_repo.clear_cart(r, session.session_id, session.restaurant_id)

    db.refresh(order)
    placed = order_repo.get_order_by_id_and_session(
        db, order.id, session.session_id, session.restaurant_id
    )

    try:
        if r is not None:
            realtime_service.publish_new_order(
                r,
                restaurant_id=session.restaurant_id,
                order_id=placed.id,
                order_number=placed.order_number,
                table_number=placed.table_number,
                order_source=placed.order_source.value,
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
        pass

    return PlaceOrderResponse(order=_build_order_detail(placed), guest_token=guest_token)


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
    quantities = (
        _quantities_from_payload(payload)
        if payload.items
        else _quantities_from_redis_cart(r, session)
    )
    return _place_order_from_quantities(
        db,
        r,
        session,
        payload,
        quantities,
        clear_redis_cart=not payload.items,
    )


def place_order_from_qr_key(
    db: Session,
    r: redis_lib.Redis | None,
    qr_access_key: str,
    payload: PlaceOrderRequest,
) -> PlaceOrderResponse:
    """Place a table order directly from a QR key and client-side cart payload."""
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cart is empty. Add items before placing an order.",
        )
    session, guest_token = _create_table_session_from_qr_key(
        db,
        qr_access_key=qr_access_key,
        customer_name=payload.customer_name,
    )
    return _place_order_from_quantities(
        db,
        r,
        session,
        payload,
        _quantities_from_payload(payload),
        clear_redis_cart=False,
        guest_token=guest_token,
    )


# ── Guest order retrieval ─────────────────────────────────────────────────────

def list_orders_for_guest(
    db: Session,
    session: TableSession,
) -> ActiveOrderListResponse:
    """Return all orders for the guest's current session.

    Includes all statuses (pending, confirmed, processing, completed, paid, rejected)
    so the guest can see their complete order history within the current QR session.
    """
    orders = order_repo.list_orders_by_session(
        db,
        session.session_id,
        session.restaurant_id,
    )
    return ActiveOrderListResponse(
        orders=[_build_order_header(o) for o in orders],
        total=len(orders),
    )


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


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def cancel_order_for_guest(
    db: Session,
    order_id: int,
    session: TableSession,
    r: redis_lib.Redis | None = None,
) -> OrderStatusResponse:
    """Allow guests to cancel their own pending order within 5 seconds.

    Guardrails:
    - Order must belong to the same guest session and restaurant.
    - Only pending orders can be cancelled by guests.
    - Cancellation window is strictly limited to GUEST_CANCEL_WINDOW_SECONDS.
    """
    order = order_repo.get_order_by_id_and_session(
        db, order_id, session.session_id, session.restaurant_id
    )
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    if order.status != OrderStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only pending orders can be cancelled by customer.",
        )

    elapsed_seconds = (datetime.now(UTC) - _as_utc(order.placed_at)).total_seconds()
    if elapsed_seconds > GUEST_CANCEL_WINDOW_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cancellation window expired. Orders can be cancelled within 10 seconds only.",
        )

    updated = order_repo.update_order_status(db, order, OrderStatus.rejected)
    db.commit()
    db.refresh(updated)

    if r is not None:
        try:
            realtime_service.publish_order_status_updated(
                r,
                restaurant_id=session.restaurant_id,
                order_id=updated.id,
                order_number=updated.order_number,
                table_number=updated.table_number,
                order_source=updated.order_source.value,
                room_id=updated.room_id,
                room_number=updated.room_number,
                status=updated.status.value,
                updated_at=datetime.now(UTC),
            )
        except Exception:
            pass

    return OrderStatusResponse(
        id=updated.id,
        order_number=updated.order_number,
        status=updated.status,
        updated_at=updated.updated_at,
    )


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
    db: Session, 
    restaurant_id: int,
    status: OrderStatus | None = None,
) -> ActiveOrderListResponse:
    orders = order_repo.list_history_orders_by_restaurant(db, restaurant_id, status=status)
    return ActiveOrderListResponse(
        orders=[_build_order_header(o) for o in orders],
        total=len(orders),
    )


def get_history_stats(
    db: Session,
    restaurant_id: int,
) -> dict[str, int]:
    return order_repo.count_history_orders_by_restaurant(db, restaurant_id)


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
                order_source=updated.order_source.value,
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


def get_badge_counts(db: Session, restaurant_id: int) -> dict[str, int]:
    """Return counts for sidebar notification badges."""
    awaiting_count = order_repo.count_active_steward_stats(db, restaurant_id)
    requests_count = ts_repo.count_active_requests_stats(db, restaurant_id)
    
    return {
        "awaiting": awaiting_count,
        "requests": requests_count,
    }
