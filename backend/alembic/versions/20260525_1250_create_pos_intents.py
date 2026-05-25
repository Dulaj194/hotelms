"""create pos payment intents

Revision ID: 20260525_1250_create_pos_intents
Revises: 20260525_0039_create_payment_terminals
Create Date: 2026-05-25 12:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260525_1250_create_pos_intents'
down_revision = '0039'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'pos_payment_intents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('terminal_id', sa.Integer(), nullable=False),
        sa.Column('bill_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('status', sa.Enum('pending', 'paid', 'failed', 'cancelled', name='pospaymentstatus'), nullable=False),
        sa.Column('provider_reference', sa.String(length=255), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['terminal_id'], ['payment_terminals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['bill_id'], ['bills.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pos_payment_intents_id'), 'pos_payment_intents', ['id'], unique=False)
    op.create_index(op.f('ix_pos_payment_intents_restaurant_id'), 'pos_payment_intents', ['restaurant_id'], unique=False)
    op.create_index(op.f('ix_pos_payment_intents_terminal_id'), 'pos_payment_intents', ['terminal_id'], unique=False)
    op.create_index(op.f('ix_pos_payment_intents_bill_id'), 'pos_payment_intents', ['bill_id'], unique=False)
    op.create_index(op.f('ix_pos_payment_intents_session_id'), 'pos_payment_intents', ['session_id'], unique=False)
    op.create_index(op.f('ix_pos_payment_intents_provider_reference'), 'pos_payment_intents', ['provider_reference'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_pos_payment_intents_provider_reference'), table_name='pos_payment_intents')
    op.drop_index(op.f('ix_pos_payment_intents_session_id'), table_name='pos_payment_intents')
    op.drop_index(op.f('ix_pos_payment_intents_bill_id'), table_name='pos_payment_intents')
    op.drop_index(op.f('ix_pos_payment_intents_terminal_id'), table_name='pos_payment_intents')
    op.drop_index(op.f('ix_pos_payment_intents_restaurant_id'), table_name='pos_payment_intents')
    op.drop_index(op.f('ix_pos_payment_intents_id'), table_name='pos_payment_intents')
    op.drop_table('pos_payment_intents')
    op.execute('DROP TYPE pospaymentstatus;')
