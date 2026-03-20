from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class DashboardAlertImpression(Base):
    __tablename__ = "dashboard_alert_impressions"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "alert_key", "shown_date", name="uq_alert_restaurant_day"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    alert_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    alert_level: Mapped[str] = mapped_column(String(20), nullable=False)
    shown_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    last_shown_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    dismissed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DashboardSetupProgress(Base):
    __tablename__ = "dashboard_setup_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    current_step: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    completed_keys_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
