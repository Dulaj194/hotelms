from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.modules.items.model import Item
    from app.modules.menus.model import Menu
    from app.modules.restaurants.model import Restaurant


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (Index("ix_categories_restaurant_menu_sort", "restaurant_id", "menu_id", "sort_order"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Every category belongs to exactly one menu.
    menu_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("menus.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Tenant scope: every category belongs to exactly one restaurant.
    # restaurant_id must come from authenticated context, never from client payload.
    restaurant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    menu: Mapped[Menu] = relationship("Menu", back_populates="categories")
    restaurant: Mapped[Restaurant] = relationship("Restaurant", back_populates="categories")
    items: Mapped[list[Item]] = relationship("Item", back_populates="category", cascade="all, delete-orphan")
