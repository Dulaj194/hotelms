from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.reference_data.model import Country, CurrencyType


def count_countries(db: Session) -> int:
    return db.query(Country).count()


def count_currencies(db: Session) -> int:
    return db.query(CurrencyType).count()


def create_country(
    db: Session,
    *,
    name: str,
    iso2: str | None = None,
) -> Country:
    row = Country(name=name, iso2=iso2, is_active=True)
    db.add(row)
    db.flush()
    return row


def create_currency(
    db: Session,
    *,
    code: str,
    name: str,
    symbol: str | None = None,
) -> CurrencyType:
    row = CurrencyType(code=code.upper(), name=name, symbol=symbol, is_active=True)
    db.add(row)
    db.flush()
    return row


def list_active_countries(db: Session) -> list[Country]:
    return (
        db.query(Country)
        .filter(Country.is_active.is_(True))
        .order_by(Country.name.asc())
        .all()
    )


def list_active_currencies(db: Session) -> list[CurrencyType]:
    return (
        db.query(CurrencyType)
        .filter(CurrencyType.is_active.is_(True))
        .order_by(CurrencyType.code.asc())
        .all()
    )


def get_country_by_id(db: Session, country_id: int) -> Country | None:
    return db.query(Country).filter(Country.id == country_id).first()


def get_country_by_name(db: Session, country_name: str) -> Country | None:
    normalized = country_name.strip().lower()
    if not normalized:
        return None
    return (
        db.query(Country)
        .filter(func.lower(Country.name) == normalized)
        .first()
    )


def get_currency_by_id(db: Session, currency_id: int) -> CurrencyType | None:
    return db.query(CurrencyType).filter(CurrencyType.id == currency_id).first()


def get_currency_by_code_or_name(db: Session, value: str) -> CurrencyType | None:
    normalized = value.strip().lower()
    if not normalized:
        return None
    return (
        db.query(CurrencyType)
        .filter(
            (func.lower(CurrencyType.code) == normalized)
            | (func.lower(CurrencyType.name) == normalized)
        )
        .first()
    )
