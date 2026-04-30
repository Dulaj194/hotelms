"""add super admin scopes and steward feature flag

Revision ID: 20260401_0008
Revises: 20260401_0007
Create Date: 2026-04-01 20:15:00
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "20260401_0008"
down_revision = "20260401_0007"
branch_labels = None
depends_on = None


DEFAULT_PLATFORM_SCOPES = json.dumps(
    ["ops_viewer", "tenant_admin", "billing_admin", "security_admin"]
)


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("platform_scopes_json", sa.Text(), nullable=True),
    )
    op.add_column(
        "restaurants",
        sa.Column(
            "enable_steward",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE users
            SET platform_scopes_json = :default_scopes
            WHERE role = 'super_admin'
              AND restaurant_id IS NULL
              AND (platform_scopes_json IS NULL OR platform_scopes_json = '')
            """
        ),
        {"default_scopes": DEFAULT_PLATFORM_SCOPES},
    )

    op.alter_column("restaurants", "enable_steward", server_default=None)


def downgrade() -> None:
    op.drop_column("restaurants", "enable_steward")
    op.drop_column("users", "platform_scopes_json")
