"""Add item_image_snapshot to order_items table.

Revision ID: 20260415_0022
Revises: 20260414_0021
Create Date: 2026-04-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260415_0022"
down_revision = "20260414_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add item_image_snapshot column to order_items
    op.add_column(
        "order_items",
        sa.Column("item_image_snapshot", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    # Remove item_image_snapshot column from order_items
    op.drop_column("order_items", "item_image_snapshot")
