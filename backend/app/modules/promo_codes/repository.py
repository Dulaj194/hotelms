from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.modules.promo_codes.model import PromoCode, PromoCodeUsage


from sqlalchemy import or_

def list_promo_codes(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
) -> tuple[list[PromoCode], int]:
    query = db.query(PromoCode)
    
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(PromoCode.code.ilike(pattern))
        
    total = query.count()
    
    # Sorting
    if sort_by == "code":
        order_col = PromoCode.code
    elif sort_by == "discount_percent":
        order_col = PromoCode.discount_percent
    elif sort_by == "valid_from":
        order_col = PromoCode.valid_from
    elif sort_by == "valid_until":
        order_col = PromoCode.valid_until
    else:
        order_col = PromoCode.created_at
        
    if sort_order.lower() == "asc":
        query = query.order_by(order_col.asc(), PromoCode.id.asc())
    else:
        query = query.order_by(order_col.desc(), PromoCode.id.desc())
        
    items = query.offset(skip).limit(limit).all()
    return items, total


def get_promo_code_by_id(db: Session, promo_code_id: int) -> PromoCode | None:
    return db.query(PromoCode).filter(PromoCode.id == promo_code_id).first()


def get_promo_code_by_code(db: Session, code: str) -> PromoCode | None:
    return db.query(PromoCode).filter(PromoCode.code == code).first()


def create_promo_code(
    db: Session,
    *,
    code: str,
    discount_percent: float,
    valid_from,
    valid_until,
    usage_limit: int | None,
    is_active: bool,
) -> PromoCode:
    row = PromoCode(
        code=code,
        discount_percent=discount_percent,
        valid_from=valid_from,
        valid_until=valid_until,
        usage_limit=usage_limit,
        is_active=is_active,
        used_count=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_promo_code(db: Session, row: PromoCode, update_data: dict) -> PromoCode:
    for field, value in update_data.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def get_promo_usage(
    db: Session,
    *,
    restaurant_id: int,
    promo_code_id: int,
) -> PromoCodeUsage | None:
    return (
        db.query(PromoCodeUsage)
        .filter(
            PromoCodeUsage.restaurant_id == restaurant_id,
            PromoCodeUsage.promo_code_id == promo_code_id,
        )
        .first()
    )


def increment_promo_usage(
    db: Session,
    *,
    promo_code: PromoCode,
    restaurant_id: int,
    increment: int,
    used_at: datetime,
) -> PromoCodeUsage:
    usage = get_promo_usage(
        db,
        restaurant_id=restaurant_id,
        promo_code_id=promo_code.id,
    )
    if usage is None:
        usage = PromoCodeUsage(
            restaurant_id=restaurant_id,
            promo_code_id=promo_code.id,
            used_count=0,
        )
        db.add(usage)
        db.flush()

    usage.used_count += increment
    usage.last_used_at = used_at
    promo_code.used_count += increment
    db.commit()
    db.refresh(usage)
    db.refresh(promo_code)
    return usage
