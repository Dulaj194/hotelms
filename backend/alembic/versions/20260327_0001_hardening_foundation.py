"""hardening foundation tables

Revision ID: 20260327_0001
Revises:
Create Date: 2026-03-27 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260327_0001"
down_revision = None
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    # Baseline bootstrap: create all currently registered ORM tables.
    # This makes the initial migration usable on a fresh database.
    import app.db.init_models  # noqa: F401
    from app.db.base import Base

    Base.metadata.create_all(bind=bind)

    if not _table_exists(bind, "settings_requests"):
        op.create_table(
            "settings_requests",
            sa.Column("request_id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("requested_by", sa.Integer(), nullable=False),
            sa.Column("requested_changes", sa.JSON(), nullable=False),
            sa.Column("current_settings", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="PENDING"),
            sa.Column("request_reason", sa.Text(), nullable=True),
            sa.Column("reviewed_by", sa.Integer(), nullable=True),
            sa.Column("review_notes", sa.Text(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
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
            sa.ForeignKeyConstraint(["requested_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        )
        op.create_index(
            "ix_settings_requests_restaurant_id",
            "settings_requests",
            ["restaurant_id"],
            unique=False,
        )

    if not _table_exists(bind, "dashboard_alert_impressions"):
        op.create_table(
            "dashboard_alert_impressions",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("alert_key", sa.String(length=100), nullable=False),
            sa.Column("alert_level", sa.String(length=20), nullable=False),
            sa.Column("shown_date", sa.Date(), nullable=False),
            sa.Column(
                "last_shown_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column("dismissed_until", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
            sa.UniqueConstraint(
                "restaurant_id",
                "alert_key",
                "shown_date",
                name="uq_alert_restaurant_day",
            ),
        )
        op.create_index(
            "ix_dashboard_alert_impressions_restaurant_id",
            "dashboard_alert_impressions",
            ["restaurant_id"],
            unique=False,
        )

    if not _table_exists(bind, "dashboard_setup_progress"):
        op.create_table(
            "dashboard_setup_progress",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("current_step", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("completed_keys_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("restaurant_id", name="uq_dashboard_setup_progress_restaurant_id"),
        )
        op.create_index(
            "ix_dashboard_setup_progress_restaurant_id",
            "dashboard_setup_progress",
            ["restaurant_id"],
            unique=True,
        )

    if not _table_exists(bind, "housekeeping_checklist_items"):
        op.create_table(
            "housekeeping_checklist_items",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("request_id", sa.Integer(), nullable=False),
            sa.Column("item_code", sa.String(length=50), nullable=False),
            sa.Column("label", sa.String(length=255), nullable=False),
            sa.Column("is_mandatory", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_by_user_id", sa.Integer(), nullable=True),
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
            sa.ForeignKeyConstraint(
                ["request_id"], ["housekeeping_requests.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(["completed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        )
        op.create_index(
            "ix_housekeeping_checklist_items_request_id",
            "housekeeping_checklist_items",
            ["request_id"],
            unique=False,
        )

    if not _table_exists(bind, "housekeeping_maintenance_tickets"):
        op.create_table(
            "housekeeping_maintenance_tickets",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("request_id", sa.Integer(), nullable=False),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("room_id", sa.Integer(), nullable=False),
            sa.Column("issue_type", sa.String(length=100), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("photo_proof_url", sa.String(length=500), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("resolved_by_user_id", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(
                ["request_id"], ["housekeeping_requests.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["resolved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        )
        op.create_index(
            "ix_housekeeping_maintenance_tickets_request_id",
            "housekeeping_maintenance_tickets",
            ["request_id"],
            unique=False,
        )

    if not _table_exists(bind, "housekeeping_event_logs"):
        op.create_table(
            "housekeeping_event_logs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("request_id", sa.Integer(), nullable=False),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("actor_user_id", sa.Integer(), nullable=True),
            sa.Column("event_type", sa.String(length=60), nullable=False),
            sa.Column("from_status", sa.String(length=32), nullable=True),
            sa.Column("to_status", sa.String(length=32), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(
                ["request_id"], ["housekeeping_requests.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        )
        op.create_index(
            "ix_housekeeping_event_logs_request_id",
            "housekeeping_event_logs",
            ["request_id"],
            unique=False,
        )

    if not _table_exists(bind, "reports_history"):
        op.create_table(
            "reports_history",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("generated_by_user_id", sa.Integer(), nullable=True),
            sa.Column("report_type", sa.String(length=100), nullable=False),
            sa.Column("output_format", sa.String(length=20), nullable=False, server_default="json"),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="generated"),
            sa.Column("file_url", sa.String(length=500), nullable=True),
            sa.Column("report_params_json", sa.Text(), nullable=True),
            sa.Column("report_data_json", sa.Text(), nullable=True),
            sa.Column(
                "generated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["generated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        )
        op.create_index(
            "ix_reports_history_restaurant_id",
            "reports_history",
            ["restaurant_id"],
            unique=False,
        )
        op.create_index(
            "ix_reports_history_generated_at",
            "reports_history",
            ["generated_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()

    for table_name in (
        "reports_history",
        "housekeeping_event_logs",
        "housekeeping_maintenance_tickets",
        "housekeeping_checklist_items",
        "dashboard_setup_progress",
        "dashboard_alert_impressions",
        "settings_requests",
    ):
        if _table_exists(bind, table_name):
            op.drop_table(table_name)
