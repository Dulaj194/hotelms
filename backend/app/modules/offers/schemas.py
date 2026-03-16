from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

OfferTargetTypeValue = Literal["menu", "category", "item"]


class OfferCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=10, max_length=500)
    product_type: OfferTargetTypeValue
    product_id: int = Field(..., gt=0)
    start_date: date
    end_date: date
    is_active: bool = True


class OfferUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=100)
    description: str | None = Field(None, min_length=10, max_length=500)
    product_type: OfferTargetTypeValue | None = None
    product_id: int | None = Field(None, gt=0)
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class OfferImageUploadResponse(BaseModel):
    image_path: str


class OfferResponse(BaseModel):
    id: int
    restaurant_id: int
    title: str
    description: str
    image_path: str | None
    product_type: OfferTargetTypeValue
    product_id: int
    start_date: date
    end_date: date
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OfferListResponse(BaseModel):
    items: list[OfferResponse]
    total: int
