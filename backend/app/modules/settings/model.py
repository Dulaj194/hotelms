from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.modules.restaurants.model import Restaurant
    from app.modules.users.model import User


class SettingsRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class SettingsRequest(Base):
    __tablename__ = "settings_requests"

    request_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    restaurant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    requested_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, comment="Admin user ID who created the request"
    )
    requested_changes: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, comment="JSON object with requested settings changes"
    )
    current_settings: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, comment="JSON object with current settings before changes"
    )
    status: Mapped[SettingsRequestStatus] = mapped_column(
        Enum(SettingsRequestStatus), nullable=False, default=SettingsRequestStatus.PENDING
    )
    request_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Reason provided by admin for the change request"
    )
    reviewed_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="Super Admin user ID who reviewed the request"
    )
    review_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Notes provided by Super Admin during review"
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="Timestamp when the request was reviewed"
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

    # Relationships
    restaurant: Mapped[Restaurant] = relationship("Restaurant", backref="settings_requests")
    requester: Mapped[User] = relationship("User", foreign_keys=[requested_by], backref="created_settings_requests")
    reviewer: Mapped[User | None] = relationship("User", foreign_keys=[reviewed_by], backref="reviewed_settings_requests")