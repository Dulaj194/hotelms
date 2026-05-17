"""Add image_path_si to items, categories, and offers.

Revision ID: 20260517_0035
Revises: 20260517_0034
Create Date: 2026-05-17 02:15:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260517_0035"
down_revision = "20260517_0034"
branch_labels = None
depends_on = None


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()

    tables = ["items", "categories", "offers"]
    for table in tables:
        if not _column_exists(bind, table, "image_path_si"):
            op.add_column(table, sa.Column("image_path_si", sa.String(length=500), nullable=True))


def downgrade() -> None:
    pass
