"""harden billing paid lifecycle with split payments and idempotency

Revision ID: 20260419_0024
Revises: 20260416_0023
Create Date: 2026-04-19 11:40:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260419_0024"
down_revision = "20260416_0023"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_names(bind, table_name: str) -> set[str]:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _index_names(bind, table_name: str) -> set[str]:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {index["name"] for index in inspector.get_indexes(table_name)}


def _upgrade_mysql_enums(bind) -> None:
    if bind.dialect.name != "mysql":
        return

    if _table_exists(bind, "bills"):
        op.execute(
            """
            ALTER TABLE bills
            MODIFY COLUMN payment_status ENUM(
                'pending',
                'partially_paid',
                'paid',
                'refunded',
                'voided',
                'reversed'
            ) NOT NULL
            """
        )

    if _table_exists(bind, "payments"):
        op.execute(
            """
            ALTER TABLE payments
            MODIFY COLUMN payment_status ENUM(
                'pending',
                'paid',
                'failed',
                'refunded',
                'voided',
                'reversed'
            ) NOT NULL
            """
        )


def _downgrade_mysql_enums(bind) -> None:
    if bind.dialect.name != "mysql":
        return

    if _table_exists(bind, "payments"):
        op.execute(
            """
            ALTER TABLE payments
            MODIFY COLUMN payment_status ENUM(
                'pending',
                'paid',
                'failed'
            ) NOT NULL
            """
        )

    if _table_exists(bind, "bills"):
        op.execute(
            """
            ALTER TABLE bills
            MODIFY COLUMN payment_status ENUM(
                'pending',
                'paid'
            ) NOT NULL
            """
        )


def upgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "bills"):
        columns = _column_names(bind, "bills")
        if "reversed_at" not in columns:
            op.add_column("bills", sa.Column("reversed_at", sa.DateTime(timezone=True), nullable=True))
        if "reversal_reason" not in columns:
            op.add_column("bills", sa.Column("reversal_reason", sa.Text(), nullable=True))

    if not _table_exists(bind, "bill_payment_allocations"):
        op.create_table(
            "bill_payment_allocations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("bill_id", sa.Integer(), sa.ForeignKey("bills.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "restaurant_id",
                sa.Integer(),
                sa.ForeignKey("restaurants.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("payment_method", sa.String(length=50), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("transaction_reference", sa.String(length=255), nullable=True),
            sa.Column("gateway_provider", sa.String(length=50), nullable=True),
            sa.Column("gateway_payment_intent_id", sa.String(length=255), nullable=True),
            sa.Column(
                "allocation_status",
                sa.String(length=20),
                nullable=False,
                server_default="captured",
            ),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_bill_payment_allocations_bill_id", "bill_payment_allocations", ["bill_id"], unique=False)
        op.create_index(
            "ix_bill_payment_allocations_restaurant_id",
            "bill_payment_allocations",
            ["restaurant_id"],
            unique=False,
        )
        op.create_index(
            "ix_bill_payment_allocations_gateway_payment_intent_id",
            "bill_payment_allocations",
            ["gateway_payment_intent_id"],
            unique=False,
        )
        op.create_index(
            "ix_bill_payment_allocations_allocation_status",
            "bill_payment_allocations",
            ["allocation_status"],
            unique=False,
        )

    if not _table_exists(bind, "bill_settle_idempotency_keys"):
        op.create_table(
            "bill_settle_idempotency_keys",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "restaurant_id",
                sa.Integer(),
                sa.ForeignKey("restaurants.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("operation", sa.String(length=32), nullable=False, server_default="settle"),
            sa.Column("idempotency_key", sa.String(length=120), nullable=False),
            sa.Column("context_type", sa.String(length=20), nullable=False),
            sa.Column("context_lookup", sa.String(length=64), nullable=False),
            sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
            sa.Column("settle_status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("bill_id", sa.Integer(), sa.ForeignKey("bills.id", ondelete="SET NULL"), nullable=True),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint(
                "restaurant_id",
                "operation",
                "idempotency_key",
                name="uq_bill_settle_idempotency",
            ),
        )
        op.create_index(
            "ix_bill_settle_idempotency_keys_restaurant_id",
            "bill_settle_idempotency_keys",
            ["restaurant_id"],
            unique=False,
        )
        op.create_index(
            "ix_bill_settle_idempotency_keys_idempotency_key",
            "bill_settle_idempotency_keys",
            ["idempotency_key"],
            unique=False,
        )
        op.create_index(
            "ix_bill_settle_idempotency_keys_bill_id",
            "bill_settle_idempotency_keys",
            ["bill_id"],
            unique=False,
        )
        op.create_index(
            "ix_bill_settle_idempotency_keys_settle_status",
            "bill_settle_idempotency_keys",
            ["settle_status"],
            unique=False,
        )

    _upgrade_mysql_enums(bind)


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "bill_settle_idempotency_keys"):
        op.drop_index("ix_bill_settle_idempotency_keys_settle_status", table_name="bill_settle_idempotency_keys")
        op.drop_index("ix_bill_settle_idempotency_keys_bill_id", table_name="bill_settle_idempotency_keys")
        op.drop_index("ix_bill_settle_idempotency_keys_idempotency_key", table_name="bill_settle_idempotency_keys")
        op.drop_index("ix_bill_settle_idempotency_keys_restaurant_id", table_name="bill_settle_idempotency_keys")
        op.drop_table("bill_settle_idempotency_keys")

    if _table_exists(bind, "bill_payment_allocations"):
        op.drop_index("ix_bill_payment_allocations_allocation_status", table_name="bill_payment_allocations")
        op.drop_index(
            "ix_bill_payment_allocations_gateway_payment_intent_id",
            table_name="bill_payment_allocations",
        )
        op.drop_index("ix_bill_payment_allocations_restaurant_id", table_name="bill_payment_allocations")
        op.drop_index("ix_bill_payment_allocations_bill_id", table_name="bill_payment_allocations")
        op.drop_table("bill_payment_allocations")

    if _table_exists(bind, "bills"):
        columns = _column_names(bind, "bills")
        with op.batch_alter_table("bills") as batch_op:
            if "reversal_reason" in columns:
                batch_op.drop_column("reversal_reason")
            if "reversed_at" in columns:
                batch_op.drop_column("reversed_at")

    _downgrade_mysql_enums(bind)
