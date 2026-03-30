from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.modules.promo_codes.model import PromoCode, PromoCodeUsage


def list_promo_codes(db: Session) -> list[PromoCode]:
    return db.query(PromoCode).order_by(PromoCode.created_at.desc(), PromoCode.id.desc()).all()


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
