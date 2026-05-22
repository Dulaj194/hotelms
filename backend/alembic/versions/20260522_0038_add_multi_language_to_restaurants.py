"""add_multi_language_to_restaurants

Revision ID: 0038
Revises: 0037
Create Date: 2026-05-22 08:25:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260522_0038'
down_revision = '20260519_0037'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('restaurants', sa.Column('default_language', sa.String(length=10), server_default=sa.text("'en'"), nullable=False))
    op.add_column('restaurants', sa.Column('allow_multi_language', sa.Boolean(), server_default=sa.text("0"), nullable=False))

def downgrade() -> None:
    op.drop_column('restaurants', 'allow_multi_language')
    op.drop_column('restaurants', 'default_language')
