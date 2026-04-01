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


def _table_exists(conn: Connection, table_name: str) -> bool:
    query = text(
        """
        SELECT 1
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :table_name
        LIMIT 1
        """
    )
    row = conn.execute(query, {"table_name": table_name}).first()
    return row is not None


def _foreign_key_exists(
    conn: Connection,
    *,
    table_name: str,
    column_name: str,
    referenced_table: str,
    referenced_column: str,
) -> bool:
    query = text(
        """
        SELECT 1
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :table_name
          AND COLUMN_NAME = :column_name
          AND REFERENCED_TABLE_NAME = :referenced_table
          AND REFERENCED_COLUMN_NAME = :referenced_column
        LIMIT 1
        """
    )
    row = conn.execute(
        query,
        {
            "table_name": table_name,
            "column_name": column_name,
            "referenced_table": referenced_table,
            "referenced_column": referenced_column,
        },
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
            "platform_scopes_json",
            "ALTER TABLE users ADD COLUMN platform_scopes_json TEXT NULL",
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
            "opening_time",
            "ALTER TABLE restaurants ADD COLUMN opening_time VARCHAR(8) NULL",
        ),
        (
            "enable_steward",
            "ALTER TABLE restaurants ADD COLUMN enable_steward BOOLEAN NOT NULL DEFAULT TRUE",
        ),
        (
            "closing_time",
            "ALTER TABLE restaurants ADD COLUMN closing_time VARCHAR(8) NULL",
        ),
        (
            "integration_api_key_hash",
            "ALTER TABLE restaurants ADD COLUMN integration_api_key_hash VARCHAR(128) NULL",
        ),
        (
            "integration_api_key_prefix",
            "ALTER TABLE restaurants ADD COLUMN integration_api_key_prefix VARCHAR(16) NULL",
        ),
        (
            "integration_api_key_last4",
            "ALTER TABLE restaurants ADD COLUMN integration_api_key_last4 VARCHAR(4) NULL",
        ),
        (
            "integration_api_key_active",
            "ALTER TABLE restaurants ADD COLUMN integration_api_key_active BOOLEAN NOT NULL DEFAULT FALSE",
        ),
        (
            "integration_api_key_rotated_at",
            "ALTER TABLE restaurants ADD COLUMN integration_api_key_rotated_at DATETIME NULL",
        ),
        (
            "integration_public_ordering_enabled",
            "ALTER TABLE restaurants ADD COLUMN integration_public_ordering_enabled BOOLEAN NOT NULL DEFAULT FALSE",
        ),
        (
            "integration_webhook_url",
            "ALTER TABLE restaurants ADD COLUMN integration_webhook_url VARCHAR(500) NULL",
        ),
        (
            "integration_webhook_secret_header_name",
            "ALTER TABLE restaurants ADD COLUMN integration_webhook_secret_header_name VARCHAR(100) NULL",
        ),
        (
            "integration_webhook_secret_ciphertext",
            "ALTER TABLE restaurants ADD COLUMN integration_webhook_secret_ciphertext TEXT NULL",
        ),
        (
            "integration_webhook_secret_last4",
            "ALTER TABLE restaurants ADD COLUMN integration_webhook_secret_last4 VARCHAR(4) NULL",
        ),
        (
            "integration_webhook_secret_rotated_at",
            "ALTER TABLE restaurants ADD COLUMN integration_webhook_secret_rotated_at DATETIME NULL",
        ),
        (
            "integration_webhook_status",
            "ALTER TABLE restaurants ADD COLUMN integration_webhook_status VARCHAR(32) NOT NULL DEFAULT 'not_configured'",
        ),
        (
            "integration_webhook_last_checked_at",
            "ALTER TABLE restaurants ADD COLUMN integration_webhook_last_checked_at DATETIME NULL",
        ),
        (
            "integration_webhook_last_error",
            "ALTER TABLE restaurants ADD COLUMN integration_webhook_last_error TEXT NULL",
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

    audit_log_column_patches: Sequence[tuple[str, str]] = (
        (
            "restaurant_id",
            "ALTER TABLE audit_logs ADD COLUMN restaurant_id INT NULL",
        ),
    )

    subscription_change_log_column_patches: Sequence[tuple[str, str]] = (
        (
            "previous_package_name_snapshot",
            "ALTER TABLE subscription_change_logs ADD COLUMN previous_package_name_snapshot VARCHAR(100) NULL",
        ),
        (
            "previous_package_code_snapshot",
            "ALTER TABLE subscription_change_logs ADD COLUMN previous_package_code_snapshot VARCHAR(50) NULL",
        ),
        (
            "next_package_name_snapshot",
            "ALTER TABLE subscription_change_logs ADD COLUMN next_package_name_snapshot VARCHAR(100) NULL",
        ),
        (
            "next_package_code_snapshot",
            "ALTER TABLE subscription_change_logs ADD COLUMN next_package_code_snapshot VARCHAR(50) NULL",
        ),
    )

    restaurant_fk_patches: Sequence[tuple[str, str, str, str, str]] = (
        (
            "country_id",
            "countries",
            "id",
            "fk_restaurants_country_id",
            "ALTER TABLE restaurants "
            "ADD CONSTRAINT fk_restaurants_country_id "
            "FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL",
        ),
        (
            "currency_id",
            "currency_types",
            "id",
            "fk_restaurants_currency_id",
            "ALTER TABLE restaurants "
            "ADD CONSTRAINT fk_restaurants_currency_id "
            "FOREIGN KEY (currency_id) REFERENCES currency_types(id) ON DELETE SET NULL",
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

        if _table_exists(conn, "users") and _column_exists(conn, "users", "role"):
            conn.execute(
                text(
                    """
                    ALTER TABLE users
                    MODIFY COLUMN role ENUM(
                        'owner',
                        'admin',
                        'steward',
                        'housekeeper',
                        'cashier',
                        'accountant',
                        'super_admin'
                    ) NOT NULL
                    """
                )
            )

        for column_name, alter_sql in restaurant_column_patches:
            if _column_exists(conn, "restaurants", column_name):
                continue
            conn.execute(text(alter_sql))
            logger.warning(
                "Applied development schema patch: restaurants.%s was missing and has been added.",
                column_name,
            )

        if _column_exists(conn, "restaurants", "billing_email") and _column_exists(conn, "restaurants", "email"):
            result = conn.execute(
                text(
                    """
                    UPDATE restaurants
                    SET billing_email = email
                    WHERE (billing_email IS NULL OR billing_email = '')
                      AND email IS NOT NULL
                      AND email <> ''
                    """
                )
            )
            if result.rowcount and result.rowcount > 0:
                logger.warning(
                    "Applied development schema patch: backfilled restaurants.billing_email from restaurants.email for %s row(s).",
                    result.rowcount,
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

        for column_name, alter_sql in audit_log_column_patches:
            if _column_exists(conn, "audit_logs", column_name):
                continue
            conn.execute(text(alter_sql))
            logger.warning(
                "Applied development schema patch: audit_logs.%s was missing and has been added.",
                column_name,
            )

        if not _table_exists(conn, "subscription_change_logs"):
            conn.execute(
                text(
                    """
                    CREATE TABLE subscription_change_logs (
                        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        restaurant_id INT NOT NULL,
                        subscription_id INT NULL,
                        actor_user_id INT NULL,
                        action ENUM('trial_assigned', 'activated', 'updated', 'cancelled', 'expired') NOT NULL,
                        source VARCHAR(50) NOT NULL DEFAULT 'system',
                        change_reason TEXT NULL,
                        previous_package_id INT NULL,
                        next_package_id INT NULL,
                        previous_status ENUM('trial', 'active', 'expired', 'cancelled') NULL,
                        next_status ENUM('trial', 'active', 'expired', 'cancelled') NULL,
                        previous_expires_at DATETIME NULL,
                        next_expires_at DATETIME NULL,
                        metadata_json TEXT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        INDEX ix_subscription_change_logs_restaurant_id (restaurant_id),
                        INDEX ix_subscription_change_logs_subscription_id (subscription_id),
                        INDEX ix_subscription_change_logs_actor_user_id (actor_user_id),
                        INDEX ix_subscription_change_logs_created_at (created_at),
                        CONSTRAINT fk_subscription_change_logs_restaurant
                            FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
                        CONSTRAINT fk_subscription_change_logs_subscription
                            FOREIGN KEY (subscription_id) REFERENCES restaurant_subscriptions(id) ON DELETE SET NULL,
                        CONSTRAINT fk_subscription_change_logs_actor
                            FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
                        CONSTRAINT fk_subscription_change_logs_previous_package
                            FOREIGN KEY (previous_package_id) REFERENCES packages(id) ON DELETE SET NULL,
                        CONSTRAINT fk_subscription_change_logs_next_package
                            FOREIGN KEY (next_package_id) REFERENCES packages(id) ON DELETE SET NULL
                    )
                    """
                )
            )
            logger.warning(
                "Applied development schema patch: subscription_change_logs table was missing and has been created.",
            )

        if _table_exists(conn, "subscription_change_logs"):
            for column_name, alter_sql in subscription_change_log_column_patches:
                if _column_exists(conn, "subscription_change_logs", column_name):
                    continue
                conn.execute(text(alter_sql))
                logger.warning(
                    "Applied development schema patch: subscription_change_logs.%s was missing and has been added.",
                    column_name,
                )

        if not _table_exists(conn, "super_admin_notification_states"):
            conn.execute(
                text(
                    """
                    CREATE TABLE super_admin_notification_states (
                        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        audit_log_id INT NOT NULL,
                        is_read BOOLEAN NOT NULL DEFAULT FALSE,
                        read_at DATETIME NULL,
                        read_by_user_id INT NULL,
                        assigned_user_id INT NULL,
                        assigned_at DATETIME NULL,
                        acknowledged_at DATETIME NULL,
                        acknowledged_by_user_id INT NULL,
                        snoozed_until DATETIME NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE KEY uq_super_admin_notification_states_audit_log_id (audit_log_id),
                        INDEX ix_super_admin_notification_states_is_read (is_read),
                        INDEX ix_super_admin_notification_states_read_by_user_id (read_by_user_id),
                        INDEX ix_super_admin_notification_states_assigned_user_id (assigned_user_id),
                        INDEX ix_super_admin_notification_states_acknowledged_at (acknowledged_at),
                        INDEX ix_super_admin_notification_states_acknowledged_by_user_id (acknowledged_by_user_id),
                        INDEX ix_super_admin_notification_states_snoozed_until (snoozed_until),
                        CONSTRAINT fk_super_admin_notification_states_audit_log
                            FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON DELETE CASCADE,
                        CONSTRAINT fk_super_admin_notification_states_read_by
                            FOREIGN KEY (read_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
                        CONSTRAINT fk_super_admin_notification_states_assigned_to
                            FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
                        CONSTRAINT fk_super_admin_notification_states_acknowledged_by
                            FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id) ON DELETE SET NULL
                    )
                    """
                )
            )
            logger.warning(
                "Applied development schema patch: super_admin_notification_states table was missing and has been created.",
            )

        if not _table_exists(conn, "restaurant_webhook_deliveries"):
            conn.execute(
                text(
                    """
                    CREATE TABLE restaurant_webhook_deliveries (
                        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        restaurant_id INT NOT NULL,
                        triggered_by_user_id INT NULL,
                        retried_from_delivery_id INT NULL,
                        event_type VARCHAR(100) NOT NULL,
                        request_url VARCHAR(500) NOT NULL,
                        payload_json TEXT NOT NULL,
                        delivery_status VARCHAR(20) NOT NULL DEFAULT 'success',
                        attempt_number INT NOT NULL DEFAULT 1,
                        is_retry BOOLEAN NOT NULL DEFAULT FALSE,
                        http_status_code INT NULL,
                        error_message TEXT NULL,
                        response_excerpt TEXT NULL,
                        response_time_ms INT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        INDEX ix_restaurant_webhook_deliveries_restaurant_id (restaurant_id),
                        INDEX ix_restaurant_webhook_deliveries_triggered_by_user_id (triggered_by_user_id),
                        INDEX ix_restaurant_webhook_deliveries_retried_from_delivery_id (retried_from_delivery_id),
                        INDEX ix_restaurant_webhook_deliveries_event_type (event_type),
                        INDEX ix_restaurant_webhook_deliveries_created_at (created_at),
                        CONSTRAINT fk_restaurant_webhook_deliveries_restaurant
                            FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
                        CONSTRAINT fk_restaurant_webhook_deliveries_triggered_by
                            FOREIGN KEY (triggered_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
                        CONSTRAINT fk_restaurant_webhook_deliveries_retried_from
                            FOREIGN KEY (retried_from_delivery_id) REFERENCES restaurant_webhook_deliveries(id) ON DELETE SET NULL
                    )
                    """
                )
            )
            logger.warning(
                "Applied development schema patch: restaurant_webhook_deliveries table was missing and has been created.",
            )

        for (
            column_name,
            referenced_table,
            referenced_column,
            constraint_name,
            alter_sql,
        ) in restaurant_fk_patches:
            if not _column_exists(conn, "restaurants", column_name):
                continue
            if not _table_exists(conn, referenced_table):
                logger.warning(
                    "Skipped development schema FK patch: restaurants.%s -> %s.%s because referenced table is missing.",
                    column_name,
                    referenced_table,
                    referenced_column,
                )
                continue
            if _foreign_key_exists(
                conn,
                table_name="restaurants",
                column_name=column_name,
                referenced_table=referenced_table,
                referenced_column=referenced_column,
            ):
                continue

            try:
                conn.execute(text(alter_sql))
                logger.warning(
                    "Applied development schema patch: added FK %s on restaurants.%s -> %s.%s.",
                    constraint_name,
                    column_name,
                    referenced_table,
                    referenced_column,
                )
            except Exception as exc:  # pragma: no cover - depends on live DB data quality
                logger.warning(
                    "Skipped development schema FK patch %s (%s): %s",
                    constraint_name,
                    column_name,
                    exc,
                )
