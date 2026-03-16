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


@router.get("", response_model=OfferListResponse)
def list_offers(
    current_user: User = Depends(require_roles("owner", "admin")),
    _=Depends(require_privilege("OFFERS")),
    db: Session = Depends(get_db),
) -> OfferListResponse:
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.list_offers(db, current_user.restaurant_id)


@router.post("", response_model=OfferResponse, status_code=status.HTTP_201_CREATED)
def add_offer(
    payload: OfferCreateRequest,
    current_user: User = Depends(require_roles("owner", "admin")),
    _=Depends(require_privilege("OFFERS")),
    db: Session = Depends(get_db),
) -> OfferResponse:
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.add_offer(db, current_user.restaurant_id, payload)


@router.get("/{offer_id}", response_model=OfferResponse)
def get_offer(
    offer_id: int,
    current_user: User = Depends(require_roles("owner", "admin")),
    _=Depends(require_privilege("OFFERS")),
    db: Session = Depends(get_db),
) -> OfferResponse:
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.get_offer(db, offer_id, current_user.restaurant_id)


@router.patch("/{offer_id}", response_model=OfferResponse)
def update_offer(
    offer_id: int,
    payload: OfferUpdateRequest,
    current_user: User = Depends(require_roles("owner", "admin")),
    _=Depends(require_privilege("OFFERS")),
    db: Session = Depends(get_db),
) -> OfferResponse:
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.update_offer(db, offer_id, current_user.restaurant_id, payload)


@router.delete("/{offer_id}")
def delete_offer(
    offer_id: int,
    current_user: User = Depends(require_roles("owner", "admin")),
    _=Depends(require_privilege("OFFERS")),
    db: Session = Depends(get_db),
) -> dict:
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.delete_offer(db, offer_id, current_user.restaurant_id)


@router.post("/{offer_id}/image", response_model=OfferImageUploadResponse)
async def upload_offer_image(
    offer_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("owner", "admin")),
    _=Depends(require_privilege("OFFERS")),
    db: Session = Depends(get_db),
) -> OfferImageUploadResponse:
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return await service.upload_offer_image(db, offer_id, current_user.restaurant_id, file)
