"""Create table_service_requests and update session_status length.

Revision ID: 20260506_0029
Revises: 20260429_0026
Create Date: 2026-05-06 06:55:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260506_0029"
down_revision = "20260429_0026"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    return table_name in sa.inspect(bind).get_table_names()


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Create table_service_requests if it doesn't exist
    if not _table_exists(bind, "table_service_requests"):
        op.create_table(
            "table_service_requests",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("session_id", sa.String(length=64), nullable=False),
            sa.Column("table_number", sa.String(length=50), nullable=False),
            sa.Column("customer_name", sa.String(length=120), nullable=True),
            sa.Column("service_type", sa.String(length=50), nullable=False),
            sa.Column("message", sa.String(length=500), nullable=True),
            sa.Column("acknowledged_by", sa.Integer(), nullable=True),
            sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["acknowledged_by"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_table_service_requests_id"), "table_service_requests", ["id"], unique=False)
        op.create_index(op.f("ix_table_service_requests_restaurant_id"), "table_service_requests", ["restaurant_id"], unique=False)
        op.create_index(op.f("ix_table_service_requests_session_id"), "table_service_requests", ["session_id"], unique=False)
        op.create_index(op.f("ix_table_service_requests_is_completed"), "table_service_requests", ["is_completed"], unique=False)
        op.create_index(op.f("ix_table_service_requests_acknowledged_by"), "table_service_requests", ["acknowledged_by"], unique=False)

    # 2. Increase length of session_status column in table_sessions to support BILL_ACKNOWLEDGED (17 chars)
    if _table_exists(bind, "table_sessions"):
        op.alter_column(
            "table_sessions",
            "session_status",
            existing_type=sa.String(length=16),
            type_=sa.String(length=32),
            nullable=False
        )


def downgrade() -> None:
    bind = op.get_bind()

    # 1. Drop table_service_requests
    if _table_exists(bind, "table_service_requests"):
        op.drop_table("table_service_requests")

    # 2. Revert session_status length (Note: This might truncate data if BILL_ACKNOWLEDGED is used)
    if _table_exists(bind, "table_sessions"):
        op.alter_column(
            "table_sessions",
            "session_status",
            existing_type=sa.String(length=32),
            type_=sa.String(length=16),
            nullable=False
        )
