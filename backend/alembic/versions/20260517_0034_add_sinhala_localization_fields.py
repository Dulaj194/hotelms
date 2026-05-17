"""Add Sinhala localization fields to items, categories, and offers.

Revision ID: 20260517_0034
Revises: 20260515_0033
Create Date: 2026-05-17 02:10:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260517_0034"
down_revision = "20260515_0033"
branch_labels = None
depends_on = None


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Sync items columns
    items_cols = {
        "name_si": sa.String(length=255),
        "description_si": sa.Text(),
        "more_details_si": sa.Text(),
    }
    for col_name, col_type in items_cols.items():
        if not _column_exists(bind, "items", col_name):
            op.add_column("items", sa.Column(col_name, col_type, nullable=True))

    # 2. Sync categories columns
    cats_cols = {
        "name_si": sa.String(length=255),
        "description_si": sa.Text(),
    }
    for col_name, col_type in cats_cols.items():
        if not _column_exists(bind, "categories", col_name):
            op.add_column("categories", sa.Column(col_name, col_type, nullable=True))

    # 3. Sync offers columns
    offers_cols = {
        "title_si": sa.String(length=100),
        "description_si": sa.Text(),
    }
    for col_name, col_type in offers_cols.items():
        if not _column_exists(bind, "offers", col_name):
            op.add_column("offers", sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    # Downgrades are optional but good practice.
    # op.drop_column("items", "more_details_si")
    # op.drop_column("items", "description_si")
    # op.drop_column("items", "name_si")
    # ... etc
    pass
