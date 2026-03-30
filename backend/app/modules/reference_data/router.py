from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.modules.reference_data import service
from app.modules.reference_data.schemas import (
    CountryListResponse,
    CurrencyTypeListResponse,
)

router = APIRouter()


@router.get("/countries", response_model=CountryListResponse)
def list_countries(
    db: Session = Depends(get_db),
) -> CountryListResponse:
    return service.list_countries(db)


@router.get("/currencies", response_model=CurrencyTypeListResponse)
def list_currencies(
    db: Session = Depends(get_db),
) -> CurrencyTypeListResponse:
    return service.list_currencies(db)
