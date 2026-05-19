"""Create platform_banners table.

Revision ID: 20260519_0037
Revises: 20260518_0036
Create Date: 2026-05-19 10:55:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260519_0037"
down_revision = "20260518_0036"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    if not _table_exists(bind, "platform_banners"):
        op.create_table(
            "platform_banners",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("category", sa.String(length=50), server_default="promotional", nullable=False),
            sa.Column("type", sa.String(length=50), server_default="info", nullable=False),
            sa.Column("image_url", sa.String(length=500), nullable=True),
            sa.Column("cta_link", sa.String(length=500), nullable=True),
            sa.Column("cta_label", sa.String(length=64), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
            sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("dismissible", sa.Boolean(), server_default=sa.text("1"), nullable=False),
            sa.Column("created_by_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="CASCADE"),
        )
        op.create_index(op.f("ix_platform_banners_id"), "platform_banners", ["id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, "platform_banners"):
        op.drop_index(op.f("ix_platform_banners_id"), table_name="platform_banners")
        op.drop_table("platform_banners")
