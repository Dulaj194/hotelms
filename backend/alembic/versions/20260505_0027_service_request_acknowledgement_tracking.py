"""Add acknowledgement tracking to service requests.

Revision ID: 20260505_0027
Revises: 20260429_0026
Create Date: 2026-05-05 10:00:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260505_0027"
down_revision = "20260429_0026"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    return table_name in sa.inspect(bind).get_table_names()


def _column_names(bind, table_name: str) -> set[str]:
    if not _table_exists(bind, table_name):
        return set()
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def upgrade() -> None:
    """Add acknowledgement tracking columns to table_service_requests."""
    bind = op.get_bind()
    existing_columns = _column_names(bind, "table_service_requests")

    # Add acknowledged_by column (FK to users)
    if "acknowledged_by" not in existing_columns:
        op.add_column(
            "table_service_requests",
            sa.Column(
                "acknowledged_by",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )

    # Add acknowledged_at column (timestamp)
    if "acknowledged_at" not in existing_columns:
        op.add_column(
            "table_service_requests",
            sa.Column(
                "acknowledged_at",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
        )

    # Create index on acknowledged_by for query performance
    try:
        op.create_index(
            op.f("ix_table_service_requests_acknowledged_by"),
            "table_service_requests",
            ["acknowledged_by"],
            unique=False,
        )
    except Exception:
        pass  # Index may already exist


def downgrade() -> None:
    """Remove acknowledgement tracking columns from table_service_requests."""
    bind = op.get_bind()
    existing_columns = _column_names(bind, "table_service_requests")

    # Drop index if exists
    try:
        op.drop_index(
            op.f("ix_table_service_requests_acknowledged_by"),
            table_name="table_service_requests",
        )
    except Exception:
        pass

    # Drop columns
    if "acknowledged_at" in existing_columns:
        op.drop_column("table_service_requests", "acknowledged_at")

    if "acknowledged_by" in existing_columns:
        op.drop_column("table_service_requests", "acknowledged_by")
