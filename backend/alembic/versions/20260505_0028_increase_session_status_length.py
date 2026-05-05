"""increase session_status length

Revision ID: 20260505_0028
Revises: 20260505_0027
Create Date: 2026-05-05 11:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260505_0028"
down_revision = "20260505_0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Increase length of session_status column in table_sessions
    op.alter_column(
        "table_sessions",
        "session_status",
        existing_type=sa.String(length=16),
        type_=sa.String(length=32),
        nullable=False
    )


def downgrade() -> None:
    # Note: Reducing length might truncate data if BILL_ACKNOWLEDGED is used
    op.alter_column(
        "table_sessions",
        "session_status",
        existing_type=sa.String(length=32),
        type_=sa.String(length=16),
        nullable=False
    )
