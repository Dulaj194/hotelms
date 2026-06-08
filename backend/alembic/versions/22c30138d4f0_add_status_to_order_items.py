"""Add status to order_items

Revision ID: 22c30138d4f0
Revises: 20260525_1250_create_pos_intents
Create Date: 2026-06-05 16:13:41.731006
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '22c30138d4f0'
down_revision = '20260525_1250_create_pos_intents'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'order_items',
        sa.Column('status', sa.Enum('pending', 'confirmed', 'processing', 'completed', 'served', 'paid', 'rejected', name='orderstatus'), nullable=False, server_default='pending')
    )
    op.create_index(op.f('ix_order_items_status'), 'order_items', ['status'], unique=False)
    
    # Backfill item statuses based on their parent order's status
    op.execute("""
        UPDATE order_items oi
        JOIN order_headers oh ON oi.order_id = oh.id
        SET oi.status = oh.status
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_order_items_status'), table_name='order_items')
    op.drop_column('order_items', 'status')
