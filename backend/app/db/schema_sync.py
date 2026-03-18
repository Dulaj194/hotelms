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
            "country",
            "ALTER TABLE restaurants ADD COLUMN country VARCHAR(120) NULL",
        ),
        (
            "currency",
            "ALTER TABLE restaurants ADD COLUMN currency VARCHAR(12) NULL",
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
