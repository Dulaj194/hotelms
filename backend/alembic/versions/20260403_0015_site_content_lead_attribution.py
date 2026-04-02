"""add contact lead attribution fields

Revision ID: 20260403_0015
Revises: 20260403_0014
Create Date: 2026-04-03 09:35:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260403_0015"
down_revision = "20260403_0014"
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


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "contact_leads"):
        return

    columns = _column_names(bind, "contact_leads")
    additions = [
        ("source_path", sa.String(length=255)),
        ("entry_point", sa.String(length=120)),
        ("login_intent", sa.String(length=80)),
        ("referrer_url", sa.String(length=500)),
        ("utm_source", sa.String(length=120)),
        ("utm_medium", sa.String(length=120)),
        ("utm_campaign", sa.String(length=150)),
        ("utm_term", sa.String(length=150)),
        ("utm_content", sa.String(length=150)),
    ]

    for name, column_type in additions:
        if name not in columns:
            op.add_column("contact_leads", sa.Column(name, column_type, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "contact_leads"):
        return

    columns = _column_names(bind, "contact_leads")
    with op.batch_alter_table("contact_leads") as batch_op:
        for column_name in [
            "utm_content",
            "utm_term",
            "utm_campaign",
            "utm_medium",
            "utm_source",
            "referrer_url",
            "login_intent",
            "entry_point",
            "source_path",
        ]:
            if column_name in columns:
                batch_op.drop_column(column_name)
