"""add billing workflow dashboard fields and events

Revision ID: 20260403_0014
Revises: 20260402_0013
Create Date: 2026-04-03 00:15:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260403_0014"
down_revision = "20260402_0013"
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


def upgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "bills"):
      columns = _column_names(bind, "bills")
      indexes = _index_names(bind, "bills")

      if "cashier_status" not in columns:
          op.add_column(
              "bills",
              sa.Column(
                  "cashier_status",
                  sa.String(length=20),
                  nullable=False,
                  server_default="not_sent",
              ),
          )
      if "accountant_status" not in columns:
          op.add_column(
              "bills",
              sa.Column(
                  "accountant_status",
                  sa.String(length=20),
                  nullable=False,
                  server_default="not_sent",
              ),
          )
      if "printed_count" not in columns:
          op.add_column(
              "bills",
              sa.Column("printed_count", sa.Integer(), nullable=False, server_default="0"),
          )
      if "last_printed_at" not in columns:
          op.add_column("bills", sa.Column("last_printed_at", sa.DateTime(timezone=True), nullable=True))
      if "reopened_count" not in columns:
          op.add_column(
              "bills",
              sa.Column("reopened_count", sa.Integer(), nullable=False, server_default="0"),
          )

      indexes = _index_names(bind, "bills")
      if "ix_bills_cashier_status" not in indexes:
          op.create_index("ix_bills_cashier_status", "bills", ["cashier_status"], unique=False)
      if "ix_bills_accountant_status" not in indexes:
          op.create_index("ix_bills_accountant_status", "bills", ["accountant_status"], unique=False)

      bills = sa.table(
          "bills",
          sa.column("id", sa.Integer()),
          sa.column("handoff_status", sa.String(length=30)),
          sa.column("cashier_status", sa.String(length=20)),
          sa.column("accountant_status", sa.String(length=20)),
      )
      rows = bind.execute(
          sa.select(
              bills.c.id,
              bills.c.handoff_status,
              bills.c.cashier_status,
              bills.c.accountant_status,
          )
      ).mappings()
      for row in rows:
          handoff_status = (row["handoff_status"] or "none").strip()
          update_values: dict[str, object] = {}
          if handoff_status == "sent_to_cashier":
              update_values["cashier_status"] = "pending"
              update_values["accountant_status"] = "not_sent"
          elif handoff_status == "sent_to_accountant":
              update_values["cashier_status"] = "accepted"
              update_values["accountant_status"] = "pending"
          elif handoff_status == "completed":
              update_values["cashier_status"] = "accepted"
              update_values["accountant_status"] = "accepted"
          else:
              update_values["cashier_status"] = "not_sent"
              update_values["accountant_status"] = "not_sent"

          bind.execute(
              bills.update()
              .where(bills.c.id == row["id"])
              .values(**update_values)
          )

      with op.batch_alter_table("bills") as batch_op:
          batch_op.alter_column("cashier_status", server_default=None)
          batch_op.alter_column("accountant_status", server_default=None)
          batch_op.alter_column("printed_count", server_default=None)
          batch_op.alter_column("reopened_count", server_default=None)

    if not _table_exists(bind, "bill_workflow_events"):
        op.create_table(
            "bill_workflow_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("bill_id", sa.Integer(), sa.ForeignKey("bills.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "restaurant_id",
                sa.Integer(),
                sa.ForeignKey("restaurants.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("actor_role", sa.String(length=50), nullable=True),
            sa.Column("action_type", sa.String(length=80), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("metadata_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_bill_workflow_events_bill_id", "bill_workflow_events", ["bill_id"], unique=False)
        op.create_index(
            "ix_bill_workflow_events_restaurant_id",
            "bill_workflow_events",
            ["restaurant_id"],
            unique=False,
        )
        op.create_index("ix_bill_workflow_events_user_id", "bill_workflow_events", ["user_id"], unique=False)
        op.create_index(
            "ix_bill_workflow_events_action_type",
            "bill_workflow_events",
            ["action_type"],
            unique=False,
        )
        op.create_index(
            "ix_bill_workflow_events_created_at",
            "bill_workflow_events",
            ["created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "bill_workflow_events"):
        op.drop_index("ix_bill_workflow_events_created_at", table_name="bill_workflow_events")
        op.drop_index("ix_bill_workflow_events_action_type", table_name="bill_workflow_events")
        op.drop_index("ix_bill_workflow_events_user_id", table_name="bill_workflow_events")
        op.drop_index("ix_bill_workflow_events_restaurant_id", table_name="bill_workflow_events")
        op.drop_index("ix_bill_workflow_events_bill_id", table_name="bill_workflow_events")
        op.drop_table("bill_workflow_events")

    if _table_exists(bind, "bills"):
        indexes = _index_names(bind, "bills")
        columns = _column_names(bind, "bills")
        with op.batch_alter_table("bills") as batch_op:
            if "ix_bills_accountant_status" in indexes:
                batch_op.drop_index("ix_bills_accountant_status")
            if "ix_bills_cashier_status" in indexes:
                batch_op.drop_index("ix_bills_cashier_status")
            if "reopened_count" in columns:
                batch_op.drop_column("reopened_count")
            if "last_printed_at" in columns:
                batch_op.drop_column("last_printed_at")
            if "printed_count" in columns:
                batch_op.drop_column("printed_count")
            if "accountant_status" in columns:
                batch_op.drop_column("accountant_status")
            if "cashier_status" in columns:
                batch_op.drop_column("cashier_status")
