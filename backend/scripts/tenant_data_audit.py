from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import app.db.init_models  # noqa: F401,E402
from app.modules.categories.model import Category  # noqa: E402
from app.modules.items.model import Item  # noqa: E402
from app.modules.menus.model import Menu  # noqa: E402
from app.modules.restaurants.model import Restaurant  # noqa: E402
from app.modules.subcategories.model import Subcategory  # noqa: E402
from app.modules.users.model import User  # noqa: E402


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit tenant-scoped catalog integrity and per-tenant data counts.",
    )
    parser.add_argument(
        "--restaurant-id",
        type=int,
        default=None,
        help="Optional tenant filter. When set, prints one tenant summary only.",
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help=(
            "SQLAlchemy URL override. If omitted, uses DATABASE_URL env var, "
            "Set DATABASE_URL environment variable to use a custom database URL."
        ),
    )
    return parser.parse_args()


def _group_counts_by_restaurant(db, model, restaurant_id: int | None) -> dict[int, int]:
    query = db.query(model.restaurant_id, func.count(model.id))
    if restaurant_id is not None:
        query = query.filter(model.restaurant_id == restaurant_id)
    rows = query.group_by(model.restaurant_id).all()
    return {int(rid): int(count) for rid, count in rows if rid is not None}


def _audit_orphans_and_cross_tenant(db, restaurant_id: int | None) -> dict[str, int]:
    user_orphans_q = (
        db.query(func.count(User.id))
        .outerjoin(Restaurant, Restaurant.id == User.restaurant_id)
        .filter(User.restaurant_id.isnot(None), Restaurant.id.is_(None))
    )
    category_menu_cross_q = (
        db.query(func.count(Category.id))
        .join(Menu, Menu.id == Category.menu_id)
        .filter(Category.menu_id.isnot(None), Category.restaurant_id != Menu.restaurant_id)
    )
    subcategory_cross_q = (
        db.query(func.count(Subcategory.id))
        .join(Category, Category.id == Subcategory.category_id)
        .filter(Subcategory.restaurant_id != Category.restaurant_id)
    )
    item_category_cross_q = (
        db.query(func.count(Item.id))
        .join(Category, Category.id == Item.category_id)
        .filter(Item.restaurant_id != Category.restaurant_id)
    )
    item_subcategory_cross_q = (
        db.query(func.count(Item.id))
        .join(Subcategory, Subcategory.id == Item.subcategory_id)
        .filter(Item.subcategory_id.isnot(None), Item.restaurant_id != Subcategory.restaurant_id)
    )

    if restaurant_id is not None:
        category_menu_cross_q = category_menu_cross_q.filter(Category.restaurant_id == restaurant_id)
        subcategory_cross_q = subcategory_cross_q.filter(Subcategory.restaurant_id == restaurant_id)
        item_category_cross_q = item_category_cross_q.filter(Item.restaurant_id == restaurant_id)
        item_subcategory_cross_q = item_subcategory_cross_q.filter(Item.restaurant_id == restaurant_id)
        user_orphans_q = user_orphans_q.filter(User.restaurant_id == restaurant_id)

    return {
        "user_restaurant_orphans": int(user_orphans_q.scalar() or 0),
        "categories_linked_to_foreign_menu": int(category_menu_cross_q.scalar() or 0),
        "subcategories_linked_to_foreign_category": int(subcategory_cross_q.scalar() or 0),
        "items_linked_to_foreign_category": int(item_category_cross_q.scalar() or 0),
        "items_linked_to_foreign_subcategory": int(item_subcategory_cross_q.scalar() or 0),
    }


def main() -> int:
    args = _parse_args()
    database_url = (
        args.database_url
        or os.getenv("DATABASE_URL")
        or "" # Fail fast if not set
    )
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable must be set. "
            "Never use hardcoded credentials."
        )
    )
    engine = create_engine(database_url, pool_pre_ping=True, future=True)
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = session_local()
    try:
        restaurants = db.query(Restaurant.id, Restaurant.name).order_by(Restaurant.id.asc())
        if args.restaurant_id is not None:
            restaurants = restaurants.filter(Restaurant.id == args.restaurant_id)
        restaurant_rows = restaurants.all()

        if not restaurant_rows:
            target = f"restaurant_id={args.restaurant_id}" if args.restaurant_id is not None else "all tenants"
            print(f"No restaurants found for {target}.")
            return 1

        counts_users = _group_counts_by_restaurant(db, User, args.restaurant_id)
        counts_menus = _group_counts_by_restaurant(db, Menu, args.restaurant_id)
        counts_categories = _group_counts_by_restaurant(db, Category, args.restaurant_id)
        counts_subcategories = _group_counts_by_restaurant(db, Subcategory, args.restaurant_id)
        counts_items = _group_counts_by_restaurant(db, Item, args.restaurant_id)

        print("Tenant catalog summary")
        print("-" * 100)
        print(f"{'RID':<6}{'Restaurant':<28}{'Users':>8}{'Menus':>8}{'Cats':>8}{'Subs':>8}{'Items':>10}")
        print("-" * 100)
        for rid, name in restaurant_rows:
            rid_int = int(rid)
            print(
                f"{rid_int:<6}{(name or '-'):28.28}"
                f"{counts_users.get(rid_int, 0):>8}"
                f"{counts_menus.get(rid_int, 0):>8}"
                f"{counts_categories.get(rid_int, 0):>8}"
                f"{counts_subcategories.get(rid_int, 0):>8}"
                f"{counts_items.get(rid_int, 0):>10}"
            )
        print("-" * 100)

        audit = _audit_orphans_and_cross_tenant(db, args.restaurant_id)
        print("Integrity checks")
        for key, value in audit.items():
            status = "OK" if value == 0 else "ISSUE"
            print(f"- {key}: {value} [{status}]")

        has_issue = any(v > 0 for v in audit.values())
        if has_issue:
            print("Result: FAIL (fix tenant/data consistency issues above)")
            return 2

        print("Result: PASS")
        return 0
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
