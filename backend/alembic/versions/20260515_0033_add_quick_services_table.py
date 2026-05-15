"""Add quick services table.

Revision ID: 20260515_0033
Revises: 20260513_0032
Create Date: 2026-05-15 14:30:00

Business Rationale:
- Enables restaurant admins to define custom service buttons (e.g., "Request Water", "Call Steward").
- Provides dynamic configuration for guest-facing quick services on public menus.

Schema Changes:
- Creates `site_quick_services` table with support for label, message, icon, and sorting.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260515_0033"
down_revision = "20260513_0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_quick_services",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("restaurant_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=50), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("icon_name", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_site_quick_services_id"), "site_quick_services", ["id"], unique=False)
    op.create_index(op.f("ix_site_quick_services_restaurant_id"), "site_quick_services", ["restaurant_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_site_quick_services_restaurant_id"), table_name="site_quick_services")
    op.drop_index(op.f("ix_site_quick_services_id"), table_name="site_quick_services")
    op.drop_table("site_quick_services")
