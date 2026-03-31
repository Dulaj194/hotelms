"""Initial migration - create all tables

Revision ID: 001
Revises:
Create Date: 2026-03-30

"""
from alembic import op
import sqlalchemy as sa
import enum

# revision identifiers:
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # super_admin_tbl
    op.create_table(
        'super_admin_tbl',
        sa.Column('super_admin_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('super_admin_id'),
        sa.UniqueConstraint('email')
    )
    op.create_index('ix_super_admin_tbl_is_active', 'super_admin_tbl', ['is_active'], unique=False)
    op.create_index('ix_super_admin_tbl_email', 'super_admin_tbl', ['email'], unique=False)

    # restaurant_tbl
    op.create_table(
        'restaurant_tbl',
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('restaurant_name', sa.String(length=255), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('contact_number', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('logo', sa.String(length=255), nullable=True),
        sa.Column('password', sa.String(length=255), nullable=False),
        sa.Column('opening_time', sa.String(length=8), nullable=True),
        sa.Column('closing_time', sa.String(length=8), nullable=True),
        sa.Column('subscription_status', sa.Enum('trial', 'active', 'paused', 'expired', 'cancelled', name='subscriptionstatus'), nullable=True),
        sa.Column('subscription_start_date', sa.DateTime(), nullable=True),
        sa.Column('subscription_expiry_date', sa.DateTime(), nullable=True),
        sa.Column('currency_code', sa.String(length=3), nullable=True),
        sa.Column('currency_symbol', sa.String(length=5), nullable=True),
        sa.Column('timezone', sa.String(length=50), nullable=True),
        sa.Column('country_code', sa.String(length=2), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('restaurant_id'),
        sa.UniqueConstraint('email')
    )
    op.create_index('ix_restaurant_tbl_email', 'restaurant_tbl', ['email'], unique=False)
    op.create_index('ix_restaurant_tbl_subscription_status', 'restaurant_tbl', ['subscription_status'], unique=False)
    op.create_index('ix_restaurant_tbl_is_active', 'restaurant_tbl', ['is_active'], unique=False)
    op.create_index('ix_restaurant_tbl_created_at', 'restaurant_tbl', ['created_at'], unique=False)

    # admin_tbl
    op.create_table(
        'admin_tbl',
        sa.Column('admin_id', sa.Integer(), nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('role', sa.Enum('owner', 'admin', 'steward', 'housekeeper', name='adminrole'), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurant_tbl.restaurant_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('admin_id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('restaurant_id', 'email', name='uq_restaurant_email')
    )
    op.create_index('ix_admin_tbl_restaurant_id', 'admin_tbl', ['restaurant_id'], unique=False)
    op.create_index('ix_admin_tbl_role', 'admin_tbl', ['role'], unique=False)
    op.create_index('ix_admin_tbl_is_active', 'admin_tbl', ['is_active'], unique=False)

    # field_definitions_tbl
    op.create_table(
        'field_definitions_tbl',
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('field_name', sa.String(length=100), nullable=False),
        sa.Column('field_label', sa.String(length=100), nullable=False),
        sa.Column('field_type', sa.String(length=20), nullable=False),
        sa.Column('is_sensitive', sa.Boolean(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('default_requirement', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('field_id'),
        sa.UniqueConstraint('entity_type', 'field_name', name='uq_entity_field')
    )
    op.create_index('ix_field_definitions_tbl_entity_type', 'field_definitions_tbl', ['entity_type'], unique=False)
    op.create_index('ix_field_definitions_tbl_is_sensitive', 'field_definitions_tbl', ['is_sensitive'], unique=False)

    # role_field_permissions_tbl
    op.create_table(
        'role_field_permissions_tbl',
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.String(length=50), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('field_name', sa.String(length=100), nullable=False),
        sa.Column('access_level', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('permission_id'),
        sa.UniqueConstraint('role_id', 'entity_type', 'field_name', name='uq_role_entity_field')
    )
    op.create_index('ix_role_field_permissions_tbl_role_id', 'role_field_permissions_tbl', ['role_id'], unique=False)
    op.create_index('ix_role_field_permissions_tbl_entity_type', 'role_field_permissions_tbl', ['entity_type'], unique=False)
    op.create_index('ix_role_field_permissions_tbl_access_level', 'role_field_permissions_tbl', ['access_level'], unique=False)

    # audit_log
    op.create_table(
        'audit_log',
        sa.Column('audit_id', sa.Integer(), nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=True),
        sa.Column('actor_id', sa.Integer(), nullable=False),
        sa.Column('actor_role', sa.String(length=50), nullable=False),
        sa.Column('actor_ip', sa.String(length=45), nullable=True),
        sa.Column('actor_user_agent', sa.String(length=500), nullable=True),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('field_name', sa.String(length=100), nullable=True),
        sa.Column('old_value', sa.Text(), nullable=True),
        sa.Column('new_value', sa.Text(), nullable=True),
        sa.Column('request_id', sa.String(length=50), nullable=True),
        sa.Column('changed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurant_tbl.restaurant_id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('audit_id')
    )
    op.create_index('ix_audit_log_restaurant_id_changed_at', 'audit_log', ['restaurant_id', 'changed_at'], unique=False)
    op.create_index('ix_audit_log_actor_id_changed_at', 'audit_log', ['actor_id', 'changed_at'], unique=False)
    op.create_index('ix_audit_log_entity_type_entity_id_changed_at', 'audit_log', ['entity_type', 'entity_id', 'changed_at'], unique=False)
    op.create_index('ix_audit_log_request_id', 'audit_log', ['request_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_audit_log_request_id', table_name='audit_log')
    op.drop_index('ix_audit_log_entity_type_entity_id_changed_at', table_name='audit_log')
    op.drop_index('ix_audit_log_actor_id_changed_at', table_name='audit_log')
    op.drop_index('ix_audit_log_restaurant_id_changed_at', table_name='audit_log')
    op.drop_table('audit_log')

    op.drop_index('ix_role_field_permissions_tbl_access_level', table_name='role_field_permissions_tbl')
    op.drop_index('ix_role_field_permissions_tbl_entity_type', table_name='role_field_permissions_tbl')
    op.drop_index('ix_role_field_permissions_tbl_role_id', table_name='role_field_permissions_tbl')
    op.drop_table('role_field_permissions_tbl')

    op.drop_index('ix_field_definitions_tbl_is_sensitive', table_name='field_definitions_tbl')
    op.drop_index('ix_field_definitions_tbl_entity_type', table_name='field_definitions_tbl')
    op.drop_table('field_definitions_tbl')

    op.drop_index('ix_admin_tbl_is_active', table_name='admin_tbl')
    op.drop_index('ix_admin_tbl_role', table_name='admin_tbl')
    op.drop_index('ix_admin_tbl_restaurant_id', table_name='admin_tbl')
    op.drop_table('admin_tbl')

    op.drop_index('ix_restaurant_tbl_created_at', table_name='restaurant_tbl')
    op.drop_index('ix_restaurant_tbl_is_active', table_name='restaurant_tbl')
    op.drop_index('ix_restaurant_tbl_subscription_status', table_name='restaurant_tbl')
    op.drop_index('ix_restaurant_tbl_email', table_name='restaurant_tbl')
    op.drop_table('restaurant_tbl')

    op.drop_index('ix_super_admin_tbl_email', table_name='super_admin_tbl')
    op.drop_index('ix_super_admin_tbl_is_active', table_name='super_admin_tbl')
    op.drop_table('super_admin_tbl')
