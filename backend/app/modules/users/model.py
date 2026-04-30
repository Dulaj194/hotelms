from __future__ import annotations

import enum
import json
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.modules.restaurants.model import Restaurant


class UserRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    steward = "steward"
    housekeeper = "housekeeper"
    cashier = "cashier"
    accountant = "accountant"
    super_admin = "super_admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # String(191): utf8mb4 uses 4 bytes/char; 191 × 4 = 764 bytes — safe under all MySQL/MariaDB index limits.
    email: Mapped[str] = mapped_column(
        String(191), unique=True, nullable=False, index=True
    )
    username: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True, index=True
    )
    phone: Mapped[str | None] = mapped_column(
        String(32), unique=True, nullable=True, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    assigned_area: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    platform_scopes_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    # MULTI-TENANT: restaurant_id links this user to a tenant restaurant.
    # super_admin may have restaurant_id = None (platform-level account).
    # All other roles should always have a restaurant_id set.
    restaurant_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("restaurants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # "Restaurant" uses a string forward reference — SQLAlchemy resolves it
    # at mapper configuration time, avoiding circular imports at runtime.
    restaurant: Mapped[Optional[Restaurant]] = relationship(
        "Restaurant",
        back_populates="users",
        foreign_keys=[restaurant_id],
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
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    @property
    def super_admin_scopes(self) -> list[str]:
        from app.modules.platform_access import catalog as platform_access_catalog

        if self.role != UserRole.super_admin:
            return []
        return platform_access_catalog.parse_platform_scopes_json(self.platform_scopes_json)

    def set_super_admin_scopes(self, scopes: list[str] | None) -> None:
        from app.modules.platform_access import catalog as platform_access_catalog

        if self.role != UserRole.super_admin:
            self.platform_scopes_json = json.dumps([])
            return
        self.platform_scopes_json = platform_access_catalog.serialize_platform_scopes(scopes)
