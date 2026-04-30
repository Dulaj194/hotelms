"""add room folio billing support

Revision ID: 20260402_0011
Revises: 20260402_0010
Create Date: 2026-04-02 15:45:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260402_0011"
down_revision = "20260402_0010"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def _unique_exists(bind, table_name: str, constraint_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(
        constraint["name"] == constraint_name
        for constraint in inspector.get_unique_constraints(table_name)
    )


def _foreign_key_exists(bind, table_name: str, constraint_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(
        foreign_key["name"] == constraint_name
        for foreign_key in inspector.get_foreign_keys(table_name)
    )


def _context_enum() -> sa.Enum:
    return sa.Enum("table", "room", name="billcontexttype", native_enum=False)


def _handoff_enum() -> sa.Enum:
    return sa.Enum(
        "none",
        "sent_to_cashier",
        "sent_to_accountant",
        "completed",
        name="billhandoffstatus",
        native_enum=False,
    )


def _payment_status_enum() -> sa.Enum:
    return sa.Enum("pending", "paid", name="billstatus", native_enum=False)


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "bills"):
        op.create_table(
            "bills",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("bill_number", sa.String(length=32), nullable=False),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("session_id", sa.String(length=64), nullable=False),
            sa.Column(
                "context_type",
                _context_enum(),
                nullable=False,
                server_default="table",
            ),
            sa.Column("table_number", sa.String(length=50), nullable=True),
            sa.Column("room_id", sa.Integer(), nullable=True),
            sa.Column("room_number", sa.String(length=50), nullable=True),
            sa.Column("subtotal_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("discount_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("payment_method", sa.String(length=50), nullable=True),
            sa.Column("payment_status", _payment_status_enum(), nullable=False, server_default="pending"),
            sa.Column("transaction_reference", sa.String(length=255), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column(
                "handoff_status",
                _handoff_enum(),
                nullable=False,
                server_default="none",
            ),
            sa.Column("sent_to_cashier_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("sent_to_accountant_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("handoff_completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="SET NULL"),
            sa.UniqueConstraint("bill_number", name="uq_bills_bill_number"),
            sa.UniqueConstraint("session_id", "restaurant_id", name="uq_bills_session_restaurant"),
        )
        op.create_index("ix_bills_bill_number", "bills", ["bill_number"], unique=False)
        op.create_index("ix_bills_restaurant_id", "bills", ["restaurant_id"], unique=False)
        op.create_index("ix_bills_session_id", "bills", ["session_id"], unique=False)
        op.create_index("ix_bills_context_type", "bills", ["context_type"], unique=False)
        op.create_index("ix_bills_room_id", "bills", ["room_id"], unique=False)
        op.create_index("ix_bills_payment_status", "bills", ["payment_status"], unique=False)
        op.create_index("ix_bills_handoff_status", "bills", ["handoff_status"], unique=False)
        return

    if _column_exists(bind, "bills", "table_number"):
        op.alter_column("bills", "table_number", existing_type=sa.String(length=50), nullable=True)

    if not _column_exists(bind, "bills", "context_type"):
        op.add_column(
            "bills",
            sa.Column(
                "context_type",
                _context_enum(),
                nullable=False,
                server_default="table",
            ),
        )

    if not _column_exists(bind, "bills", "room_id"):
        op.add_column("bills", sa.Column("room_id", sa.Integer(), nullable=True))
    if not _column_exists(bind, "bills", "room_number"):
        op.add_column("bills", sa.Column("room_number", sa.String(length=50), nullable=True))

    if not _column_exists(bind, "bills", "handoff_status"):
        op.add_column(
            "bills",
            sa.Column(
                "handoff_status",
                _handoff_enum(),
                nullable=False,
                server_default="none",
            ),
        )
    if not _column_exists(bind, "bills", "sent_to_cashier_at"):
        op.add_column("bills", sa.Column("sent_to_cashier_at", sa.DateTime(timezone=True), nullable=True))
    if not _column_exists(bind, "bills", "sent_to_accountant_at"):
        op.add_column("bills", sa.Column("sent_to_accountant_at", sa.DateTime(timezone=True), nullable=True))
    if not _column_exists(bind, "bills", "handoff_completed_at"):
        op.add_column("bills", sa.Column("handoff_completed_at", sa.DateTime(timezone=True), nullable=True))

    if not _foreign_key_exists(bind, "bills", "fk_bills_room_id_rooms"):
        op.create_foreign_key(
            "fk_bills_room_id_rooms",
            "bills",
            "rooms",
            ["room_id"],
            ["id"],
            ondelete="SET NULL",
        )

    if not _unique_exists(bind, "bills", "uq_bills_session_restaurant"):
        op.create_unique_constraint(
            "uq_bills_session_restaurant",
            "bills",
            ["session_id", "restaurant_id"],
        )

    for index_name, columns in (
        ("ix_bills_context_type", ["context_type"]),
        ("ix_bills_room_id", ["room_id"]),
        ("ix_bills_handoff_status", ["handoff_status"]),
    ):
        if not _index_exists(bind, "bills", index_name):
            op.create_index(index_name, "bills", columns, unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    if not _table_exists(bind, "bills"):
        return

    if _index_exists(bind, "bills", "ix_bills_handoff_status"):
        op.drop_index("ix_bills_handoff_status", table_name="bills")
    if _index_exists(bind, "bills", "ix_bills_room_id"):
        op.drop_index("ix_bills_room_id", table_name="bills")
    if _index_exists(bind, "bills", "ix_bills_context_type"):
        op.drop_index("ix_bills_context_type", table_name="bills")

    if _foreign_key_exists(bind, "bills", "fk_bills_room_id_rooms"):
        op.drop_constraint("fk_bills_room_id_rooms", "bills", type_="foreignkey")
    if _unique_exists(bind, "bills", "uq_bills_session_restaurant"):
        op.drop_constraint("uq_bills_session_restaurant", "bills", type_="unique")

    for column_name in (
        "handoff_completed_at",
        "sent_to_accountant_at",
        "sent_to_cashier_at",
        "handoff_status",
        "room_number",
        "room_id",
        "context_type",
    ):
        if _column_exists(bind, "bills", column_name):
            op.drop_column("bills", column_name)

    if _column_exists(bind, "bills", "table_number"):
        op.alter_column("bills", "table_number", existing_type=sa.String(length=50), nullable=False)
