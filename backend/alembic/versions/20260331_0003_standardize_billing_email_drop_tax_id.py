"""standardize billing email defaults and drop tax id

Revision ID: 20260331_0003
Revises: 20260331_0002
Create Date: 2026-03-31 09:35:00
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260331_0003"
down_revision = "20260331_0002"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _as_json_object(value):
    if value is None:
        return {}
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except Exception:
            return {}
        return dict(parsed) if isinstance(parsed, dict) else {}
    return {}


def _without_tax_id_key(value):
    payload = _as_json_object(value)
    if "tax_id" in payload:
        payload.pop("tax_id", None)
    return payload


def upgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "restaurants"):
        if not _column_exists(bind, "restaurants", "billing_email"):
            op.add_column("restaurants", sa.Column("billing_email", sa.String(length=191), nullable=True))

        if _column_exists(bind, "restaurants", "email") and _column_exists(bind, "restaurants", "billing_email"):
            op.execute(
                sa.text(
                    """
                    UPDATE restaurants
                    SET billing_email = email
                    WHERE (billing_email IS NULL OR billing_email = '')
                      AND email IS NOT NULL
                      AND email <> ''
                    """
                )
            )

        if _column_exists(bind, "restaurants", "tax_id"):
            op.drop_column("restaurants", "tax_id")

    if _table_exists(bind, "settings_requests"):
        rows = bind.execute(
            sa.text(
                """
                SELECT request_id, requested_changes, current_settings
                FROM settings_requests
                """
            )
        ).mappings()
        for row in rows:
            requested_changes = _without_tax_id_key(row["requested_changes"])
            current_settings = _without_tax_id_key(row["current_settings"])
            bind.execute(
                sa.text(
                    """
                    UPDATE settings_requests
                    SET requested_changes = :requested_changes,
                        current_settings = :current_settings
                    WHERE request_id = :request_id
                    """
                ),
                {
                    "request_id": row["request_id"],
                    "requested_changes": json.dumps(requested_changes),
                    "current_settings": json.dumps(current_settings),
                },
            )

    if _table_exists(bind, "dashboard_setup_progress") and _column_exists(
        bind, "dashboard_setup_progress", "completed_keys_json"
    ):
        rows = bind.execute(
            sa.text(
                """
                SELECT id, completed_keys_json
                FROM dashboard_setup_progress
                """
            )
        ).mappings()
        for row in rows:
            try:
                completed_keys = json.loads(row["completed_keys_json"] or "[]")
            except Exception:
                completed_keys = []
            if not isinstance(completed_keys, list):
                completed_keys = []
            normalized_keys = [str(item) for item in completed_keys if str(item) != "tax_id"]
            bind.execute(
                sa.text(
                    """
                    UPDATE dashboard_setup_progress
                    SET completed_keys_json = :completed_keys_json
                    WHERE id = :id
                    """
                ),
                {
                    "id": row["id"],
                    "completed_keys_json": json.dumps(normalized_keys),
                },
            )


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "restaurants") and not _column_exists(bind, "restaurants", "tax_id"):
        op.add_column("restaurants", sa.Column("tax_id", sa.String(length=100), nullable=True))
