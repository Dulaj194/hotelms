"""add archive state to super admin notifications

Revision ID: 20260408_0018
Revises: 20260408_0017
Create Date: 2026-04-08 22:15:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260408_0018"
down_revision = "20260408_0017"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_names(bind, table_name: str) -> set[str]:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _index_names(bind, table_name: str) -> set[str]:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    table_name = "super_admin_notification_states"

    if not _table_exists(bind, table_name):
        return

    columns = _column_names(bind, table_name)

    if "archived_at" not in columns:
        op.add_column(
            table_name,
            sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        )

    if "archived_by_user_id" not in columns:
        op.add_column(
            table_name,
            sa.Column("archived_by_user_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_super_admin_notification_states_archived_by_user_id_users",
            table_name,
            "users",
            ["archived_by_user_id"],
            ["id"],
            ondelete="SET NULL",
        )

    indexes = _index_names(bind, table_name)
    if "ix_super_admin_notification_states_archived_at" not in indexes:
        op.create_index(
            "ix_super_admin_notification_states_archived_at",
            table_name,
            ["archived_at"],
            unique=False,
        )
    if "ix_super_admin_notification_states_archived_by_user_id" not in indexes:
        op.create_index(
            "ix_super_admin_notification_states_archived_by_user_id",
            table_name,
            ["archived_by_user_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    table_name = "super_admin_notification_states"

    if not _table_exists(bind, table_name):
        return

    indexes = _index_names(bind, table_name)
    if "ix_super_admin_notification_states_archived_by_user_id" in indexes:
        op.drop_index(
            "ix_super_admin_notification_states_archived_by_user_id",
            table_name=table_name,
        )
    if "ix_super_admin_notification_states_archived_at" in indexes:
        op.drop_index(
            "ix_super_admin_notification_states_archived_at",
            table_name=table_name,
        )

    columns = _column_names(bind, table_name)
    if "archived_by_user_id" in columns:
        op.drop_constraint(
            "fk_super_admin_notification_states_archived_by_user_id_users",
            table_name,
            type_="foreignkey",
        )
        op.drop_column(table_name, "archived_by_user_id")
    if "archived_at" in columns:
        op.drop_column(table_name, "archived_at")
