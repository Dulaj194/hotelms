"""SQLAlchemy models for order_headers and order_items."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.modules.payments.model import Payment
    from app.modules.restaurants.model import Restaurant


class OrderStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    processing = "processing"
    completed = "completed"
    paid = "paid"
    rejected = "rejected"


class OrderSource(str, enum.Enum):
    table = "table"
    room = "room"


# Explicit allowed status transitions - all others are forbidden.
ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.pending: {OrderStatus.confirmed, OrderStatus.rejected},
    OrderStatus.confirmed: {OrderStatus.processing, OrderStatus.rejected},
    OrderStatus.processing: {OrderStatus.completed, OrderStatus.rejected},
    OrderStatus.completed: {OrderStatus.paid},
    OrderStatus.paid: set(),
    OrderStatus.rejected: set(),
}


def _gen_order_number() -> str:
    """Generate a short, human-readable order number (e.g. ORD-A3F2C1)."""
    return "ORD-" + uuid.uuid4().hex[:6].upper()


class OrderHeader(Base):
    __tablename__ = "order_headers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    order_number: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        nullable=False,
        default=_gen_order_number,
        index=True,
    )

    # Origin context (snapshotted from guest session at placement time)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Order source: table (default) or room
    order_source: Mapped[OrderSource] = mapped_column(
        Enum(OrderSource),
        nullable=False,
        default=OrderSource.table,
        server_default=OrderSource.table.value,
    )

    # Table context (null for room orders)
    table_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Room context (null for table orders)
    room_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("rooms.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    room_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Optional customer info
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), nullable=False, default=OrderStatus.pending, index=True
    )

    # Financial snapshot - server-calculated, never client-supplied
    subtotal_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Lifecycle timestamps
    placed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    restaurant: Mapped[Restaurant] = relationship("Restaurant")
    items: Mapped[list[OrderItem]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )
    payments: Mapped[list[Payment]] = relationship(
        "Payment", back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    order_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("order_headers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Snapshots at the time of placement - DB authoritative
    item_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    item_image_snapshot: Mapped[str | None] = mapped_column(String(500), nullable=True)
    unit_price_snapshot: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationship
    order: Mapped[OrderHeader] = relationship("OrderHeader", back_populates="items")
