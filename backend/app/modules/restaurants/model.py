from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
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
    tax_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    opening_time: Mapped[str | None] = mapped_column(String(8), nullable=True)
    closing_time: Mapped[str | None] = mapped_column(String(8), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
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

    # One restaurant has many users.
    users: Mapped[list[User]] = relationship("User", back_populates="restaurant")

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
