import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.public import repository
from app.modules.public.schemas import (
    PublicCategoryResponse,
    PublicItemDetailResponse,
    PublicItemSummaryResponse,
    PublicMenuResponse,
    PublicMenuSectionResponse,
    PublicRestaurantInfoResponse,
)


def _assert_restaurant_active(restaurant_id: int, db: Session) -> PublicRestaurantInfoResponse:
    """Fetch and validate a public-facing restaurant. Raises clean 404 if not found."""
    restaurant = repository.get_public_restaurant_info(db, restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    banner_urls: list[str] = []
    if restaurant.public_menu_banner_urls_json:
        try:
            parsed = json.loads(restaurant.public_menu_banner_urls_json)
            if isinstance(parsed, list):
                banner_urls = [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            banner_urls = []

    return PublicRestaurantInfoResponse(
        id=restaurant.id,
        name=restaurant.name,
        phone=restaurant.phone,
        address=restaurant.address,
        logo_url=restaurant.logo_url,
        public_menu_banner_urls=banner_urls,
        is_active=restaurant.is_active,
    )


def get_public_restaurant_info(db: Session, restaurant_id: int) -> PublicRestaurantInfoResponse:
    return _assert_restaurant_active(restaurant_id, db)


def get_public_menu(db: Session, restaurant_id: int) -> PublicMenuResponse:
    """Build the full public menu tree: restaurant → menus → categories → items."""
    restaurant_info = _assert_restaurant_active(restaurant_id, db)

    categories = repository.list_public_categories_by_restaurant(db, restaurant_id)
    all_items = repository.list_public_items_by_restaurant(db, restaurant_id)

    menus = repository.list_public_menus_by_restaurant(db, restaurant_id)
    items_by_category: dict[int, list[PublicItemSummaryResponse]] = {}
    for item in all_items:
        summary = PublicItemSummaryResponse.model_validate(item)
        items_by_category.setdefault(item.category_id, []).append(summary)

    def _build_category(cat) -> PublicCategoryResponse:
        return PublicCategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            image_path=cat.image_path,
            sort_order=cat.sort_order,
            menu_id=cat.menu_id,
            items=items_by_category.get(cat.id, []),
        )

    cats_by_menu: dict[int, list[PublicCategoryResponse]] = {}
    for cat in categories:
        if cat.menu_id is None:
            continue
        cat_resp = _build_category(cat)
        cats_by_menu.setdefault(cat.menu_id, []).append(cat_resp)

    menu_sections = [
        PublicMenuSectionResponse(
            id=m.id,
            name=m.name,
            description=m.description,
            image_path=m.image_path,
            sort_order=m.sort_order,
            categories=cats_by_menu.get(m.id, []),
        )
        for m in menus
    ]

    flat_categories: list[PublicCategoryResponse] = [
        category for section in menu_sections for category in section.categories
    ]

    uncategorized_list: list[PublicCategoryResponse] = [
        _build_category(cat) for cat in categories if cat.menu_id is None
    ]

    return PublicMenuResponse(
        restaurant=restaurant_info,
        menus=menu_sections,
        uncategorized_categories=uncategorized_list,
        categories=flat_categories + uncategorized_list,
    )


def get_public_item_detail(db: Session, restaurant_id: int, item_id: int) -> PublicItemDetailResponse:
    """Fetch a single item's public detail.

    restaurant_id scoping prevents cross-tenant data leakage.
    """
    item = repository.get_public_item_by_id(db, item_id, restaurant_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )
    return PublicItemDetailResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        price=float(item.price),
        image_path=item.image_path,
        is_available=item.is_available,
        category_id=item.category_id,
        category_name=item.category.name if item.category else None,
    )


def get_public_items_by_category(db: Session, restaurant_id: int, category_id: int) -> list[PublicItemSummaryResponse]:
    """Return items for one category within a restaurant."""
    items = repository.list_public_items_by_category(db, category_id, restaurant_id)
    return [PublicItemSummaryResponse.model_validate(i) for i in items]
