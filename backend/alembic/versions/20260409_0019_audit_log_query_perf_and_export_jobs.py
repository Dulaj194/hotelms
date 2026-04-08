"""audit log query perf columns and async export jobs

Revision ID: 20260409_0019
Revises: 20260408_0018
Create Date: 2026-04-09 10:20:00
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "20260409_0019"
down_revision = "20260408_0018"
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


def _safe_int(value: object) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def upgrade() -> None:
    from app.modules.audit_logs import catalog

    bind = op.get_bind()

    if _table_exists(bind, "audit_logs"):
        audit_columns = _column_names(bind, "audit_logs")

        if "category" not in audit_columns:
            op.add_column(
                "audit_logs",
                sa.Column("category", sa.String(length=50), nullable=True),
            )

        if "severity" not in audit_columns:
            op.add_column(
                "audit_logs",
                sa.Column("severity", sa.String(length=20), nullable=True),
            )

        if "metadata_restaurant_id" not in audit_columns:
            op.add_column(
                "audit_logs",
                sa.Column("metadata_restaurant_id", sa.Integer(), nullable=True),
            )

        audit_indexes = _index_names(bind, "audit_logs")
        if "ix_audit_logs_category" not in audit_indexes:
            op.create_index("ix_audit_logs_category", "audit_logs", ["category"], unique=False)
        if "ix_audit_logs_severity" not in audit_indexes:
            op.create_index("ix_audit_logs_severity", "audit_logs", ["severity"], unique=False)
        if "ix_audit_logs_metadata_restaurant_id" not in audit_indexes:
            op.create_index(
                "ix_audit_logs_metadata_restaurant_id",
                "audit_logs",
                ["metadata_restaurant_id"],
                unique=False,
            )
        if "ix_audit_logs_created_at" not in audit_indexes:
            op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"], unique=False)
        if "ix_audit_logs_restaurant_id_created_at" not in audit_indexes:
            op.create_index(
                "ix_audit_logs_restaurant_id_created_at",
                "audit_logs",
                ["restaurant_id", "created_at"],
                unique=False,
            )
        if "ix_audit_logs_severity_created_at" not in audit_indexes:
            op.create_index(
                "ix_audit_logs_severity_created_at",
                "audit_logs",
                ["severity", "created_at"],
                unique=False,
            )

        select_stmt = sa.text(
            """
            SELECT id, event_type, metadata_json, restaurant_id, category, severity, metadata_restaurant_id
            FROM audit_logs
            WHERE category IS NULL OR severity IS NULL OR metadata_restaurant_id IS NULL
            """
        )
        update_stmt = sa.text(
            """
            UPDATE audit_logs
            SET category = :category,
                severity = :severity,
                metadata_restaurant_id = :metadata_restaurant_id
            WHERE id = :id
            """
        )

        cursor = bind.execute(select_stmt)
        while True:
            rows = cursor.fetchmany(1000)
            if not rows:
                break

            updates: list[dict[str, object]] = []
            for row in rows:
                metadata: dict[str, object] = {}
                if row.metadata_json:
                    try:
                        parsed = json.loads(row.metadata_json)
                        if isinstance(parsed, dict):
                            metadata = parsed
                    except Exception:
                        metadata = {}

                metadata_restaurant_id = row.metadata_restaurant_id
                if metadata_restaurant_id is None:
                    metadata_restaurant_id = _safe_int(metadata.get("restaurant_id"))

                updates.append(
                    {
                        "id": row.id,
                        "category": row.category or catalog.get_event_category(row.event_type),
                        "severity": row.severity
                        or catalog.get_event_severity(row.event_type, metadata),
                        "metadata_restaurant_id": metadata_restaurant_id,
                    }
                )

            if updates:
                bind.execute(update_stmt, updates)

        op.alter_column(
            "audit_logs",
            "category",
            existing_type=sa.String(length=50),
            nullable=False,
            server_default="operations",
        )
        op.alter_column(
            "audit_logs",
            "severity",
            existing_type=sa.String(length=20),
            nullable=False,
            server_default="info",
        )

    if not _table_exists(bind, "audit_log_export_jobs"):
        op.create_table(
            "audit_log_export_jobs",
            sa.Column("id", sa.String(length=64), nullable=False),
            sa.Column("requested_by_user_id", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("filters_json", sa.Text(), nullable=True),
            sa.Column("file_path", sa.String(length=1000), nullable=True),
            sa.Column("row_count", sa.Integer(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_audit_log_export_jobs_requested_by_user_id",
            "audit_log_export_jobs",
            ["requested_by_user_id"],
            unique=False,
        )
        op.create_index(
            "ix_audit_log_export_jobs_status",
            "audit_log_export_jobs",
            ["status"],
            unique=False,
        )
        op.create_index(
            "ix_audit_log_export_jobs_created_at",
            "audit_log_export_jobs",
            ["created_at"],
            unique=False,
        )
        op.create_index(
            "ix_audit_log_export_jobs_expires_at",
            "audit_log_export_jobs",
            ["expires_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "audit_log_export_jobs"):
        export_indexes = _index_names(bind, "audit_log_export_jobs")
        if "ix_audit_log_export_jobs_expires_at" in export_indexes:
            op.drop_index("ix_audit_log_export_jobs_expires_at", table_name="audit_log_export_jobs")
        if "ix_audit_log_export_jobs_created_at" in export_indexes:
            op.drop_index("ix_audit_log_export_jobs_created_at", table_name="audit_log_export_jobs")
        if "ix_audit_log_export_jobs_status" in export_indexes:
            op.drop_index("ix_audit_log_export_jobs_status", table_name="audit_log_export_jobs")
        if "ix_audit_log_export_jobs_requested_by_user_id" in export_indexes:
            op.drop_index(
                "ix_audit_log_export_jobs_requested_by_user_id",
                table_name="audit_log_export_jobs",
            )
        op.drop_table("audit_log_export_jobs")

    if _table_exists(bind, "audit_logs"):
        audit_indexes = _index_names(bind, "audit_logs")
        if "ix_audit_logs_severity_created_at" in audit_indexes:
            op.drop_index("ix_audit_logs_severity_created_at", table_name="audit_logs")
        if "ix_audit_logs_restaurant_id_created_at" in audit_indexes:
            op.drop_index("ix_audit_logs_restaurant_id_created_at", table_name="audit_logs")
        if "ix_audit_logs_metadata_restaurant_id" in audit_indexes:
            op.drop_index("ix_audit_logs_metadata_restaurant_id", table_name="audit_logs")
        if "ix_audit_logs_severity" in audit_indexes:
            op.drop_index("ix_audit_logs_severity", table_name="audit_logs")
        if "ix_audit_logs_category" in audit_indexes:
            op.drop_index("ix_audit_logs_category", table_name="audit_logs")

        audit_columns = _column_names(bind, "audit_logs")
        if "metadata_restaurant_id" in audit_columns:
            op.drop_column("audit_logs", "metadata_restaurant_id")
        if "severity" in audit_columns:
            op.drop_column("audit_logs", "severity")
        if "category" in audit_columns:
            op.drop_column("audit_logs", "category")
