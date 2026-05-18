"""Add item_name_snapshot_localized to order_items.

Revision ID: 20260518_0036
Revises: 20260517_0035
Create Date: 2026-05-18 15:40:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260518_0036"
down_revision = "20260517_0035"
branch_labels = None
depends_on = None


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    if not _column_exists(bind, "order_items", "item_name_snapshot_localized"):
        op.add_column("order_items", sa.Column("item_name_snapshot_localized", sa.String(length=255), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if _column_exists(bind, "order_items", "item_name_snapshot_localized"):
        op.drop_column("order_items", "item_name_snapshot_localized")
