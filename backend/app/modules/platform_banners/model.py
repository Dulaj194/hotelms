from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BannerCategory(str, enum.Enum):
    promotional = "promotional"  # Cross-selling, referral drives
    system_alert = "system_alert"  # Maintenance, platform notifications


class BannerType(str, enum.Enum):
    info = "info"
    success = "success"
    warning = "warning"
    danger = "danger"


class PlatformBanner(Base):
    __tablename__ = "platform_banners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Dual-tab categories
    category: Mapped[BannerCategory] = mapped_column(
        Enum(BannerCategory, native_enum=False),
        default=BannerCategory.promotional,
        nullable=False
    )
    
    # Visual type for alert styling
    type: Mapped[BannerType] = mapped_column(
        Enum(BannerType, native_enum=False), 
        default=BannerType.info, 
        nullable=False
    )
    
    # Optional promo media assets and redirect buttons
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cta_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cta_label: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Active schedules
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Guest/Staff dismissible behaviour
    dismissible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Audit fields
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        nullable=False, 
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        nullable=False, 
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
