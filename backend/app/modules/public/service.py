from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.public import repository
from app.modules.public.schemas import (
    PublicCategoryResponse,
    PublicItemDetailResponse,
    PublicItemSummaryResponse,
    PublicMenuResponse,
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
    return PublicRestaurantInfoResponse.model_validate(restaurant)


def get_public_restaurant_info(
    db: Session, restaurant_id: int
) -> PublicRestaurantInfoResponse:
    return _assert_restaurant_active(restaurant_id, db)


def get_public_menu(db: Session, restaurant_id: int) -> PublicMenuResponse:
    """Build the full public menu tree: restaurant info + categories + items."""
    restaurant_info = _assert_restaurant_active(restaurant_id, db)

    categories = repository.list_public_categories_by_restaurant(db, restaurant_id)
    all_items = repository.list_public_items_by_restaurant(db, restaurant_id)

    # Group items by category_id for O(1) lookup when building the tree
    items_by_category: dict[int, list[PublicItemSummaryResponse]] = {}
    for item in all_items:
        summary = PublicItemSummaryResponse.model_validate(item)
        items_by_category.setdefault(item.category_id, []).append(summary)

    category_responses = [
        PublicCategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            image_path=cat.image_path,
            sort_order=cat.sort_order,
            items=items_by_category.get(cat.id, []),
        )
        for cat in categories
    ]

    return PublicMenuResponse(restaurant=restaurant_info, categories=category_responses)


def get_public_item_detail(
    db: Session, restaurant_id: int, item_id: int
) -> PublicItemDetailResponse:
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


def get_public_items_by_category(
    db: Session, restaurant_id: int, category_id: int
) -> list[PublicItemSummaryResponse]:
    """Return items for one category within a restaurant."""
    items = repository.list_public_items_by_category(db, category_id, restaurant_id)
    return [PublicItemSummaryResponse.model_validate(i) for i in items]
