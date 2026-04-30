"""add missing notes column to payments

Revision ID: 20260413_0020
Revises: 20260409_0019
Create Date: 2026-04-13 15:50:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260413_0020"
down_revision = "20260409_0019"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "payments"):
        return

    if not _column_exists(bind, "payments", "notes"):
        op.add_column("payments", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "payments"):
        return

    if _column_exists(bind, "payments", "notes"):
        op.drop_column("payments", "notes")
