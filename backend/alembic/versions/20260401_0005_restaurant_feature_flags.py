"""add restaurant feature flag columns

Revision ID: 20260401_0005
Revises: 20260401_0004
Create Date: 2026-04-01 15:15:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260401_0005"
down_revision = "20260401_0004"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _add_boolean_column(bind, table_name: str, column_name: str) -> None:
    if _column_exists(bind, table_name, column_name):
        return

    op.add_column(
        table_name,
        sa.Column(
            column_name,
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "restaurants"):
        return

    for column_name in (
        "enable_housekeeping",
        "enable_kds",
        "enable_reports",
        "enable_accountant",
        "enable_cashier",
    ):
        _add_boolean_column(bind, "restaurants", column_name)


def downgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "restaurants"):
        return

    for column_name in (
        "enable_cashier",
        "enable_accountant",
        "enable_reports",
        "enable_kds",
        "enable_housekeeping",
    ):
        if _column_exists(bind, "restaurants", column_name):
            op.drop_column("restaurants", column_name)
