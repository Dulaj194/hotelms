"""add order_source to table sessions and service requests

Revision ID: 20260506_0030
Revises: 20260506_0029
Create Date: 2026-05-06 17:00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260506_0030"
down_revision = "20260506_0029"
branch_labels = None
depends_on = None


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Add order_source to table_sessions
    if not _column_exists(bind, "table_sessions", "order_source"):
        op.add_column(
            "table_sessions",
            sa.Column(
                "order_source",
                sa.String(length=20),
                nullable=False,
                server_default="table",
            )
        )

    # 2. Add order_source to table_service_requests
    if not _column_exists(bind, "table_service_requests", "order_source"):
        op.add_column(
            "table_service_requests",
            sa.Column(
                "order_source",
                sa.String(length=20),
                nullable=False,
                server_default="table",
            )
        )


def downgrade() -> None:
    bind = op.get_bind()

    # 1. Remove order_source from table_service_requests
    if _column_exists(bind, "table_service_requests", "order_source"):
        op.drop_column("table_service_requests", "order_source")

    # 2. Remove order_source from table_sessions
    if _column_exists(bind, "table_sessions", "order_source"):
        op.drop_column("table_sessions", "order_source")
