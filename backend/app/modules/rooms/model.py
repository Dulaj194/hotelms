from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class RoomHousekeepingStatus(str, enum.Enum):
    vacant_dirty = "vacant_dirty"
    assigned = "assigned"
    in_progress = "in_progress"
    inspection = "inspection"
    ready = "ready"


class Room(Base):
    """Hotel room record.

    Each room belongs to one restaurant (hotel tenant).
    room_number is unique within a restaurant — the UniqueConstraint enforces this.

    SECURITY: room_number alone is never trusted for guest authorization.
    Guests must obtain a signed room session token after the backend
    validates the (restaurant_id, room_number) relationship.
    """

    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    room_number: Mapped[str] = mapped_column(String(50), nullable=False)
    room_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    floor_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Stored QR path when the QR has been generated for this room
    qr_code_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    housekeeping_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=RoomHousekeepingStatus.vacant_dirty.value,
        server_default=RoomHousekeepingStatus.vacant_dirty.value,
        index=True,
    )
    maintenance_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
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

    __table_args__ = (
        UniqueConstraint("restaurant_id", "room_number", name="uq_room_restaurant_number"),
    )
