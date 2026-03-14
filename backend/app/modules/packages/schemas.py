from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class PackageResponse(BaseModel):
    id: int
    name: str
    code: str
    description: str | None
    price: Decimal
    billing_period_days: int
    is_active: bool

    model_config = {"from_attributes": True}


class PackageDetailResponse(PackageResponse):
    privileges: list[str]
    created_at: datetime
    updated_at: datetime


class PackageListResponse(BaseModel):
    items: list[PackageResponse]
