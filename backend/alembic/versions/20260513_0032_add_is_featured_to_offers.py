"""Add is_featured column to offers table.

Revision ID: 20260513_0032
Revises: 20260507_0031
Create Date: 2026-05-13 10:00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260513_0032"
down_revision = "20260507_0031"
branch_labels = None
depends_on = None


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()

    if not _column_exists(bind, "offers", "is_featured"):
        # Staged approach for NOT NULL column to avoid MySQL 1138 error on existing rows
        op.add_column(
            "offers",
            sa.Column("is_featured", sa.Boolean(), nullable=True),
        )
        op.execute("UPDATE offers SET is_featured = false WHERE is_featured IS NULL")
        op.alter_column(
            "offers",
            "is_featured",
            nullable=False,
            server_default="0",
        )


def downgrade() -> None:
    pass
