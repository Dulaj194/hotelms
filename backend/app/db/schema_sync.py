from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine


def _column_exists(conn: Connection, table_name: str, column_name: str) -> bool:
    query = text(
        """
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :table_name
          AND COLUMN_NAME = :column_name
        LIMIT 1
        """
    )
    row = conn.execute(
        query,
        {"table_name": table_name, "column_name": column_name},
    ).first()
    return row is not None


def ensure_development_schema_compatibility(engine: Engine, logger) -> None:
    """Patch critical missing columns in legacy development databases.

    This is intentionally narrow and only applies low-risk additive changes
    needed for backward compatibility when model columns were introduced after
    the initial table creation.
    """
    order_header_column_patches: Sequence[tuple[str, str]] = (
        (
            "order_source",
            "ALTER TABLE order_headers ADD COLUMN order_source VARCHAR(20) NOT NULL DEFAULT 'table'",
        ),
        (
            "room_id",
            "ALTER TABLE order_headers ADD COLUMN room_id INT NULL",
        ),
        (
            "room_number",
            "ALTER TABLE order_headers ADD COLUMN room_number VARCHAR(50) NULL",
        ),
        (
            "customer_name",
            "ALTER TABLE order_headers ADD COLUMN customer_name VARCHAR(255) NULL",
        ),
        (
            "customer_phone",
            "ALTER TABLE order_headers ADD COLUMN customer_phone VARCHAR(50) NULL",
        ),
    )

    user_column_patches: Sequence[tuple[str, str]] = (
        (
            "username",
            "ALTER TABLE users ADD COLUMN username VARCHAR(64) NULL UNIQUE",
        ),
        (
            "phone",
            "ALTER TABLE users ADD COLUMN phone VARCHAR(32) NULL UNIQUE",
        ),
        (
            "assigned_area",
            "ALTER TABLE users ADD COLUMN assigned_area VARCHAR(32) NULL",
        ),
        (
            "must_change_password",
            "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
        ),
        (
            "password_changed_at",
            "ALTER TABLE users ADD COLUMN password_changed_at DATETIME NULL",
        ),
    )

    restaurant_column_patches: Sequence[tuple[str, str]] = (
        (
            "country_id",
            "ALTER TABLE restaurants ADD COLUMN country_id INT NULL",
        ),
        (
            "currency_id",
            "ALTER TABLE restaurants ADD COLUMN currency_id INT NULL",
        ),
        (
            "country",
            "ALTER TABLE restaurants ADD COLUMN country VARCHAR(120) NULL",
        ),
        (
            "currency",
            "ALTER TABLE restaurants ADD COLUMN currency VARCHAR(12) NULL",
        ),
        (
            "billing_email",
            "ALTER TABLE restaurants ADD COLUMN billing_email VARCHAR(191) NULL",
        ),
        (
            "tax_id",
            "ALTER TABLE restaurants ADD COLUMN tax_id VARCHAR(100) NULL",
        ),
        (
            "opening_time",
            "ALTER TABLE restaurants ADD COLUMN opening_time VARCHAR(8) NULL",
        ),
        (
            "closing_time",
            "ALTER TABLE restaurants ADD COLUMN closing_time VARCHAR(8) NULL",
        ),
    )

    category_column_patches: Sequence[tuple[str, str]] = (
        (
            "menu_id",
            "ALTER TABLE categories ADD COLUMN menu_id INT NULL",
        ),
    )

    item_column_patches: Sequence[tuple[str, str]] = (
        (
            "subcategory_id",
            "ALTER TABLE items ADD COLUMN subcategory_id INT NULL",
        ),
        (
            "more_details",
            "ALTER TABLE items ADD COLUMN more_details TEXT NULL",
        ),
        (
            "currency",
            "ALTER TABLE items ADD COLUMN currency VARCHAR(12) NOT NULL DEFAULT 'LKR'",
        ),
        (
            "image_path_2",
            "ALTER TABLE items ADD COLUMN image_path_2 VARCHAR(500) NULL",
        ),
        (
            "image_path_3",
            "ALTER TABLE items ADD COLUMN image_path_3 VARCHAR(500) NULL",
        ),
        (
            "image_path_4",
            "ALTER TABLE items ADD COLUMN image_path_4 VARCHAR(500) NULL",
        ),
        (
            "image_path_5",
            "ALTER TABLE items ADD COLUMN image_path_5 VARCHAR(500) NULL",
        ),
        (
            "video_path",
            "ALTER TABLE items ADD COLUMN video_path VARCHAR(500) NULL",
        ),
        (
            "blog_link",
            "ALTER TABLE items ADD COLUMN blog_link VARCHAR(1000) NULL",
        ),
    )

    housekeeping_column_patches: Sequence[tuple[str, str]] = (
        (
            "requested_for_at",
            "ALTER TABLE housekeeping_requests ADD COLUMN requested_for_at DATETIME NULL",
        ),
        (
            "audio_url",
            "ALTER TABLE housekeeping_requests ADD COLUMN audio_url VARCHAR(500) NULL",
        ),
        (
            "cancelled_at",
            "ALTER TABLE housekeeping_requests ADD COLUMN cancelled_at DATETIME NULL",
        ),
        (
            "priority",
            "ALTER TABLE housekeeping_requests ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'normal'",
        ),
        (
            "due_at",
            "ALTER TABLE housekeeping_requests ADD COLUMN due_at DATETIME NULL",
        ),
        (
            "photo_proof_url",
            "ALTER TABLE housekeeping_requests ADD COLUMN photo_proof_url VARCHAR(500) NULL",
        ),
        (
            "assigned_to_user_id",
            "ALTER TABLE housekeeping_requests ADD COLUMN assigned_to_user_id INT NULL",
        ),
        (
            "assigned_by_user_id",
            "ALTER TABLE housekeeping_requests ADD COLUMN assigned_by_user_id INT NULL",
        ),
        (
            "assigned_at",
            "ALTER TABLE housekeeping_requests ADD COLUMN assigned_at DATETIME NULL",
        ),
        (
            "started_at",
            "ALTER TABLE housekeeping_requests ADD COLUMN started_at DATETIME NULL",
        ),
        (
            "inspection_submitted_at",
            "ALTER TABLE housekeeping_requests ADD COLUMN inspection_submitted_at DATETIME NULL",
        ),
        (
            "inspected_at",
            "ALTER TABLE housekeeping_requests ADD COLUMN inspected_at DATETIME NULL",
        ),
        (
            "inspected_by_user_id",
            "ALTER TABLE housekeeping_requests ADD COLUMN inspected_by_user_id INT NULL",
        ),
        (
            "inspection_notes",
            "ALTER TABLE housekeeping_requests ADD COLUMN inspection_notes TEXT NULL",
        ),
        (
            "blocked_reason",
            "ALTER TABLE housekeeping_requests ADD COLUMN blocked_reason TEXT NULL",
        ),
        (
            "delay_reason",
            "ALTER TABLE housekeeping_requests ADD COLUMN delay_reason TEXT NULL",
        ),
        (
            "remarks",
            "ALTER TABLE housekeeping_requests ADD COLUMN remarks TEXT NULL",
        ),
        (
            "rework_count",
            "ALTER TABLE housekeeping_requests ADD COLUMN rework_count INT NOT NULL DEFAULT 0",
        ),
        (
            "sla_breached",
            "ALTER TABLE housekeeping_requests ADD COLUMN sla_breached BOOLEAN NOT NULL DEFAULT FALSE",
        ),
    )

    room_column_patches: Sequence[tuple[str, str]] = (
        (
            "housekeeping_status",
            "ALTER TABLE rooms ADD COLUMN housekeeping_status VARCHAR(32) NOT NULL DEFAULT 'vacant_dirty'",
        ),
        (
            "maintenance_required",
            "ALTER TABLE rooms ADD COLUMN maintenance_required BOOLEAN NOT NULL DEFAULT FALSE",
        ),
    )

    with engine.begin() as conn:
        for column_name, alter_sql in order_header_column_patches:
            if _column_exists(conn, "order_headers", column_name):
                continue
            conn.execute(text(alter_sql))
            logger.warning(
                "Applied development schema patch: order_headers.%s was missing and has been added.",
                column_name,
            )

        for column_name, alter_sql in user_column_patches:
            if _column_exists(conn, "users", column_name):
                continue
            conn.execute(text(alter_sql))
            logger.warning(
                "Applied development schema patch: users.%s was missing and has been added.",
                column_name,
            )

        for column_name, alter_sql in restaurant_column_patches:
            if _column_exists(conn, "restaurants", column_name):
                continue
            conn.execute(text(alter_sql))
            logger.warning(
                "Applied development schema patch: restaurants.%s was missing and has been added.",
                column_name,
            )

        for column_name, alter_sql in category_column_patches:
            if _column_exists(conn, "categories", column_name):
                continue
            conn.execute(text(alter_sql))
            logger.warning(
                "Applied development schema patch: categories.%s was missing and has been added.",
                column_name,
            )

        for column_name, alter_sql in item_column_patches:
            if _column_exists(conn, "items", column_name):
                continue
            conn.execute(text(alter_sql))
            logger.warning(
                "Applied development schema patch: items.%s was missing and has been added.",
                column_name,
            )

        for column_name, alter_sql in housekeeping_column_patches:
            if _column_exists(conn, "housekeeping_requests", column_name):
                continue
            conn.execute(text(alter_sql))
            logger.warning(
                "Applied development schema patch: housekeeping_requests.%s was missing and has been added.",
                column_name,
            )

        for column_name, alter_sql in room_column_patches:
            if _column_exists(conn, "rooms", column_name):
                continue
            conn.execute(text(alter_sql))
            logger.warning(
                "Applied development schema patch: rooms.%s was missing and has been added.",
                column_name,
            )
