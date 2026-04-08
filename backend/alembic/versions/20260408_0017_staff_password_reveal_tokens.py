"""add one-time staff password reveal tokens

Revision ID: 20260408_0017
Revises: 20260408_0016
Create Date: 2026-04-08 20:05:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260408_0017"
down_revision = "20260408_0016"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "restaurant_password_reveal_tokens"):
        return

    op.create_table(
        "restaurant_password_reveal_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("restaurant_id", sa.Integer(), nullable=False),
        sa.Column("target_user_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("temporary_password_ciphertext", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("token_hash", name="uq_restaurant_password_reveal_tokens_token_hash"),
    )
    op.create_index(
        "ix_restaurant_password_reveal_tokens_restaurant_id",
        "restaurant_password_reveal_tokens",
        ["restaurant_id"],
        unique=False,
    )
    op.create_index(
        "ix_restaurant_password_reveal_tokens_target_user_id",
        "restaurant_password_reveal_tokens",
        ["target_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_restaurant_password_reveal_tokens_created_by_user_id",
        "restaurant_password_reveal_tokens",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_restaurant_password_reveal_tokens_token_hash",
        "restaurant_password_reveal_tokens",
        ["token_hash"],
        unique=True,
    )


def downgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "restaurant_password_reveal_tokens"):
        return

    op.drop_index(
        "ix_restaurant_password_reveal_tokens_token_hash",
        table_name="restaurant_password_reveal_tokens",
    )
    op.drop_index(
        "ix_restaurant_password_reveal_tokens_created_by_user_id",
        table_name="restaurant_password_reveal_tokens",
    )
    op.drop_index(
        "ix_restaurant_password_reveal_tokens_target_user_id",
        table_name="restaurant_password_reveal_tokens",
    )
    op.drop_index(
        "ix_restaurant_password_reveal_tokens_restaurant_id",
        table_name="restaurant_password_reveal_tokens",
    )
    op.drop_table("restaurant_password_reveal_tokens")
