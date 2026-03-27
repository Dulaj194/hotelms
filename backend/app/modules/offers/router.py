from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_privilege, require_roles
from app.modules.offers import service
from app.modules.offers.schemas import (
    OfferCreateRequest,
    OfferImageUploadResponse,
    OfferListResponse,
    OfferResponse,
    OfferUpdateRequest,
)
from app.modules.users.model import User

router = APIRouter()


def _require_offers_restaurant_id(
    current_user: User = Depends(require_roles("owner", "admin")),
    _: None = Depends(require_privilege("OFFERS")),
) -> int:
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return current_user.restaurant_id


@router.get("", response_model=OfferListResponse)
def list_offers(
    restaurant_id: int = Depends(_require_offers_restaurant_id),
    db: Session = Depends(get_db),
) -> OfferListResponse:
    return service.list_offers(db, restaurant_id)


@router.post("", response_model=OfferResponse, status_code=status.HTTP_201_CREATED)
def add_offer(
    payload: OfferCreateRequest,
    restaurant_id: int = Depends(_require_offers_restaurant_id),
    db: Session = Depends(get_db),
) -> OfferResponse:
    return service.add_offer(db, restaurant_id, payload)


@router.get("/{offer_id}", response_model=OfferResponse)
def get_offer(
    offer_id: int,
    restaurant_id: int = Depends(_require_offers_restaurant_id),
    db: Session = Depends(get_db),
) -> OfferResponse:
    return service.get_offer(db, offer_id, restaurant_id)


@router.patch("/{offer_id}", response_model=OfferResponse)
def update_offer(
    offer_id: int,
    payload: OfferUpdateRequest,
    restaurant_id: int = Depends(_require_offers_restaurant_id),
    db: Session = Depends(get_db),
) -> OfferResponse:
    return service.update_offer(db, offer_id, restaurant_id, payload)


@router.delete("/{offer_id}")
def delete_offer(
    offer_id: int,
    restaurant_id: int = Depends(_require_offers_restaurant_id),
    db: Session = Depends(get_db),
) -> dict:
    return service.delete_offer(db, offer_id, restaurant_id)


@router.post("/{offer_id}/image", response_model=OfferImageUploadResponse)
async def upload_offer_image(
    offer_id: int,
    file: UploadFile = File(...),
    restaurant_id: int = Depends(_require_offers_restaurant_id),
    db: Session = Depends(get_db),
) -> OfferImageUploadResponse:
    return await service.upload_offer_image(db, offer_id, restaurant_id, file)
