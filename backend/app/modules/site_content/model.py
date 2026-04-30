from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class ContactLeadStatus(str, enum.Enum):
    new = "new"
    reviewed = "reviewed"
    qualified = "qualified"
    closed = "closed"


class SitePage(Base):
    __tablename__ = "site_pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    published_payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    updated_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    published_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SiteBlogPost(Base):
    __tablename__ = "site_blog_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tags_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    body_json: Mapped[str] = mapped_column(Text, nullable=False)
    reading_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    published_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    published_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_category: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    published_cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_tags_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_body_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_reading_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    published_is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    published_content_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    last_published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    updated_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    published_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ContactLead(Base):
    __tablename__ = "contact_leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(191), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    property_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(150), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    source_page: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entry_point: Mapped[str | None] = mapped_column(String(120), nullable=True)
    login_intent: Mapped[str | None] = mapped_column(String(80), nullable=True)
    referrer_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    utm_source: Mapped[str | None] = mapped_column(String(120), nullable=True)
    utm_medium: Mapped[str | None] = mapped_column(String(120), nullable=True)
    utm_campaign: Mapped[str | None] = mapped_column(String(150), nullable=True)
    utm_term: Mapped[str | None] = mapped_column(String(150), nullable=True)
    utm_content: Mapped[str | None] = mapped_column(String(150), nullable=True)
    status: Mapped[ContactLeadStatus] = mapped_column(
        Enum(ContactLeadStatus, native_enum=False),
        nullable=False,
        default=ContactLeadStatus.new,
        index=True,
    )
    assigned_to_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
