"""add restaurant registration review lifecycle

Revision ID: 20260401_0004
Revises: 20260331_0003
Create Date: 2026-04-01 12:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260401_0004"
down_revision = "20260331_0003"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "restaurants"):
        return

    if not _column_exists(bind, "restaurants", "registration_status"):
        op.add_column(
            "restaurants",
            sa.Column(
                "registration_status",
                sa.String(length=20),
                nullable=False,
                server_default="APPROVED",
            ),
        )

    if not _column_exists(bind, "restaurants", "registration_reviewed_by_id"):
        op.add_column(
            "restaurants",
            sa.Column("registration_reviewed_by_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_restaurants_registration_reviewed_by_id_users",
            "restaurants",
            "users",
            ["registration_reviewed_by_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(
            "ix_restaurants_registration_reviewed_by_id",
            "restaurants",
            ["registration_reviewed_by_id"],
            unique=False,
        )

    if not _column_exists(bind, "restaurants", "registration_review_notes"):
        op.add_column(
            "restaurants",
            sa.Column("registration_review_notes", sa.Text(), nullable=True),
        )

    if not _column_exists(bind, "restaurants", "registration_reviewed_at"):
        op.add_column(
            "restaurants",
            sa.Column("registration_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        )

    op.execute(
        sa.text(
            """
            UPDATE restaurants
            SET registration_status = 'APPROVED'
            WHERE registration_status IS NULL OR registration_status = ''
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "restaurants"):
        return

    if _column_exists(bind, "restaurants", "registration_reviewed_at"):
        op.drop_column("restaurants", "registration_reviewed_at")

    if _column_exists(bind, "restaurants", "registration_review_notes"):
        op.drop_column("restaurants", "registration_review_notes")

    if _column_exists(bind, "restaurants", "registration_reviewed_by_id"):
        inspector = sa.inspect(bind)
        foreign_keys = inspector.get_foreign_keys("restaurants")
        if any(fk.get("name") == "fk_restaurants_registration_reviewed_by_id_users" for fk in foreign_keys):
            op.drop_constraint(
                "fk_restaurants_registration_reviewed_by_id_users",
                "restaurants",
                type_="foreignkey",
            )
        indexes = {index["name"] for index in inspector.get_indexes("restaurants")}
        if "ix_restaurants_registration_reviewed_by_id" in indexes:
            op.drop_index("ix_restaurants_registration_reviewed_by_id", table_name="restaurants")
        op.drop_column("restaurants", "registration_reviewed_by_id")

    if _column_exists(bind, "restaurants", "registration_status"):
        op.drop_column("restaurants", "registration_status")
