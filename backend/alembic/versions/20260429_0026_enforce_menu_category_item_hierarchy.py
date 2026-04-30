"""Enforce menu -> category -> item hierarchy.

Revision ID: 20260429_0026
Revises: 20260428_0025
Create Date: 2026-04-29 09:00:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260429_0026"
down_revision = "20260428_0025"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    return table_name in sa.inspect(bind).get_table_names()


def _column_names(bind, table_name: str) -> set[str]:
    if not _table_exists(bind, table_name):
        return set()
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _index_names(bind, table_name: str) -> set[str]:
    if not _table_exists(bind, table_name):
        return set()
    return {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}


def _foreign_keys(bind, table_name: str) -> list[dict]:
    if not _table_exists(bind, table_name):
        return []
    return sa.inspect(bind).get_foreign_keys(table_name)


def _find_fk_name(
    bind,
    *,
    table_name: str,
    constrained_columns: list[str],
    referred_table: str,
) -> str | None:
    normalized_columns = tuple(constrained_columns)
    for fk in _foreign_keys(bind, table_name):
        if tuple(fk.get("constrained_columns") or []) != normalized_columns:
            continue
        if (fk.get("referred_table") or "").lower() != referred_table.lower():
            continue
        return fk.get("name")
    return None


def _drop_fk_if_exists(
    bind,
    *,
    table_name: str,
    constrained_columns: list[str],
    referred_table: str,
) -> None:
    fk_name = _find_fk_name(
        bind,
        table_name=table_name,
        constrained_columns=constrained_columns,
        referred_table=referred_table,
    )
    if fk_name:
        op.drop_constraint(fk_name, table_name, type_="foreignkey")


def _create_index_if_missing(table_name: str, index_name: str, columns: list[str]) -> None:
    bind = op.get_bind()
    if not _table_exists(bind, table_name):
        return
    if index_name in _index_names(bind, table_name):
        return
    op.create_index(index_name, table_name, columns)


def _drop_index_if_exists(table_name: str, index_name: str) -> None:
    bind = op.get_bind()
    if _table_exists(bind, table_name) and index_name in _index_names(bind, table_name):
        op.drop_index(index_name, table_name=table_name)


def _get_or_create_default_menu_id(bind, restaurant_id: int) -> int:
    existing = bind.execute(
        sa.text("""
            SELECT id
            FROM menus
            WHERE restaurant_id = :restaurant_id
            ORDER BY sort_order ASC, id ASC
            LIMIT 1
            """),
        {"restaurant_id": restaurant_id},
    ).first()
    if existing:
        return int(existing[0])

    params = {
        "name": "Main Menu",
        "description": "Created automatically during menu hierarchy migration.",
        "sort_order": 0,
        "is_active": True,
        "restaurant_id": restaurant_id,
    }
    if bind.dialect.name == "postgresql":
        return int(
            bind.execute(
                sa.text("""
                    INSERT INTO menus (
                        name, description, sort_order, is_active,
                        restaurant_id, created_at, updated_at
                    )
                    VALUES (
                        :name, :description, :sort_order, :is_active,
                        :restaurant_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                    RETURNING id
                    """),
                params,
            ).scalar_one()
        )

    result = bind.execute(
        sa.text("""
            INSERT INTO menus (
                name, description, sort_order, is_active,
                restaurant_id, created_at, updated_at
            )
            VALUES (
                :name, :description, :sort_order, :is_active,
                :restaurant_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            """),
        params,
    )
    inserted_id = getattr(result, "lastrowid", None)
    if inserted_id:
        return int(inserted_id)

    fallback = bind.execute(
        sa.text("""
            SELECT id
            FROM menus
            WHERE restaurant_id = :restaurant_id
              AND name = :name
            ORDER BY id DESC
            LIMIT 1
            """),
        params,
    ).first()
    if not fallback:
        raise RuntimeError("Unable to create a default menu for legacy categories.")
    return int(fallback[0])


def _backfill_category_menu_ids(bind) -> None:
    restaurant_rows = bind.execute(sa.text("""
            SELECT DISTINCT restaurant_id
            FROM categories
            WHERE menu_id IS NULL
            """)).all()

    for row in restaurant_rows:
        restaurant_id = int(row[0])
        menu_id = _get_or_create_default_menu_id(bind, restaurant_id)
        bind.execute(
            sa.text("""
                UPDATE categories
                SET menu_id = :menu_id
                WHERE restaurant_id = :restaurant_id
                  AND menu_id IS NULL
                """),
            {"menu_id": menu_id, "restaurant_id": restaurant_id},
        )


def _remove_subcategory_artifacts(bind) -> None:
    if _table_exists(bind, "items") and "subcategory_id" in _column_names(bind, "items"):
        op.drop_column("items", "subcategory_id")
    if _table_exists(bind, "subcategories"):
        op.drop_table("subcategories")


def upgrade() -> None:
    bind = op.get_bind()
    _remove_subcategory_artifacts(bind)

    if _table_exists(bind, "categories") and _table_exists(bind, "menus"):
        if "menu_id" not in _column_names(bind, "categories"):
            op.add_column("categories", sa.Column("menu_id", sa.Integer(), nullable=True))

        _backfill_category_menu_ids(bind)
        _drop_fk_if_exists(
            bind,
            table_name="categories",
            constrained_columns=["menu_id"],
            referred_table="menus",
        )
        op.alter_column(
            "categories",
            "menu_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
        op.create_foreign_key(
            "fk_categories_menu_id_menus",
            "categories",
            "menus",
            ["menu_id"],
            ["id"],
            ondelete="CASCADE",
        )

    _create_index_if_missing("menus", "ix_menus_restaurant_sort", ["restaurant_id", "sort_order", "id"])
    _create_index_if_missing(
        "categories",
        "ix_categories_restaurant_menu_sort",
        ["restaurant_id", "menu_id", "sort_order"],
    )
    _create_index_if_missing(
        "items",
        "ix_items_restaurant_category_name",
        ["restaurant_id", "category_id", "name"],
    )


def downgrade() -> None:
    bind = op.get_bind()

    _drop_index_if_exists("items", "ix_items_restaurant_category_name")
    _drop_index_if_exists("categories", "ix_categories_restaurant_menu_sort")
    _drop_index_if_exists("menus", "ix_menus_restaurant_sort")

    if _table_exists(bind, "categories") and _table_exists(bind, "menus"):
        _drop_fk_if_exists(
            bind,
            table_name="categories",
            constrained_columns=["menu_id"],
            referred_table="menus",
        )
        op.alter_column(
            "categories",
            "menu_id",
            existing_type=sa.Integer(),
            nullable=True,
        )
        op.create_foreign_key(
            "fk_categories_menu_id_menus",
            "categories",
            "menus",
            ["menu_id"],
            ["id"],
            ondelete="SET NULL",
        )
