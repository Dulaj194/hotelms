"""add audit log restaurant context and subscription history

Revision ID: 20260401_0007
Revises: 20260401_0006
Create Date: 2026-04-01 20:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260401_0007"
down_revision = "20260401_0006"
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

    if _table_exists(bind, "audit_logs") and not _column_exists(bind, "audit_logs", "restaurant_id"):
        op.add_column(
            "audit_logs",
            sa.Column("restaurant_id", sa.Integer(), nullable=True),
        )
    if _table_exists(bind, "audit_logs") and not _index_exists(bind, "audit_logs", "ix_audit_logs_restaurant_id"):
        op.create_index(
            "ix_audit_logs_restaurant_id",
            "audit_logs",
            ["restaurant_id"],
            unique=False,
        )

    if not _table_exists(bind, "subscription_change_logs"):
        op.create_table(
            "subscription_change_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("subscription_id", sa.Integer(), nullable=True),
            sa.Column("actor_user_id", sa.Integer(), nullable=True),
            sa.Column(
                "action",
                sa.Enum(
                    "trial_assigned",
                    "activated",
                    "updated",
                    "cancelled",
                    "expired",
                    name="subscriptionchangeaction",
                ),
                nullable=False,
            ),
            sa.Column("source", sa.String(length=50), nullable=False),
            sa.Column("change_reason", sa.Text(), nullable=True),
            sa.Column("previous_package_id", sa.Integer(), nullable=True),
            sa.Column("next_package_id", sa.Integer(), nullable=True),
            sa.Column(
                "previous_status",
                sa.Enum(
                    "trial",
                    "active",
                    "expired",
                    "cancelled",
                    name="subscriptionstatus",
                ),
                nullable=True,
            ),
            sa.Column(
                "next_status",
                sa.Enum(
                    "trial",
                    "active",
                    "expired",
                    "cancelled",
                    name="subscriptionstatus",
                ),
                nullable=True,
            ),
            sa.Column("previous_expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("next_expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("metadata_json", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["subscription_id"], ["restaurant_subscriptions.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["previous_package_id"], ["packages.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["next_package_id"], ["packages.id"], ondelete="SET NULL"),
        )
        op.create_index(
            "ix_subscription_change_logs_restaurant_id",
            "subscription_change_logs",
            ["restaurant_id"],
            unique=False,
        )
        op.create_index(
            "ix_subscription_change_logs_subscription_id",
            "subscription_change_logs",
            ["subscription_id"],
            unique=False,
        )
        op.create_index(
            "ix_subscription_change_logs_actor_user_id",
            "subscription_change_logs",
            ["actor_user_id"],
            unique=False,
        )
        op.create_index(
            "ix_subscription_change_logs_created_at",
            "subscription_change_logs",
            ["created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "subscription_change_logs"):
        for index_name in (
            "ix_subscription_change_logs_created_at",
            "ix_subscription_change_logs_actor_user_id",
            "ix_subscription_change_logs_subscription_id",
            "ix_subscription_change_logs_restaurant_id",
        ):
            if _index_exists(bind, "subscription_change_logs", index_name):
                op.drop_index(index_name, table_name="subscription_change_logs")
        op.drop_table("subscription_change_logs")

    if _table_exists(bind, "audit_logs"):
        if _index_exists(bind, "audit_logs", "ix_audit_logs_restaurant_id"):
            op.drop_index("ix_audit_logs_restaurant_id", table_name="audit_logs")
        if _column_exists(bind, "audit_logs", "restaurant_id"):
            op.drop_column("audit_logs", "restaurant_id")
