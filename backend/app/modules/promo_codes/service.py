from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.promo_codes import repository
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


def _normalize_code(code: str) -> str:
    return code.strip().upper()


def _is_currently_active(*, valid_from: date, valid_until: date, today: date) -> bool:
    return valid_from <= today <= valid_until


def list_promo_codes(db: Session) -> PromoCodeListResponse:
    rows = repository.list_promo_codes(db)
    items = [PromoCodeResponse.model_validate(row) for row in rows]
    return PromoCodeListResponse(items=items, total=len(items))


def create_promo_code(db: Session, payload: PromoCodeCreateRequest) -> PromoCodeResponse:
    code = _normalize_code(payload.code)

    existing = repository.get_promo_code_by_code(db, code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Promo code '{code}' already exists.",
        )

    row = repository.create_promo_code(
        db,
        code=code,
        discount_percent=payload.discount_percent,
        valid_from=payload.valid_from,
        valid_until=payload.valid_until,
        usage_limit=payload.usage_limit,
        is_active=payload.is_active,
    )
    return PromoCodeResponse.model_validate(row)


def update_promo_code(
    db: Session,
    promo_code_id: int,
    payload: PromoCodeUpdateRequest,
) -> PromoCodeResponse:
    row = repository.get_promo_code_by_id(db, promo_code_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promo code not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "valid_from" in update_data or "valid_until" in update_data:
        next_valid_from = update_data.get("valid_from", row.valid_from)
        next_valid_until = update_data.get("valid_until", row.valid_until)
        if next_valid_until < next_valid_from:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="valid_until cannot be before valid_from.",
            )

    updated = repository.update_promo_code(db, row, update_data)
    return PromoCodeResponse.model_validate(updated)


def validate_promo_for_restaurant(
    db: Session,
    *,
    restaurant_id: int,
    payload: PromoCodeValidateRequest,
) -> PromoCodeValidationResponse:
    code = _normalize_code(payload.code)
    row = repository.get_promo_code_by_code(db, code)
    if not row:
        return PromoCodeValidationResponse(valid=False, message="Invalid promo code.")

    if not row.is_active:
        return PromoCodeValidationResponse(
            valid=False,
            message=f"Promo code '{code}' is inactive.",
            code=code,
            usage_limit=row.usage_limit,
            global_used_count=row.used_count,
        )

    today = datetime.now(UTC).date()
    if not _is_currently_active(valid_from=row.valid_from, valid_until=row.valid_until, today=today):
        return PromoCodeValidationResponse(
            valid=False,
            message=f"Promo code '{code}' has expired or is not yet active.",
            code=code,
            usage_limit=row.usage_limit,
            global_used_count=row.used_count,
        )

    usage = repository.get_promo_usage(db, restaurant_id=restaurant_id, promo_code_id=row.id)
    restaurant_used_count = usage.used_count if usage else 0

    if row.usage_limit is not None and row.used_count >= row.usage_limit:
        return PromoCodeValidationResponse(
            valid=False,
            message=f"Promo code '{code}' reached its global usage limit.",
            code=code,
            usage_limit=row.usage_limit,
            global_used_count=row.used_count,
            restaurant_used_count=restaurant_used_count,
        )

    if row.usage_limit is not None and restaurant_used_count >= row.usage_limit:
        return PromoCodeValidationResponse(
            valid=False,
            message=f"Promo code '{code}' reached its usage limit for this restaurant.",
            code=code,
            usage_limit=row.usage_limit,
            global_used_count=row.used_count,
            restaurant_used_count=restaurant_used_count,
        )

    return PromoCodeValidationResponse(
        valid=True,
        message=f"Promo code '{code}' applied.",
        code=code,
        discount_percent=float(row.discount_percent),
        usage_limit=row.usage_limit,
        global_used_count=row.used_count,
        restaurant_used_count=restaurant_used_count,
    )


def consume_promo_for_restaurant(
    db: Session,
    *,
    restaurant_id: int,
    payload: PromoCodeConsumeRequest,
) -> PromoCodeUsageResponse:
    validation = validate_promo_for_restaurant(
        db,
        restaurant_id=restaurant_id,
        payload=PromoCodeValidateRequest(code=payload.code),
    )
    if not validation.valid or not validation.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation.message,
        )

    promo = repository.get_promo_code_by_code(db, validation.code)
    if not promo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promo code not found.",
        )

    usage = repository.increment_promo_usage(
        db,
        promo_code=promo,
        restaurant_id=restaurant_id,
        increment=payload.increment,
        used_at=datetime.now(UTC),
    )

    return PromoCodeUsageResponse(
        code=promo.code,
        restaurant_id=restaurant_id,
        used_count=usage.used_count,
        global_used_count=promo.used_count,
        last_used_at=usage.last_used_at,
        message=f"Promo code '{promo.code}' usage updated.",
    )
