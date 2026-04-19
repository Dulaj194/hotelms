"""Add public_menu_banner_urls_json to restaurants.

Revision ID: 20260416_0023
Revises: 20260415_0022
Create Date: 2026-04-16 12:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260416_0023"
down_revision = "20260415_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "restaurants",
        sa.Column("public_menu_banner_urls_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("restaurants", "public_menu_banner_urls_json")
