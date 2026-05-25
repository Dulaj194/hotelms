"""create_payment_terminals

Revision ID: 0039
Revises: 0038
Create Date: 2026-05-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0039'
down_revision = '20260522_0038'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'payment_terminals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('counter_name', sa.String(length=100), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('encrypted_merchant_id', sa.Text(), nullable=False),
        sa.Column('encrypted_terminal_id', sa.Text(), nullable=False),
        sa.Column('encrypted_api_key', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('restaurant_id', 'counter_name', name='uq_payment_terminals_counter')
    )
    op.create_index(op.f('ix_payment_terminals_id'), 'payment_terminals', ['id'], unique=False)
    op.create_index(op.f('ix_payment_terminals_restaurant_id'), 'payment_terminals', ['restaurant_id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_payment_terminals_restaurant_id'), table_name='payment_terminals')
    op.drop_index(op.f('ix_payment_terminals_id'), table_name='payment_terminals')
    op.drop_table('payment_terminals')
