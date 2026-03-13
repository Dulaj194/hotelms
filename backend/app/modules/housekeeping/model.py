"""SQLAlchemy model for housekeeping_requests."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class RequestStatus(str, enum.Enum):
    pending = "pending"
    done = "done"


class RequestType(str, enum.Enum):
    cleaning = "cleaning"
    towels = "towels"
    water = "water"
    maintenance = "maintenance"
    other = "other"


class HousekeepingRequest(Base):
    """A service/housekeeping request submitted by a room guest.

    Tenant-scoped: every request belongs to one restaurant.
    Room context: room_id FK + room_number_snapshot.
    Session context: room_session_id (string) for traceability.

    History is tracked in this same table using status + done_at.
    """

    __tablename__ = "housekeeping_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    room_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # session_id string kept for traceability — not a FK to allow session cleanup
    room_session_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )

    # Snapshot at submission time so history works even if room is renamed
    room_number_snapshot: Mapped[str] = mapped_column(String(50), nullable=False)

    guest_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    request_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", server_default="pending", index=True
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    done_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
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
