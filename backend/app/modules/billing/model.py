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
    partially_paid = "partially_paid"
    paid = "paid"
    refunded = "refunded"
    voided = "voided"
    reversed = "reversed"


class BillContextType(str, enum.Enum):
    table = "table"
    room = "room"


class BillHandoffStatus(str, enum.Enum):
    none = "none"
    sent_to_cashier = "sent_to_cashier"
    sent_to_accountant = "sent_to_accountant"
    completed = "completed"


class BillReviewStatus(str, enum.Enum):
    not_sent = "not_sent"
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class BillPaymentAllocationStatus(str, enum.Enum):
    captured = "captured"
    refunded = "refunded"
    voided = "voided"
    reversed = "reversed"


class BillSettleIdempotencyStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


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
    reversed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reversal_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

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
    cashier_status: Mapped[BillReviewStatus] = mapped_column(
        Enum(BillReviewStatus, native_enum=False),
        nullable=False,
        default=BillReviewStatus.not_sent,
        server_default=BillReviewStatus.not_sent.value,
        index=True,
    )
    accountant_status: Mapped[BillReviewStatus] = mapped_column(
        Enum(BillReviewStatus, native_enum=False),
        nullable=False,
        default=BillReviewStatus.not_sent,
        server_default=BillReviewStatus.not_sent.value,
        index=True,
    )
    printed_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    last_printed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reopened_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

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


class BillWorkflowEvent(Base):
    __tablename__ = "bill_workflow_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bill_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("bills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    action_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )


class BillPaymentAllocation(Base):
    __tablename__ = "bill_payment_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bill_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("bills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    transaction_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    gateway_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gateway_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    allocation_status: Mapped[BillPaymentAllocationStatus] = mapped_column(
        Enum(BillPaymentAllocationStatus, native_enum=False),
        nullable=False,
        default=BillPaymentAllocationStatus.captured,
        server_default=BillPaymentAllocationStatus.captured.value,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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


class BillSettleIdempotencyKey(Base):
    __tablename__ = "bill_settle_idempotency_keys"
    __table_args__ = (
        UniqueConstraint(
            "restaurant_id",
            "operation",
            "idempotency_key",
            name="uq_bill_settle_idempotency",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    operation: Mapped[str] = mapped_column(String(32), nullable=False, default="settle")
    idempotency_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    context_type: Mapped[BillContextType] = mapped_column(
        Enum(BillContextType, native_enum=False),
        nullable=False,
    )
    context_lookup: Mapped[str] = mapped_column(String(64), nullable=False)
    request_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    settle_status: Mapped[BillSettleIdempotencyStatus] = mapped_column(
        Enum(BillSettleIdempotencyStatus, native_enum=False),
        nullable=False,
        default=BillSettleIdempotencyStatus.pending,
        server_default=BillSettleIdempotencyStatus.pending.value,
        index=True,
    )
    bill_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("bills.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
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
