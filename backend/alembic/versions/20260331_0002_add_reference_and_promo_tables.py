"""add reference data and promo code tables

Revision ID: 20260331_0002
Revises: 20260327_0001
Create Date: 2026-03-31 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260331_0002"
down_revision = "20260327_0001"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "countries"):
        op.create_table(
            "countries",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("iso2", sa.String(length=2), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.UniqueConstraint("name", name="uq_countries_name"),
        )
        op.create_index("ix_countries_id", "countries", ["id"], unique=False)
        op.create_index("ix_countries_name", "countries", ["name"], unique=False)

    if not _table_exists(bind, "currency_types"):
        op.create_table(
            "currency_types",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(length=12), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("symbol", sa.String(length=8), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.UniqueConstraint("code", name="uq_currency_types_code"),
        )
        op.create_index("ix_currency_types_id", "currency_types", ["id"], unique=False)
        op.create_index("ix_currency_types_code", "currency_types", ["code"], unique=False)

    if not _table_exists(bind, "promo_codes"):
        op.create_table(
            "promo_codes",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(length=50), nullable=False),
            sa.Column("discount_percent", sa.Numeric(precision=5, scale=2), nullable=False),
            sa.Column("valid_from", sa.Date(), nullable=False),
            sa.Column("valid_until", sa.Date(), nullable=False),
            sa.Column("usage_limit", sa.Integer(), nullable=True),
            sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.UniqueConstraint("code", name="uq_promo_codes_code"),
        )
        op.create_index("ix_promo_codes_id", "promo_codes", ["id"], unique=False)
        op.create_index("ix_promo_codes_code", "promo_codes", ["code"], unique=False)

    if not _table_exists(bind, "promo_code_usages"):
        op.create_table(
            "promo_code_usages",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("promo_code_id", sa.Integer(), nullable=False),
            sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["promo_code_id"], ["promo_codes.id"], ondelete="CASCADE"),
            sa.UniqueConstraint(
                "restaurant_id",
                "promo_code_id",
                name="uq_promo_code_usages_restaurant_code",
            ),
        )
        op.create_index(
            "ix_promo_code_usages_id",
            "promo_code_usages",
            ["id"],
            unique=False,
        )
        op.create_index(
            "ix_promo_code_usages_restaurant_id",
            "promo_code_usages",
            ["restaurant_id"],
            unique=False,
        )
        op.create_index(
            "ix_promo_code_usages_promo_code_id",
            "promo_code_usages",
            ["promo_code_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "promo_code_usages"):
        op.drop_table("promo_code_usages")
    if _table_exists(bind, "promo_codes"):
        op.drop_table("promo_codes")
    if _table_exists(bind, "currency_types"):
        op.drop_table("currency_types")
    if _table_exists(bind, "countries"):
        op.drop_table("countries")
