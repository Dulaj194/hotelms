from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.modules.restaurants.model import Restaurant
    from app.modules.rooms.model import Room


class RoomSession(Base):
    """A guest room session created when a hotel guest scans a room QR code.

    SECURITY:
    - The raw signed room session token is NEVER stored here.
    - Only the session_id is persisted; the token is signed with the app
      secret key and validated at request time (type="room_session").
    - room_number_snapshot records the room number at session creation time
      so historical context is preserved even if the room is later renamed.
    """

    __tablename__ = "room_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Unique opaque identifier embedded in the signed token.
    session_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        default=lambda: uuid.uuid4().hex,
        index=True,
    )

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

    # Snapshot of room_number at the time the session was created
    room_number_snapshot: Mapped[str] = mapped_column(String(50), nullable=False)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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
    room: Mapped[Room] = relationship("Room")
