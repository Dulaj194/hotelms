from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class QuickServiceBase(BaseModel):
    label: str = Field(..., min_length=1, max_length=50)
    message: str = Field(..., min_length=1)
    icon_name: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class QuickServiceCreate(QuickServiceBase):
    pass


class QuickServiceUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=50)
    message: Optional[str] = None
    icon_name: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class QuickServiceResponse(QuickServiceBase):
    id: int
    restaurant_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
