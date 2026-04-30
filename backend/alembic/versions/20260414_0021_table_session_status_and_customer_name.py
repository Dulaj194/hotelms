"""add table session status and customer name

Revision ID: 20260414_0021
Revises: 20260413_0020
Create Date: 2026-04-14 12:45:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260414_0021"
down_revision = "20260413_0020"
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

    if not _table_exists(bind, "table_sessions"):
        return

    if not _column_exists(bind, "table_sessions", "customer_name"):
        op.add_column("table_sessions", sa.Column("customer_name", sa.String(length=120), nullable=True))

    if not _column_exists(bind, "table_sessions", "session_status"):
        op.add_column(
            "table_sessions",
            sa.Column("session_status", sa.String(length=16), nullable=True),
        )
        op.execute(
            """
            UPDATE table_sessions
            SET session_status = CASE
                WHEN is_active = true THEN 'OPEN'
                ELSE 'CLOSED'
            END
            """
        )
        op.alter_column("table_sessions", "session_status", nullable=False)


def downgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "table_sessions"):
        return

    if _column_exists(bind, "table_sessions", "session_status"):
        op.drop_column("table_sessions", "session_status")

    if _column_exists(bind, "table_sessions", "customer_name"):
        op.drop_column("table_sessions", "customer_name")
