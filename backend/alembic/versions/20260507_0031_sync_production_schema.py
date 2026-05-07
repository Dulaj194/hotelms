"""Synchronize production schema with models by adding missing columns.

Revision ID: 20260507_0031
Revises: 20260506_0030
Create Date: 2026-05-07 10:00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260507_0031"
down_revision = "20260506_0030"
branch_labels = None
depends_on = None


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Sync order_headers columns
    if not _column_exists(bind, "order_headers", "order_source"):
        # Staged approach for NOT NULL column to avoid MySQL 1138 error
        op.add_column(
            "order_headers",
            sa.Column("order_source", sa.String(length=20), nullable=True),
        )
        # Backfill existing data
        op.execute("UPDATE order_headers SET order_source = 'table' WHERE order_source IS NULL")
        # Now enforce NOT NULL
        op.alter_column(
            "order_headers", 
            "order_source", 
            nullable=False, 
            server_default="table"
        )

    # Room and Customer context columns (Nullable, so low risk)
    if not _column_exists(bind, "order_headers", "room_id"):
        op.add_column("order_headers", sa.Column("room_id", sa.Integer(), nullable=True))

    if not _column_exists(bind, "order_headers", "room_number"):
        op.add_column("order_headers", sa.Column("room_number", sa.String(length=50), nullable=True))

    if not _column_exists(bind, "order_headers", "customer_name"):
        op.add_column("order_headers", sa.Column("customer_name", sa.String(length=255), nullable=True))

    if not _column_exists(bind, "order_headers", "customer_phone"):
        op.add_column("order_headers", sa.Column("customer_phone", sa.String(length=50), nullable=True))

    if not _column_exists(bind, "order_headers", "served_at"):
        op.add_column("order_headers", sa.Column("served_at", sa.DateTime(timezone=True), nullable=True))

    # 2. Sync items columns
    for i in range(2, 6):
        col_name = f"image_path_{i}"
        if not _column_exists(bind, "items", col_name):
            op.add_column("items", sa.Column(col_name, sa.String(length=500), nullable=True))


def downgrade() -> None:
    pass
