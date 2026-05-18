from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.i18n import get_language, localize_object
from app.modules.public import service
from app.modules.public.schemas import (
    PublicItemDetailResponse,
    PublicItemSummaryResponse,
    PublicMenuResponse,
    PublicRestaurantInfoResponse,
)
from app.modules.promo_codes.schemas import (
    PromoCodeValidateRequest,
    PromoCodeValidationResponse,
)

router = APIRouter()


@router.get(
    "/restaurants/{restaurant_id}/info",
    response_model=PublicRestaurantInfoResponse,
    summary="Public restaurant info",
)
def public_restaurant_info(
    restaurant_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> PublicRestaurantInfoResponse:
    """Return public-facing restaurant info. No auth required."""
    lang = get_language(request)
    info = service.get_public_restaurant_info(db, restaurant_id)
    return localize_object(info, lang)


@router.get(
    "/restaurants/{restaurant_id}/menu",
    response_model=PublicMenuResponse,
    summary="Public menu tree",
)
def public_menu(
    restaurant_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> PublicMenuResponse:
    """Return full public menu (categories + items). No auth required."""
    lang = get_language(request)
    menu = service.get_public_menu(db, restaurant_id)
    return localize_object(menu, lang)


@router.get(
    "/restaurants/{restaurant_id}/items/{item_id}",
    response_model=PublicItemDetailResponse,
    summary="Public item detail",
)
def public_item_detail(
    restaurant_id: int,
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> PublicItemDetailResponse:
    """Return one item's public detail. restaurant_id enforces tenant boundary."""
    lang = get_language(request)
    item = service.get_public_item_detail(db, restaurant_id, item_id)
    return localize_object(item, lang)


@router.get(
    "/restaurants/{restaurant_id}/categories/{category_id}/items",
    response_model=list[PublicItemSummaryResponse],
    summary="Public items by category",
)
def public_items_by_category(
    restaurant_id: int,
    category_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> list[PublicItemSummaryResponse]:
    """Return items for one category. Both IDs scoped to same restaurant."""
    lang = get_language(request)
    items = service.get_public_items_by_category(db, restaurant_id, category_id)
    return localize_object(items, lang)


@router.post(
    "/restaurants/{restaurant_id}/coupon/validate",
    response_model=PromoCodeValidationResponse,
    summary="Validate a promo code for a guest",
)
def public_validate_promo_code(
    restaurant_id: int,
    payload: PromoCodeValidateRequest,
    db: Session = Depends(get_db),
) -> PromoCodeValidationResponse:
    """Validate a promo code for a restaurant. No auth required."""
    from app.modules.promo_codes.service import validate_promo_for_restaurant
    return validate_promo_for_restaurant(db, restaurant_id=restaurant_id, payload=payload)

