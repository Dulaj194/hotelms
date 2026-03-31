from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, func, inspect, text
from sqlalchemy.orm import Session, sessionmaker


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import app.db.init_models  # noqa: F401,E402
from app.modules.categories.model import Category  # noqa: E402
from app.modules.items.model import Item  # noqa: E402
from app.modules.menus.model import Menu  # noqa: E402
from app.modules.reference_data.model import Country, CurrencyType  # noqa: E402
from app.modules.restaurants.model import Restaurant  # noqa: E402
from app.modules.subcategories.model import Subcategory  # noqa: E402


DEFAULT_PRIMARY_DB_URL = "mysql+pymysql://root:hotelms123@localhost:3307/hotelms"


@dataclass
class MigrationStats:
    menus_created: int = 0
    categories_created: int = 0
    subcategories_created: int = 0
    items_created: int = 0
    categories_skipped_missing_menu: int = 0
    subcategories_skipped_missing_category: int = 0
    items_skipped_missing_category: int = 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Migrate legacy restaurant-app catalog tables "
            "(menu_tbl/category_tbl/subcategory_tbl/food_items_tbl) "
            "into the primary HotelMS schema."
        )
    )
    parser.add_argument("--legacy-restaurant-id", type=int, required=True)
    parser.add_argument("--primary-restaurant-id", type=int, required=True)
    parser.add_argument(
        "--legacy-database-url",
        default=None,
        help=(
            "Legacy database SQLAlchemy URL. "
            "Fallback: LEGACY_DATABASE_URL env, then PRIMARY_DATABASE_URL / DATABASE_URL."
        ),
    )
    parser.add_argument(
        "--primary-database-url",
        default=None,
        help=(
            "Primary database SQLAlchemy URL. "
            "Fallback: PRIMARY_DATABASE_URL env, then DATABASE_URL env, then localhost default."
        ),
    )
    parser.add_argument(
        "--truncate-target",
        action="store_true",
        help="Delete existing target tenant menu/category/subcategory/item rows before migration.",
    )
    parser.add_argument(
        "--skip-profile-sync",
        action="store_true",
        help="Do not copy restaurant profile fields (name/address/contact/country/currency).",
    )
    parser.add_argument(
        "--keep-legacy-image-paths",
        action="store_true",
        help=(
            "Keep legacy image paths as-is. By default, non /uploads/* legacy paths are ignored "
            "to avoid broken UI media links."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate migration and roll back writes.",
    )
    return parser.parse_args()


def _resolve_primary_db_url(cli_value: str | None) -> str:
    return (
        cli_value
        or os.getenv("PRIMARY_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or DEFAULT_PRIMARY_DB_URL
    )


def _resolve_legacy_db_url(cli_value: str | None, primary_db_url: str) -> str:
    return (
        cli_value
        or os.getenv("LEGACY_DATABASE_URL")
        or os.getenv("PRIMARY_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or primary_db_url
    )


def _nullable_str(value: Any, max_len: int | None = None) -> str | None:
    if value is None:
        return None
    text_value = str(value).strip()
    if not text_value:
        return None
    if max_len is not None:
        return text_value[:max_len]
    return text_value


def _normalize_time_str(value: Any) -> str | None:
    if value is None:
        return None
    as_text = str(value).strip()
    if not as_text:
        return None
    if len(as_text) >= 8:
        return as_text[:8]
    return as_text


def _normalize_currency_code(value: Any) -> str:
    normalized = _nullable_str(value, max_len=12)
    if not normalized:
        return "LKR"
    return normalized.upper()


def _normalize_image_path(path_value: Any, keep_legacy_paths: bool) -> str | None:
    raw = _nullable_str(path_value, max_len=500)
    if not raw:
        return None

    lower = raw.lower()
    if lower.startswith("http://") or lower.startswith("https://"):
        return raw

    if raw.startswith("/uploads/"):
        return raw
    if raw.startswith("uploads/"):
        return f"/{raw}"

    if keep_legacy_paths:
        return raw
    return None


def _ensure_legacy_schema(legacy_engine) -> None:
    required_tables = {
        "restaurant_tbl",
        "countries_tbl",
        "currency_types_tbl",
        "menu_tbl",
        "category_tbl",
        "subcategory_tbl",
        "food_items_tbl",
    }
    found_tables = set(inspect(legacy_engine).get_table_names())
    missing = sorted(required_tables - found_tables)
    if missing:
        missing_list = ", ".join(missing)
        raise RuntimeError(
            "Legacy schema verification failed. Missing tables: "
            f"{missing_list}. Ensure LEGACY_DATABASE_URL points to restaurant-app DB."
        )


def _fetch_legacy_payload(legacy_engine, legacy_restaurant_id: int) -> dict[str, Any]:
    with legacy_engine.connect() as conn:
        profile = conn.execute(
            text(
                """
                SELECT
                    r.restaurant_id,
                    r.restaurant_name,
                    r.address,
                    r.contact_number,
                    r.email,
                    r.opening_time,
                    r.closing_time,
                    c.country_name,
                    cur.currency AS currency_code
                FROM restaurant_tbl r
                LEFT JOIN countries_tbl c ON c.country_id = r.country_id
                LEFT JOIN currency_types_tbl cur ON cur.currency_id = r.currency_id
                WHERE r.restaurant_id = :restaurant_id
                """
            ),
            {"restaurant_id": legacy_restaurant_id},
        ).mappings().first()

        if profile is None:
            raise RuntimeError(
                f"Legacy restaurant_id={legacy_restaurant_id} not found in restaurant_tbl."
            )

        currencies = conn.execute(
            text(
                """
                SELECT currency_id, currency
                FROM currency_types_tbl
                """
            )
        ).mappings().all()
        currency_lookup = {int(row["currency_id"]): str(row["currency"]) for row in currencies}

        menus = conn.execute(
            text(
                """
                SELECT menu_id, menu_name, description, image_url
                FROM menu_tbl
                WHERE restaurant_id = :restaurant_id
                ORDER BY menu_id ASC
                """
            ),
            {"restaurant_id": legacy_restaurant_id},
        ).mappings().all()

        categories = conn.execute(
            text(
                """
                SELECT category_id, category_name, menu_id, image_url, description
                FROM category_tbl
                WHERE restaurant_id = :restaurant_id
                ORDER BY category_id ASC
                """
            ),
            {"restaurant_id": legacy_restaurant_id},
        ).mappings().all()

        subcategories = conn.execute(
            text(
                """
                SELECT subcategory_id, subcategory_name, parent_category_id
                FROM subcategory_tbl
                WHERE restaurant_id = :restaurant_id
                ORDER BY subcategory_id ASC
                """
            ),
            {"restaurant_id": legacy_restaurant_id},
        ).mappings().all()

        items = conn.execute(
            text(
                """
                SELECT
                    food_items_id,
                    food_items_name,
                    description,
                    price,
                    currency_id,
                    category_id,
                    subcategory_id,
                    image_url_1,
                    image_url_2,
                    image_url_3,
                    image_url_4,
                    video_link,
                    blog_link,
                    more_details
                FROM food_items_tbl
                WHERE restaurant_id = :restaurant_id
                ORDER BY food_items_id ASC
                """
            ),
            {"restaurant_id": legacy_restaurant_id},
        ).mappings().all()

    return {
        "profile": profile,
        "currency_lookup": currency_lookup,
        "menus": menus,
        "categories": categories,
        "subcategories": subcategories,
        "items": items,
    }


def _resolve_or_create_country(db: Session, country_name: str) -> Country:
    normalized = country_name.strip().lower()
    existing = db.query(Country).filter(func.lower(Country.name) == normalized).first()
    if existing:
        return existing
    country = Country(name=country_name.strip(), iso2=None, is_active=True)
    db.add(country)
    db.flush()
    return country


def _resolve_or_create_currency(db: Session, currency_code: str) -> CurrencyType:
    normalized = currency_code.strip().upper()
    existing = (
        db.query(CurrencyType)
        .filter(func.upper(CurrencyType.code) == normalized)
        .first()
    )
    if existing:
        return existing
    currency = CurrencyType(
        code=normalized,
        name=normalized,
        symbol=None,
        is_active=True,
    )
    db.add(currency)
    db.flush()
    return currency


def _sync_restaurant_profile(
    db: Session,
    target_restaurant: Restaurant,
    legacy_profile: dict[str, Any],
) -> None:
    legacy_name = _nullable_str(legacy_profile.get("restaurant_name"), max_len=255)
    legacy_address = _nullable_str(legacy_profile.get("address"), max_len=500)
    legacy_contact = _nullable_str(legacy_profile.get("contact_number"), max_len=50)
    legacy_email = _nullable_str(legacy_profile.get("email"), max_len=191)
    legacy_opening = _normalize_time_str(legacy_profile.get("opening_time"))
    legacy_closing = _normalize_time_str(legacy_profile.get("closing_time"))
    legacy_country_name = _nullable_str(legacy_profile.get("country_name"), max_len=120)
    legacy_currency_code = _nullable_str(legacy_profile.get("currency_code"), max_len=12)

    if legacy_name:
        target_restaurant.name = legacy_name
    if legacy_address:
        target_restaurant.address = legacy_address
    if legacy_contact:
        target_restaurant.phone = legacy_contact
    if legacy_email:
        target_restaurant.email = legacy_email
    if legacy_opening:
        target_restaurant.opening_time = legacy_opening
    if legacy_closing:
        target_restaurant.closing_time = legacy_closing
    if legacy_country_name:
        country = _resolve_or_create_country(db, legacy_country_name)
        target_restaurant.country_id = country.id
        target_restaurant.country = country.name
    if legacy_currency_code:
        currency = _resolve_or_create_currency(db, legacy_currency_code)
        target_restaurant.currency_id = currency.id
        target_restaurant.currency = currency.code


def _truncate_target_catalog(db: Session, primary_restaurant_id: int) -> None:
    db.query(Item).filter(Item.restaurant_id == primary_restaurant_id).delete(synchronize_session=False)
    db.query(Subcategory).filter(Subcategory.restaurant_id == primary_restaurant_id).delete(
        synchronize_session=False
    )
    db.query(Category).filter(Category.restaurant_id == primary_restaurant_id).delete(
        synchronize_session=False
    )
    db.query(Menu).filter(Menu.restaurant_id == primary_restaurant_id).delete(synchronize_session=False)
    db.flush()


def _run_migration(
    db: Session,
    *,
    payload: dict[str, Any],
    primary_restaurant_id: int,
    truncate_target: bool,
    sync_profile: bool,
    keep_legacy_image_paths: bool,
) -> MigrationStats:
    stats = MigrationStats()
    target_restaurant = db.query(Restaurant).filter(Restaurant.id == primary_restaurant_id).first()
    if not target_restaurant:
        raise RuntimeError(f"Primary restaurant_id={primary_restaurant_id} not found.")

    if truncate_target:
        _truncate_target_catalog(db, primary_restaurant_id)

    if sync_profile:
        _sync_restaurant_profile(db, target_restaurant, payload["profile"])

    menu_id_map: dict[int, int] = {}
    for index, row in enumerate(payload["menus"], start=1):
        menu = Menu(
            name=_nullable_str(row.get("menu_name"), max_len=255) or f"Menu {index}",
            description=_nullable_str(row.get("description")),
            image_path=_normalize_image_path(row.get("image_url"), keep_legacy_image_paths),
            sort_order=index,
            is_active=True,
            restaurant_id=primary_restaurant_id,
        )
        db.add(menu)
        db.flush()
        menu_id_map[int(row["menu_id"])] = menu.id
        stats.menus_created += 1

    category_id_map: dict[int, int] = {}
    for index, row in enumerate(payload["categories"], start=1):
        legacy_menu_id = row.get("menu_id")
        mapped_menu_id = menu_id_map.get(int(legacy_menu_id)) if legacy_menu_id is not None else None
        if legacy_menu_id is not None and mapped_menu_id is None:
            stats.categories_skipped_missing_menu += 1
            continue

        category = Category(
            name=_nullable_str(row.get("category_name"), max_len=255) or f"Category {index}",
            description=_nullable_str(row.get("description")),
            image_path=_normalize_image_path(row.get("image_url"), keep_legacy_image_paths),
            sort_order=index,
            is_active=True,
            menu_id=mapped_menu_id,
            restaurant_id=primary_restaurant_id,
        )
        db.add(category)
        db.flush()
        category_id_map[int(row["category_id"])] = category.id
        stats.categories_created += 1

    subcategory_id_map: dict[int, int] = {}
    for index, row in enumerate(payload["subcategories"], start=1):
        legacy_category_id = row.get("parent_category_id")
        mapped_category_id = (
            category_id_map.get(int(legacy_category_id)) if legacy_category_id is not None else None
        )
        if mapped_category_id is None:
            stats.subcategories_skipped_missing_category += 1
            continue

        subcategory = Subcategory(
            name=_nullable_str(row.get("subcategory_name"), max_len=255) or f"Subcategory {index}",
            description=None,
            image_path=None,
            sort_order=index,
            is_active=True,
            category_id=mapped_category_id,
            restaurant_id=primary_restaurant_id,
        )
        db.add(subcategory)
        db.flush()
        subcategory_id_map[int(row["subcategory_id"])] = subcategory.id
        stats.subcategories_created += 1

    target_currency_default = _normalize_currency_code(target_restaurant.currency)
    currency_lookup: dict[int, str] = payload["currency_lookup"]
    for row in payload["items"]:
        legacy_category_id = row.get("category_id")
        mapped_category_id = (
            category_id_map.get(int(legacy_category_id)) if legacy_category_id is not None else None
        )
        if mapped_category_id is None:
            stats.items_skipped_missing_category += 1
            continue

        legacy_subcategory_id = row.get("subcategory_id")
        mapped_subcategory_id = (
            subcategory_id_map.get(int(legacy_subcategory_id))
            if legacy_subcategory_id is not None
            else None
        )

        legacy_currency_id = row.get("currency_id")
        currency_code = target_currency_default
        if legacy_currency_id is not None and int(legacy_currency_id) in currency_lookup:
            currency_code = _normalize_currency_code(currency_lookup[int(legacy_currency_id)])

        item = Item(
            name=_nullable_str(row.get("food_items_name"), max_len=255)
            or f"Item {int(row.get('food_items_id', 0) or 0)}",
            description=_nullable_str(row.get("description"), max_len=350),
            more_details=_nullable_str(row.get("more_details")),
            price=float(row.get("price") or 0.0),
            currency=currency_code,
            image_path=_normalize_image_path(row.get("image_url_1"), keep_legacy_image_paths),
            image_path_2=_normalize_image_path(row.get("image_url_2"), keep_legacy_image_paths),
            image_path_3=_normalize_image_path(row.get("image_url_3"), keep_legacy_image_paths),
            image_path_4=_normalize_image_path(row.get("image_url_4"), keep_legacy_image_paths),
            image_path_5=None,
            video_path=_nullable_str(row.get("video_link"), max_len=500),
            blog_link=_nullable_str(row.get("blog_link"), max_len=1000),
            is_available=True,
            category_id=mapped_category_id,
            subcategory_id=mapped_subcategory_id,
            restaurant_id=primary_restaurant_id,
        )
        db.add(item)
        db.flush()
        stats.items_created += 1

    return stats


def _print_summary(stats: MigrationStats, dry_run: bool) -> None:
    mode = "DRY-RUN" if dry_run else "COMMITTED"
    print(f"Migration summary [{mode}]")
    print("- menus_created:", stats.menus_created)
    print("- categories_created:", stats.categories_created)
    print("- subcategories_created:", stats.subcategories_created)
    print("- items_created:", stats.items_created)
    print("- categories_skipped_missing_menu:", stats.categories_skipped_missing_menu)
    print("- subcategories_skipped_missing_category:", stats.subcategories_skipped_missing_category)
    print("- items_skipped_missing_category:", stats.items_skipped_missing_category)


def main() -> int:
    args = _parse_args()
    primary_db_url = _resolve_primary_db_url(args.primary_database_url)
    legacy_db_url = _resolve_legacy_db_url(args.legacy_database_url, primary_db_url)

    print("Legacy DB URL:", legacy_db_url)
    print("Primary DB URL:", primary_db_url)
    print("Legacy restaurant_id:", args.legacy_restaurant_id)
    print("Primary restaurant_id:", args.primary_restaurant_id)
    print("truncate_target:", args.truncate_target)
    print("sync_profile:", not args.skip_profile_sync)
    print("keep_legacy_image_paths:", args.keep_legacy_image_paths)
    print("dry_run:", args.dry_run)

    legacy_engine = create_engine(legacy_db_url, pool_pre_ping=True, future=True)
    primary_engine = create_engine(primary_db_url, pool_pre_ping=True, future=True)
    primary_session_local = sessionmaker(bind=primary_engine, autoflush=False, autocommit=False)

    try:
        _ensure_legacy_schema(legacy_engine)
        payload = _fetch_legacy_payload(legacy_engine, args.legacy_restaurant_id)
        with primary_session_local() as db:
            stats = _run_migration(
                db,
                payload=payload,
                primary_restaurant_id=args.primary_restaurant_id,
                truncate_target=args.truncate_target,
                sync_profile=not args.skip_profile_sync,
                keep_legacy_image_paths=args.keep_legacy_image_paths,
            )

            if args.dry_run:
                db.rollback()
            else:
                db.commit()

        _print_summary(stats, args.dry_run)
        return 0
    except Exception as exc:
        print("Migration failed:", exc)
        return 1
    finally:
        legacy_engine.dispose()
        primary_engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
