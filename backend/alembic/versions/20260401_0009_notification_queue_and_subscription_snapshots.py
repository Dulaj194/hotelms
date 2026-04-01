"""add notification queue state and immutable subscription snapshots

Revision ID: 20260401_0009
Revises: 20260401_0008
Create Date: 2026-04-01 22:15:00
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "20260401_0009"
down_revision = "20260401_0008"
branch_labels = None
depends_on = None


HIGH_SIGNAL_EVENT_TYPES = (
    "restaurant_registration_success",
    "restaurant_registration_approved",
    "restaurant_registration_rejected",
    "settings_request_submitted",
    "settings_request_approved",
    "settings_request_rejected",
    "subscription_trial_assigned",
    "subscription_activated",
    "subscription_updated",
    "subscription_cancelled",
    "subscription_expired",
    "platform_user_created",
    "platform_user_updated",
    "platform_user_disabled",
    "platform_user_deleted",
    "staff_created",
    "staff_updated",
    "staff_disabled",
    "staff_deleted",
    "restaurant_api_key_generated",
    "restaurant_api_key_rotated",
    "restaurant_api_key_revoked",
    "restaurant_integration_updated",
    "restaurant_webhook_health_checked",
    "login_failed",
)


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

    if _table_exists(bind, "subscription_change_logs"):
        subscription_snapshot_columns = (
            ("previous_package_name_snapshot", sa.String(length=100)),
            ("previous_package_code_snapshot", sa.String(length=50)),
            ("next_package_name_snapshot", sa.String(length=100)),
            ("next_package_code_snapshot", sa.String(length=50)),
        )
        for column_name, column_type in subscription_snapshot_columns:
            if _column_exists(bind, "subscription_change_logs", column_name):
                continue
            op.add_column(
                "subscription_change_logs",
                sa.Column(column_name, column_type, nullable=True),
            )

    if not _table_exists(bind, "super_admin_notification_states"):
        op.create_table(
            "super_admin_notification_states",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("audit_log_id", sa.Integer(), nullable=False),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("read_by_user_id", sa.Integer(), nullable=True),
            sa.Column("assigned_user_id", sa.Integer(), nullable=True),
            sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("acknowledged_by_user_id", sa.Integer(), nullable=True),
            sa.Column("snoozed_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.ForeignKeyConstraint(["audit_log_id"], ["audit_logs.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["read_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["assigned_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["acknowledged_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.UniqueConstraint(
                "audit_log_id",
                name="uq_super_admin_notification_states_audit_log_id",
            ),
        )
        op.create_index(
            "ix_super_admin_notification_states_is_read",
            "super_admin_notification_states",
            ["is_read"],
            unique=False,
        )
        op.create_index(
            "ix_super_admin_notification_states_read_by_user_id",
            "super_admin_notification_states",
            ["read_by_user_id"],
            unique=False,
        )
        op.create_index(
            "ix_super_admin_notification_states_assigned_user_id",
            "super_admin_notification_states",
            ["assigned_user_id"],
            unique=False,
        )
        op.create_index(
            "ix_super_admin_notification_states_acknowledged_at",
            "super_admin_notification_states",
            ["acknowledged_at"],
            unique=False,
        )
        op.create_index(
            "ix_super_admin_notification_states_acknowledged_by_user_id",
            "super_admin_notification_states",
            ["acknowledged_by_user_id"],
            unique=False,
        )
        op.create_index(
            "ix_super_admin_notification_states_snoozed_until",
            "super_admin_notification_states",
            ["snoozed_until"],
            unique=False,
        )

    if _table_exists(bind, "audit_logs") and _table_exists(bind, "super_admin_notification_states"):
        existing_state_ids = set(
            bind.execute(
                sa.text("SELECT audit_log_id FROM super_admin_notification_states")
            ).scalars()
        )
        audit_rows = bind.execute(
            sa.text("SELECT id, event_type FROM audit_logs")
        ).mappings()
        seed_rows = [
            {"audit_log_id": row["id"]}
            for row in audit_rows
            if row["event_type"] in HIGH_SIGNAL_EVENT_TYPES
            and row["id"] not in existing_state_ids
        ]
        if seed_rows:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO super_admin_notification_states (
                        audit_log_id,
                        is_read,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :audit_log_id,
                        0,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    """
                ),
                seed_rows,
            )

    if _table_exists(bind, "subscription_change_logs"):
        package_map = {
            row["id"]: row
            for row in bind.execute(
                sa.text("SELECT id, name, code FROM packages")
            ).mappings()
        }
        history_rows = bind.execute(
            sa.text(
                """
                SELECT
                    id,
                    previous_package_id,
                    next_package_id,
                    metadata_json
                FROM subscription_change_logs
                """
            )
        ).mappings()

        snapshot_updates = []
        for row in history_rows:
            metadata: dict[str, object] = {}
            metadata_json = row["metadata_json"]
            if metadata_json:
                try:
                    parsed = json.loads(metadata_json)
                except Exception:
                    parsed = {}
                if isinstance(parsed, dict):
                    metadata = parsed

            previous_package = package_map.get(row["previous_package_id"])
            next_package = package_map.get(row["next_package_id"])

            snapshot_updates.append(
                {
                    "id": row["id"],
                    "previous_package_name_snapshot": metadata.get("previous_package_name")
                    or (previous_package["name"] if previous_package else None),
                    "previous_package_code_snapshot": metadata.get("previous_package_code")
                    or (previous_package["code"] if previous_package else None),
                    "next_package_name_snapshot": metadata.get("next_package_name")
                    or metadata.get("package_name")
                    or (next_package["name"] if next_package else None),
                    "next_package_code_snapshot": metadata.get("next_package_code")
                    or (next_package["code"] if next_package else None),
                }
            )

        if snapshot_updates:
            bind.execute(
                sa.text(
                    """
                    UPDATE subscription_change_logs
                    SET
                        previous_package_name_snapshot = :previous_package_name_snapshot,
                        previous_package_code_snapshot = :previous_package_code_snapshot,
                        next_package_name_snapshot = :next_package_name_snapshot,
                        next_package_code_snapshot = :next_package_code_snapshot
                    WHERE id = :id
                    """
                ),
                snapshot_updates,
            )


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "super_admin_notification_states"):
        for index_name in (
            "ix_super_admin_notification_states_snoozed_until",
            "ix_super_admin_notification_states_acknowledged_by_user_id",
            "ix_super_admin_notification_states_acknowledged_at",
            "ix_super_admin_notification_states_assigned_user_id",
            "ix_super_admin_notification_states_read_by_user_id",
            "ix_super_admin_notification_states_is_read",
        ):
            if _index_exists(bind, "super_admin_notification_states", index_name):
                op.drop_index(index_name, table_name="super_admin_notification_states")
        op.drop_table("super_admin_notification_states")

    if _table_exists(bind, "subscription_change_logs"):
        for column_name in (
            "next_package_code_snapshot",
            "next_package_name_snapshot",
            "previous_package_code_snapshot",
            "previous_package_name_snapshot",
        ):
            if _column_exists(bind, "subscription_change_logs", column_name):
                op.drop_column("subscription_change_logs", column_name)
