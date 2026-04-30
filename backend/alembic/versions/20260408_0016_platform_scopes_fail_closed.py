"""normalize platform scopes to fail closed

Revision ID: 20260408_0016
Revises: 20260403_0015
Create Date: 2026-04-08 18:10:00
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "20260408_0016"
down_revision = "20260403_0015"
branch_labels = None
depends_on = None


_VALID_SCOPE_KEYS = {
    "ops_viewer",
    "tenant_admin",
    "billing_admin",
    "security_admin",
}


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_names(bind, table_name: str) -> set[str]:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _normalize_platform_scope_payload(raw_value: object) -> str:
    if raw_value is None:
        return "[]"

    decoded: str
    if isinstance(raw_value, (bytes, bytearray)):
        try:
            decoded = raw_value.decode()
        except Exception:
            return "[]"
    else:
        decoded = str(raw_value)

    decoded = decoded.strip()
    if not decoded:
        return "[]"

    try:
        parsed = json.loads(decoded)
    except Exception:
        return "[]"

    if not isinstance(parsed, list):
        return "[]"

    normalized: list[str] = []
    for item in parsed:
        candidate = str(item).strip().lower()
        if candidate in _VALID_SCOPE_KEYS and candidate not in normalized:
            normalized.append(candidate)

    return json.dumps(normalized, ensure_ascii=True)


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "users"):
        return

    columns = _column_names(bind, "users")
    if "platform_scopes_json" not in columns:
        return

    rows = bind.execute(
        sa.text(
            """
            SELECT id, platform_scopes_json
            FROM users
            WHERE role = 'super_admin'
              AND restaurant_id IS NULL
            """
        )
    ).fetchall()

    for row in rows:
        user_id = int(row.id)
        current_value = row.platform_scopes_json
        normalized_value = _normalize_platform_scope_payload(current_value)

        if current_value == normalized_value:
            continue

        bind.execute(
            sa.text(
                """
                UPDATE users
                SET platform_scopes_json = :platform_scopes_json
                WHERE id = :user_id
                """
            ),
            {
                "platform_scopes_json": normalized_value,
                "user_id": user_id,
            },
        )


def downgrade() -> None:
    # Data normalization migration; no reversible transform.
    return
