from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.modules.categories.model import Category
    from app.modules.restaurants.model import Restaurant
    from app.modules.subcategories.model import Subcategory


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    more_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False, default="LKR")
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_path_2: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_path_3: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_path_4: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_path_5: Mapped[str | None] = mapped_column(String(500), nullable=True)
    video_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    blog_link: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Tenant scope — item belongs to both a category and a restaurant.
    # Both FKs must come from authenticated context, never from client payload.
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Optional subcategory — nullable so existing items without a subcategory still work.
    subcategory_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("subcategories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    restaurant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
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
    category: Mapped[Category] = relationship("Category", back_populates="items")
    subcategory: Mapped[Subcategory | None] = relationship("Subcategory", back_populates="items")
    restaurant: Mapped[Restaurant] = relationship("Restaurant", back_populates="items")
