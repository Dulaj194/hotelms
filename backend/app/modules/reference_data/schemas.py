from __future__ import annotations

from pydantic import BaseModel


class CountryResponse(BaseModel):
    id: int
    name: str
    iso2: str | None

    model_config = {"from_attributes": True}


class CurrencyTypeResponse(BaseModel):
    id: int
    code: str
    name: str
    symbol: str | None

    model_config = {"from_attributes": True}


class CountryListResponse(BaseModel):
    items: list[CountryResponse]
    total: int


class CurrencyTypeListResponse(BaseModel):
    items: list[CurrencyTypeResponse]
    total: int
