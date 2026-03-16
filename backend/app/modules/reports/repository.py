from __future__ import annotations

from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.categories.model import Category
from app.modules.items.model import Item
from app.modules.orders.model import OrderHeader, OrderItem
from app.modules.payments.model import Payment, PaymentStatus


def list_sales_rows(
    db: Session,
    restaurant_id: int,
    *,
    selected_date: date | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
):
    query = (
        db.query(
            OrderHeader.id.label("order_id"),
            OrderHeader.order_number.label("order_number"),
            Payment.paid_at.label("sales_at"),
            Category.name.label("category_name"),
            OrderItem.item_name_snapshot.label("item_name"),
            OrderItem.quantity.label("quantity"),
            OrderItem.unit_price_snapshot.label("unit_price"),
            OrderItem.line_total.label("total_price"),
            Payment.payment_method.label("payment_method"),
            OrderHeader.customer_name.label("customer_name"),
            OrderHeader.order_source.label("order_source"),
            OrderHeader.table_number.label("table_number"),
            OrderHeader.room_number.label("room_number"),
        )
        .join(OrderHeader, Payment.order_id == OrderHeader.id)
        .join(OrderItem, OrderItem.order_id == OrderHeader.id)
        .outerjoin(
            Item,
            (Item.id == OrderItem.item_id) & (Item.restaurant_id == restaurant_id),
        )
        .outerjoin(
            Category,
            (Category.id == Item.category_id) & (Category.restaurant_id == restaurant_id),
        )
        .filter(
            Payment.restaurant_id == restaurant_id,
            Payment.payment_status == PaymentStatus.paid,
            Payment.paid_at.isnot(None),
        )
    )

    if selected_date is not None:
        query = query.filter(func.date(Payment.paid_at) == selected_date)
    elif from_date is not None and to_date is not None:
        query = query.filter(func.date(Payment.paid_at).between(from_date, to_date))

    return query.order_by(Payment.paid_at.desc(), OrderHeader.id.desc()).all()


def list_available_sales_dates(db: Session, restaurant_id: int) -> list[date]:
    rows = (
        db.query(func.date(Payment.paid_at).label("sales_date"))
        .filter(
            Payment.restaurant_id == restaurant_id,
            Payment.payment_status == PaymentStatus.paid,
            Payment.paid_at.isnot(None),
        )
        .distinct()
        .order_by(func.date(Payment.paid_at).desc())
        .limit(100)
        .all()
    )
    return [row.sales_date for row in rows if row.sales_date is not None]
