from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.modules.categories.model import Category
    from app.modules.items.model import Item
    from app.modules.menus.model import Menu
    from app.modules.reference_data.model import Country, CurrencyType
    from app.modules.subcategories.model import Subcategory
    from app.modules.users.model import User


class RegistrationStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class WebhookHealthStatus(str, enum.Enum):
    not_configured = "not_configured"
    healthy = "healthy"
    degraded = "degraded"
    disabled = "disabled"


class WebhookDeliveryStatus(str, enum.Enum):
    success = "success"
    failed = "failed"


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # String(191): utf8mb4 uses 4 bytes/char; 191 × 4 = 764 bytes — safe under all MySQL/MariaDB index limits.
    email: Mapped[str | None] = mapped_column(String(191), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    country_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("countries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    currency_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("currency_types.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    country: Mapped[str | None] = mapped_column(String(120), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(12), nullable=True)
    billing_email: Mapped[str | None] = mapped_column(String(191), nullable=True)
    opening_time: Mapped[str | None] = mapped_column(String(8), nullable=True)
    closing_time: Mapped[str | None] = mapped_column(String(8), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    enable_steward: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_housekeeping: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_kds: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_reports: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_accountant: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_cashier: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    integration_api_key_hash: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        index=True,
    )
    integration_api_key_prefix: Mapped[str | None] = mapped_column(String(16), nullable=True)
    integration_api_key_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    integration_api_key_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    integration_api_key_rotated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    integration_public_ordering_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    integration_webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    integration_webhook_secret_header_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    integration_webhook_secret_ciphertext: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    integration_webhook_secret_last4: Mapped[str | None] = mapped_column(
        String(4),
        nullable=True,
    )
    integration_webhook_secret_rotated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    integration_webhook_status: Mapped[WebhookHealthStatus] = mapped_column(
        Enum(WebhookHealthStatus, native_enum=False),
        default=WebhookHealthStatus.not_configured,
        nullable=False,
    )
    integration_webhook_last_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    integration_webhook_last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    registration_status: Mapped[RegistrationStatus] = mapped_column(
        Enum(RegistrationStatus),
        default=RegistrationStatus.APPROVED,
        nullable=False,
    )
    registration_reviewed_by_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    registration_review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    registration_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
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

    # One restaurant has many users.
    users: Mapped[list[User]] = relationship(
        "User",
        back_populates="restaurant",
        foreign_keys="User.restaurant_id",
    )
    webhook_deliveries: Mapped[list["RestaurantWebhookDelivery"]] = relationship(
        "RestaurantWebhookDelivery",
        back_populates="restaurant",
        cascade="all, delete-orphan",
    )
    registration_reviewer: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[registration_reviewed_by_id],
    )

    # One restaurant has menus, categories, subcategories, and items.
    menus: Mapped[list[Menu]] = relationship("Menu", back_populates="restaurant")
    categories: Mapped[list[Category]] = relationship("Category", back_populates="restaurant")
    subcategories: Mapped[list[Subcategory]] = relationship("Subcategory", back_populates="restaurant")
    items: Mapped[list[Item]] = relationship("Item", back_populates="restaurant")

    country_ref: Mapped[Country | None] = relationship(
        "Country",
        back_populates="restaurants",
        foreign_keys=[country_id],
    )
    currency_ref: Mapped[CurrencyType | None] = relationship(
        "CurrencyType",
        back_populates="restaurants",
        foreign_keys=[currency_id],
    )

    @property
    def feature_flags(self) -> dict[str, bool]:
        from app.modules.access import catalog as access_catalog

        return access_catalog.build_feature_flag_snapshot(self)


class RestaurantWebhookDelivery(Base):
    __tablename__ = "restaurant_webhook_deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    restaurant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    triggered_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    retried_from_delivery_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("restaurant_webhook_deliveries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    request_url: Mapped[str] = mapped_column(String(500), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_status: Mapped[WebhookDeliveryStatus] = mapped_column(
        Enum(WebhookDeliveryStatus, native_enum=False),
        nullable=False,
        default=WebhookDeliveryStatus.success,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_retry: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    http_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    restaurant: Mapped[Restaurant] = relationship(
        "Restaurant",
        back_populates="webhook_deliveries",
    )
    triggered_by: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[triggered_by_user_id],
    )
    retried_from: Mapped["RestaurantWebhookDelivery | None"] = relationship(
        "RestaurantWebhookDelivery",
        remote_side=[id],
        foreign_keys=[retried_from_delivery_id],
    )
