from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class SubscriptionStatus(str, enum.Enum):
    trial = "trial"
    active = "active"
    expired = "expired"
    cancelled = "cancelled"


class SubscriptionChangeAction(str, enum.Enum):
    trial_assigned = "trial_assigned"
    activated = "activated"
    updated = "updated"
    cancelled = "cancelled"
    expired = "expired"


class RestaurantSubscription(Base):
    __tablename__ = "restaurant_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    package_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("packages.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.trial
    )

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    trial_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trial_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_trial: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    package = relationship("Package", back_populates="subscriptions")
    restaurant = relationship("Restaurant")


class SubscriptionChangeLog(Base):
    __tablename__ = "subscription_change_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subscription_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("restaurant_subscriptions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[SubscriptionChangeAction] = mapped_column(
        Enum(SubscriptionChangeAction),
        nullable=False,
        index=True,
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="system")
    change_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_package_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("packages.id", ondelete="SET NULL"),
        nullable=True,
    )
    previous_package_name_snapshot: Mapped[str | None] = mapped_column(String(100), nullable=True)
    previous_package_code_snapshot: Mapped[str | None] = mapped_column(String(50), nullable=True)
    next_package_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("packages.id", ondelete="SET NULL"),
        nullable=True,
    )
    next_package_name_snapshot: Mapped[str | None] = mapped_column(String(100), nullable=True)
    next_package_code_snapshot: Mapped[str | None] = mapped_column(String(50), nullable=True)
    previous_status: Mapped[SubscriptionStatus | None] = mapped_column(
        Enum(SubscriptionStatus),
        nullable=True,
    )
    next_status: Mapped[SubscriptionStatus | None] = mapped_column(
        Enum(SubscriptionStatus),
        nullable=True,
    )
    previous_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    subscription = relationship("RestaurantSubscription", foreign_keys=[subscription_id])
    restaurant = relationship("Restaurant", foreign_keys=[restaurant_id])
