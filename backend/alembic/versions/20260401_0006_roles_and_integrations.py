"""expand staff roles and add restaurant integration fields

Revision ID: 20260401_0006
Revises: 20260401_0005
Create Date: 2026-04-01 18:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260401_0006"
down_revision = "20260401_0005"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    bind = op.get_bind()
    if _column_exists(bind, table_name, column.name):
        return
    op.add_column(table_name, column)


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    if _table_exists(bind, "users") and dialect_name in {"mysql", "mariadb"}:
        op.execute(
            """
            ALTER TABLE users
            MODIFY COLUMN role ENUM(
                'owner',
                'admin',
                'steward',
                'housekeeper',
                'cashier',
                'accountant',
                'super_admin'
            ) NOT NULL
            """
        )

    if not _table_exists(bind, "restaurants"):
        return

    _add_column_if_missing(
        "restaurants",
        sa.Column("integration_api_key_hash", sa.String(length=128), nullable=True),
    )
    _add_column_if_missing(
        "restaurants",
        sa.Column("integration_api_key_prefix", sa.String(length=16), nullable=True),
    )
    _add_column_if_missing(
        "restaurants",
        sa.Column("integration_api_key_last4", sa.String(length=4), nullable=True),
    )
    _add_column_if_missing(
        "restaurants",
        sa.Column(
            "integration_api_key_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    _add_column_if_missing(
        "restaurants",
        sa.Column("integration_api_key_rotated_at", sa.DateTime(timezone=True), nullable=True),
    )
    _add_column_if_missing(
        "restaurants",
        sa.Column(
            "integration_public_ordering_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    _add_column_if_missing(
        "restaurants",
        sa.Column("integration_webhook_url", sa.String(length=500), nullable=True),
    )
    _add_column_if_missing(
        "restaurants",
        sa.Column(
            "integration_webhook_status",
            sa.String(length=32),
            nullable=False,
            server_default="not_configured",
        ),
    )
    _add_column_if_missing(
        "restaurants",
        sa.Column("integration_webhook_last_checked_at", sa.DateTime(timezone=True), nullable=True),
    )
    _add_column_if_missing(
        "restaurants",
        sa.Column("integration_webhook_last_error", sa.Text(), nullable=True),
    )

    inspector = sa.inspect(bind)
    index_names = {index["name"] for index in inspector.get_indexes("restaurants")}
    if "ix_restaurants_integration_api_key_hash" not in index_names:
        op.create_index(
            "ix_restaurants_integration_api_key_hash",
            "restaurants",
            ["integration_api_key_hash"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "restaurants"):
        return

    inspector = sa.inspect(bind)
    index_names = {index["name"] for index in inspector.get_indexes("restaurants")}
    if "ix_restaurants_integration_api_key_hash" in index_names:
        op.drop_index("ix_restaurants_integration_api_key_hash", table_name="restaurants")

    for column_name in (
        "integration_webhook_last_error",
        "integration_webhook_last_checked_at",
        "integration_webhook_status",
        "integration_webhook_url",
        "integration_public_ordering_enabled",
        "integration_api_key_rotated_at",
        "integration_api_key_active",
        "integration_api_key_last4",
        "integration_api_key_prefix",
        "integration_api_key_hash",
    ):
        if _column_exists(bind, "restaurants", column_name):
            op.drop_column("restaurants", column_name)
