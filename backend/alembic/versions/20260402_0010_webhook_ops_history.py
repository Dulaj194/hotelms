"""add webhook secret management and delivery history

Revision ID: 20260402_0010
Revises: 20260401_0009
Create Date: 2026-04-02 11:40:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260402_0010"
down_revision = "20260401_0009"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()

    restaurant_columns = (
        ("integration_webhook_secret_header_name", sa.String(length=100)),
        ("integration_webhook_secret_ciphertext", sa.Text()),
        ("integration_webhook_secret_last4", sa.String(length=4)),
        ("integration_webhook_secret_rotated_at", sa.DateTime(timezone=True)),
    )
    for column_name, column_type in restaurant_columns:
        if _column_exists(bind, "restaurants", column_name):
            continue
        op.add_column("restaurants", sa.Column(column_name, column_type, nullable=True))

    if not _table_exists(bind, "restaurant_webhook_deliveries"):
        op.create_table(
            "restaurant_webhook_deliveries",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("triggered_by_user_id", sa.Integer(), nullable=True),
            sa.Column("retried_from_delivery_id", sa.Integer(), nullable=True),
            sa.Column("event_type", sa.String(length=100), nullable=False),
            sa.Column("request_url", sa.String(length=500), nullable=False),
            sa.Column("payload_json", sa.Text(), nullable=False),
            sa.Column(
                "delivery_status",
                sa.Enum("success", "failed", name="webhookdeliverystatus", native_enum=False),
                nullable=False,
            ),
            sa.Column(
                "attempt_number",
                sa.Integer(),
                nullable=False,
                server_default="1",
            ),
            sa.Column(
                "is_retry",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
            sa.Column("http_status_code", sa.Integer(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("response_excerpt", sa.Text(), nullable=True),
            sa.Column("response_time_ms", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["triggered_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(
                ["retried_from_delivery_id"],
                ["restaurant_webhook_deliveries.id"],
                ondelete="SET NULL",
            ),
        )
        op.create_index(
            "ix_restaurant_webhook_deliveries_restaurant_id",
            "restaurant_webhook_deliveries",
            ["restaurant_id"],
            unique=False,
        )
        op.create_index(
            "ix_restaurant_webhook_deliveries_triggered_by_user_id",
            "restaurant_webhook_deliveries",
            ["triggered_by_user_id"],
            unique=False,
        )
        op.create_index(
            "ix_restaurant_webhook_deliveries_retried_from_delivery_id",
            "restaurant_webhook_deliveries",
            ["retried_from_delivery_id"],
            unique=False,
        )
        op.create_index(
            "ix_restaurant_webhook_deliveries_event_type",
            "restaurant_webhook_deliveries",
            ["event_type"],
            unique=False,
        )
        op.create_index(
            "ix_restaurant_webhook_deliveries_created_at",
            "restaurant_webhook_deliveries",
            ["created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "restaurant_webhook_deliveries"):
        for index_name in (
            "ix_restaurant_webhook_deliveries_created_at",
            "ix_restaurant_webhook_deliveries_event_type",
            "ix_restaurant_webhook_deliveries_retried_from_delivery_id",
            "ix_restaurant_webhook_deliveries_triggered_by_user_id",
            "ix_restaurant_webhook_deliveries_restaurant_id",
        ):
            if _index_exists(bind, "restaurant_webhook_deliveries", index_name):
                op.drop_index(index_name, table_name="restaurant_webhook_deliveries")
        op.drop_table("restaurant_webhook_deliveries")

    for column_name in (
        "integration_webhook_secret_rotated_at",
        "integration_webhook_secret_last4",
        "integration_webhook_secret_ciphertext",
        "integration_webhook_secret_header_name",
    ):
        if _column_exists(bind, "restaurants", column_name):
            op.drop_column("restaurants", column_name)
