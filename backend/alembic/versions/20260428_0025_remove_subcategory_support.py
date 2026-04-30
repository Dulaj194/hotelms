"""Remove subcategory support - simplify menu structure

Revision ID: 20260428_0025
Revises: 20260419_0024
Create Date: 2026-04-28 12:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260428_0025"
down_revision = "20260419_0024"
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
    
    # Remove subcategory_id column from items table if it exists
    if _table_exists(bind, "items"):
        columns = _column_names(bind, "items")
        if "subcategory_id" in columns:
            op.drop_column("items", "subcategory_id")
    
    # Drop subcategories table if it exists
    if _table_exists(bind, "subcategories"):
        op.drop_table("subcategories")


def downgrade() -> None:
    bind = op.get_bind()
    
    # Recreate subcategories table
    if not _table_exists(bind, "subcategories"):
        op.create_table(
            "subcategories",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("image_path", sa.String(500), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("category_id", sa.Integer(), nullable=False),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
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
            sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.Index("ix_subcategories_category_id", "category_id"),
            sa.Index("ix_subcategories_restaurant_id", "restaurant_id"),
        )
    
    # Recreate subcategory_id column in items table if it doesn't exist
    if _table_exists(bind, "items"):
        columns = _column_names(bind, "items")
        if "subcategory_id" not in columns:
            op.add_column("items", sa.Column("subcategory_id", sa.Integer(), nullable=True))
