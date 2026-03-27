from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Callable

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.categories import repository as category_repo
from app.modules.items import repository as item_repo
from app.modules.menus import repository as menu_repo
from app.modules.offers import repository
from app.modules.offers.schemas import (
    OfferCreateRequest,
    OfferImageUploadResponse,
    OfferListResponse,
    OfferResponse,
    OfferUpdateRequest,
)

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_EXT_MAP = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_MAX_OFFERS_PER_START_DATE = 3
_TARGET_LOOKUPS: dict[str, Callable[[Session, int, int], object | None]] = {
    "menu": menu_repo.get_by_id,
    "category": category_repo.get_by_id,
    "item": item_repo.get_by_id,
}


def _validate_dates(
    start_date: date,
    end_date: date,
    *,
    allow_past_start_date: bool = False,
) -> None:
    today = datetime.now(UTC).date()
    if start_date < today and not allow_past_start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Start date cannot be in the past.",
        )
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="End date cannot be earlier than start date.",
        )


def _validate_target(db: Session, restaurant_id: int, product_type: str, product_id: int) -> None:
    lookup = _TARGET_LOOKUPS.get(product_type)
    if lookup is None or lookup(db, product_id, restaurant_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Selected {product_type} was not found for this restaurant.",
        )


def _enforce_daily_limit(
    db: Session,
    restaurant_id: int,
    start_date: date,
    exclude_offer_id: int | None = None,
) -> None:
    count = repository.count_by_start_date(db, restaurant_id, start_date, exclude_offer_id)
    if count >= _MAX_OFFERS_PER_START_DATE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"You can only add a maximum of {_MAX_OFFERS_PER_START_DATE} "
                "offers for the same start date."
            ),
        )


def _to_offer_upload_file_path(image_path: str | None) -> Path | None:
    if not image_path or not image_path.startswith("/uploads/offers/"):
        return None

    filename = Path(image_path).name
    if not filename:
        return None

    return Path(settings.upload_dir) / "offers" / filename


def _safe_delete_file(path: Path | None) -> None:
    if path is None:
        return
    try:
        path.unlink()
    except FileNotFoundError:
        return
    except OSError:
        return


def list_offers(db: Session, restaurant_id: int) -> OfferListResponse:
    items = repository.list_by_restaurant(db, restaurant_id)
    return OfferListResponse(
        items=[OfferResponse.model_validate(item) for item in items],
        total=len(items),
    )


def get_offer(db: Session, offer_id: int, restaurant_id: int) -> OfferResponse:
    offer = repository.get_by_id(db, offer_id, restaurant_id)
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found.")
    return OfferResponse.model_validate(offer)


def add_offer(db: Session, restaurant_id: int, data: OfferCreateRequest) -> OfferResponse:
    _validate_dates(data.start_date, data.end_date)
    _validate_target(db, restaurant_id, data.product_type, data.product_id)
    _enforce_daily_limit(db, restaurant_id, data.start_date)
    offer = repository.create(db, restaurant_id, data)
    return OfferResponse.model_validate(offer)


def update_offer(
    db: Session,
    offer_id: int,
    restaurant_id: int,
    data: OfferUpdateRequest,
) -> OfferResponse:
    current = repository.get_by_id(db, offer_id, restaurant_id)
    if not current:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found.")

    next_start = data.start_date if data.start_date is not None else current.start_date
    next_end = data.end_date if data.end_date is not None else current.end_date
    next_type = data.product_type if data.product_type is not None else current.product_type.value
    next_product_id = data.product_id if data.product_id is not None else current.product_id

    _validate_dates(
        next_start,
        next_end,
        allow_past_start_date=next_start == current.start_date,
    )
    _validate_target(db, restaurant_id, next_type, next_product_id)
    _enforce_daily_limit(db, restaurant_id, next_start, offer_id)

    offer = repository.update_by_id(db, offer_id, restaurant_id, data)
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found.")
    return OfferResponse.model_validate(offer)


def delete_offer(db: Session, offer_id: int, restaurant_id: int) -> dict:
    deleted = repository.delete_by_id(db, offer_id, restaurant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found.")
    return {"message": "Offer deleted."}


async def upload_offer_image(
    db: Session,
    offer_id: int,
    restaurant_id: int,
    file: UploadFile,
) -> OfferImageUploadResponse:
    current_offer = repository.get_by_id(db, offer_id, restaurant_id)
    if not current_offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found.")

    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Allowed: jpg, png, webp, gif.",
        )

    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.max_upload_size_mb} MB size limit.",
        )

    ext = _EXT_MAP[file.content_type]
    filename = f"{uuid.uuid4().hex}{ext}"
    upload_path = Path(settings.upload_dir) / "offers"
    upload_path.mkdir(parents=True, exist_ok=True)
    new_file_path = upload_path / filename
    try:
        new_file_path.write_bytes(content)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store the uploaded image.",
        ) from exc

    image_path = f"/uploads/offers/{filename}"
    previous_image_file = _to_offer_upload_file_path(current_offer.image_path)
    offer = repository.update_image_path(db, offer_id, restaurant_id, image_path)
    if not offer:
        _safe_delete_file(new_file_path)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found.")

    if previous_image_file and previous_image_file != new_file_path:
        _safe_delete_file(previous_image_file)

    return OfferImageUploadResponse(image_path=image_path)
