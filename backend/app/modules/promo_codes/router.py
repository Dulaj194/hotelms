from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_restaurant_id,
    get_db,
    require_platform_scopes,
    require_roles,
)
from app.modules.access import role_catalog
from app.modules.promo_codes import service
from app.modules.promo_codes.schemas import (
    PromoCodeConsumeRequest,
    PromoCodeCreateRequest,
    PromoCodeListResponse,
    PromoCodeResponse,
    PromoCodeUpdateRequest,
    PromoCodeUsageResponse,
    PromoCodeValidateRequest,
    PromoCodeValidationResponse,
)
from app.modules.users.model import User

router = APIRouter()

_RESTAURANT_ADMIN_ROLES = role_catalog.RESTAURANT_ADMIN_ROLES


@router.get("", response_model=PromoCodeListResponse)
def list_promo_codes(
    _current_user: User = Depends(require_platform_scopes("ops_viewer", "billing_admin")),
    db: Session = Depends(get_db),
) -> PromoCodeListResponse:
    return service.list_promo_codes(db)


@router.post("", response_model=PromoCodeResponse, status_code=status.HTTP_201_CREATED)
def create_promo_code(
    payload: PromoCodeCreateRequest,
    _current_user: User = Depends(require_platform_scopes("billing_admin")),
    db: Session = Depends(get_db),
) -> PromoCodeResponse:
    return service.create_promo_code(db, payload)


@router.post("/validate", response_model=PromoCodeValidationResponse)
def validate_promo_code(
    payload: PromoCodeValidateRequest,
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> PromoCodeValidationResponse:
    return service.validate_promo_for_restaurant(
        db,
        restaurant_id=restaurant_id,
        payload=payload,
    )


@router.post("/consume", response_model=PromoCodeUsageResponse)
def consume_promo_code(
    payload: PromoCodeConsumeRequest,
    restaurant_id: int = Depends(get_current_restaurant_id),
    _current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> PromoCodeUsageResponse:
    return service.consume_promo_for_restaurant(
        db,
        restaurant_id=restaurant_id,
        payload=payload,
    )


@router.patch("/{promo_code_id}", response_model=PromoCodeResponse)
def update_promo_code(
    promo_code_id: int,
    payload: PromoCodeUpdateRequest,
    _current_user: User = Depends(require_platform_scopes("billing_admin")),
    db: Session = Depends(get_db),
) -> PromoCodeResponse:
    return service.update_promo_code(db, promo_code_id, payload)
