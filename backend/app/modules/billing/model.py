"""SQLAlchemy model for the bills table.

A bill is a settlement snapshot for a table session.
One bill per session is the intended invariant (enforced by UniqueConstraint).

The bill captures:
- which session was settled
- the server-computed totals at settlement time
- which payment method was used
- when it was settled

It does NOT replace order/payment records — it is an additional snapshot
that marks the session as financially closed.
"""
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
    pending = "pending"   # computed but not yet settled
    paid = "paid"         # fully settled


def _gen_bill_number() -> str:
    """Generate a short readable bill number (e.g. BILL-A3F2C1D8)."""
    return "BILL-" + uuid.uuid4().hex[:8].upper()


class Bill(Base):
    __tablename__ = "bills"

    # One bill per table session per restaurant
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

    # Identifies which guest table session this bill covers.
    # String(64) — matches TableSession.session_id length.
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    table_number: Mapped[str] = mapped_column(String(50), nullable=False)

    # Server-computed financial snapshot at settlement time.
    # Tax and discount are explicitly 0 in this phase (no tax engine yet).
    subtotal_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Payment details recorded at settlement
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_status: Mapped[BillStatus] = mapped_column(
        Enum(BillStatus), nullable=False, default=BillStatus.pending, index=True
    )

    transaction_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
