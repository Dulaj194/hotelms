from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.modules.restaurants.model import Restaurant


class TableSessionStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    BILL_REQUESTED = "BILL_REQUESTED"
    BILL_ACKNOWLEDGED = "BILL_ACKNOWLEDGED"


class TableSession(Base):
    """A guest table session created when a customer scans a QR code.

    SECURITY: The raw signed guest token is never stored here.
    Only the session_id is persisted; the token itself is signed with the
    app secret key and validated at request time.
    """

    __tablename__ = "table_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Unique opaque identifier for this session — embedded in the signed token.
    session_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, default=lambda: uuid.uuid4().hex, index=True
    )

    restaurant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    table_number: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    session_status: Mapped[TableSessionStatus] = mapped_column(
        Enum(TableSessionStatus, native_enum=False),
        nullable=False,
        default=TableSessionStatus.OPEN,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    restaurant: Mapped[Restaurant] = relationship("Restaurant")


class TableServiceRequest(Base):
    """Stores a specific service request from a guest at a table.
    
    Requests are persisted so that staff can see them even after a page refresh
    or if they were offline when the request was first made.
    
    Lifecycle:
    - Created when guest taps Quick Services button
    - Real-time event broadcast to steward dashboard
    - Staff can acknowledge it (acknowledged_by + acknowledged_at)
    - Staff can mark as completed (is_completed + completed_at)
    """
    __tablename__ = "table_service_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    restaurant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # Linked to a session but we duplicate table/customer for fast lookup without joins
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    table_number: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    
    service_type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # Acknowledgement tracking (staff member who acknowledged)
    acknowledged_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Completion tracking
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
