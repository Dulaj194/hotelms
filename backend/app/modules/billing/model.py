"""SQLAlchemy model for operational bills / folios."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class BillStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"


class BillContextType(str, enum.Enum):
    table = "table"
    room = "room"


class BillHandoffStatus(str, enum.Enum):
    none = "none"
    sent_to_cashier = "sent_to_cashier"
    sent_to_accountant = "sent_to_accountant"
    completed = "completed"


def _gen_bill_number() -> str:
    return "BILL-" + uuid.uuid4().hex[:8].upper()


class Bill(Base):
    __tablename__ = "bills"
    __table_args__ = (
        UniqueConstraint("session_id", "restaurant_id", name="uq_bills_session_restaurant"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    bill_number: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        nullable=False,
        default=_gen_bill_number,
        index=True,
    )

    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    context_type: Mapped[BillContextType] = mapped_column(
        Enum(BillContextType),
        nullable=False,
        default=BillContextType.table,
        server_default=BillContextType.table.value,
        index=True,
    )

    table_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    room_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("rooms.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    room_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    subtotal_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_status: Mapped[BillStatus] = mapped_column(
        Enum(BillStatus),
        nullable=False,
        default=BillStatus.pending,
        index=True,
    )

    transaction_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    handoff_status: Mapped[BillHandoffStatus] = mapped_column(
        Enum(BillHandoffStatus),
        nullable=False,
        default=BillHandoffStatus.none,
        server_default=BillHandoffStatus.none.value,
        index=True,
    )
    sent_to_cashier_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_to_accountant_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    handoff_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
