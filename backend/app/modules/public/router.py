from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.modules.public import service
from app.modules.public.schemas import (
    PublicItemDetailResponse,
    PublicItemSummaryResponse,
    PublicMenuResponse,
    PublicRestaurantInfoResponse,
)

router = APIRouter()


@router.get(
    "/restaurants/{restaurant_id}/info",
    response_model=PublicRestaurantInfoResponse,
    summary="Public restaurant info",
)
def public_restaurant_info(
    restaurant_id: int,
    db: Session = Depends(get_db),
) -> PublicRestaurantInfoResponse:
    """Return public-facing restaurant info. No auth required."""
    return service.get_public_restaurant_info(db, restaurant_id)


@router.get(
    "/restaurants/{restaurant_id}/menu",
    response_model=PublicMenuResponse,
    summary="Public menu tree",
)
def public_menu(
    restaurant_id: int,
    db: Session = Depends(get_db),
) -> PublicMenuResponse:
    """Return full public menu (categories + items). No auth required."""
    return service.get_public_menu(db, restaurant_id)


@router.get(
    "/restaurants/{restaurant_id}/items/{item_id}",
    response_model=PublicItemDetailResponse,
    summary="Public item detail",
)
def public_item_detail(
    restaurant_id: int,
    item_id: int,
    db: Session = Depends(get_db),
) -> PublicItemDetailResponse:
    """Return one item's public detail. restaurant_id enforces tenant boundary."""
    return service.get_public_item_detail(db, restaurant_id, item_id)


@router.get(
    "/restaurants/{restaurant_id}/categories/{category_id}/items",
    response_model=list[PublicItemSummaryResponse],
    summary="Public items by category",
)
def public_items_by_category(
    restaurant_id: int,
    category_id: int,
    db: Session = Depends(get_db),
) -> list[PublicItemSummaryResponse]:
    """Return items for one category. Both IDs scoped to same restaurant."""
    return service.get_public_items_by_category(db, restaurant_id, category_id)
