from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.modules.offers.model import Offer, OfferTargetType
from app.modules.offers.schemas import OfferCreateRequest, OfferUpdateRequest


def get_by_id(db: Session, offer_id: int, restaurant_id: int) -> Offer | None:
    return (
        db.query(Offer)
        .filter(Offer.id == offer_id, Offer.restaurant_id == restaurant_id)
        .first()
    )


def list_by_restaurant(db: Session, restaurant_id: int) -> list[Offer]:
    return (
        db.query(Offer)
        .filter(Offer.restaurant_id == restaurant_id)
        .order_by(Offer.start_date.desc(), Offer.id.desc())
        .all()
    )


def count_by_start_date(
    db: Session,
    restaurant_id: int,
    start_date: date,
    exclude_offer_id: int | None = None,
) -> int:
    query = db.query(Offer).filter(
        Offer.restaurant_id == restaurant_id,
        Offer.start_date == start_date,
    )
    if exclude_offer_id is not None:
        query = query.filter(Offer.id != exclude_offer_id)
    return query.count()


def create(db: Session, restaurant_id: int, data: OfferCreateRequest) -> Offer:
    offer = Offer(
        restaurant_id=restaurant_id,
        title=data.title,
        description=data.description,
        product_type=OfferTargetType(data.product_type),
        product_id=data.product_id,
        start_date=data.start_date,
        end_date=data.end_date,
        is_active=data.is_active,
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


def update_by_id(
    db: Session,
    offer_id: int,
    restaurant_id: int,
    data: OfferUpdateRequest,
) -> Offer | None:
    offer = get_by_id(db, offer_id, restaurant_id)
    if not offer:
        return None

    updates = data.model_dump(exclude_unset=True)
    if "product_type" in updates and updates["product_type"] is not None:
        updates["product_type"] = OfferTargetType(updates["product_type"])

    for field, value in updates.items():
        setattr(offer, field, value)

    db.commit()
    db.refresh(offer)
    return offer


def update_image_path(
    db: Session,
    offer_id: int,
    restaurant_id: int,
    image_path: str,
) -> Offer | None:
    offer = get_by_id(db, offer_id, restaurant_id)
    if not offer:
        return None
    offer.image_path = image_path
    db.commit()
    db.refresh(offer)
    return offer


def delete_by_id(db: Session, offer_id: int, restaurant_id: int) -> bool:
    offer = get_by_id(db, offer_id, restaurant_id)
    if not offer:
        return False
    db.delete(offer)
    db.commit()
    return True
