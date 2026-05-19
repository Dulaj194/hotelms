from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.modules.platform_banners.model import BannerCategory, BannerType


class PlatformBannerBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    category: BannerCategory = Field(default=BannerCategory.promotional)
    type: BannerType = Field(default=BannerType.info)
    image_url: Optional[str] = Field(default=None, max_length=500)
    cta_link: Optional[str] = Field(default=None, max_length=500)
    cta_label: Optional[str] = Field(default=None, max_length=64)
    is_active: bool = Field(default=True)
    starts_at: Optional[datetime] = Field(default=None)
    ends_at: Optional[datetime] = Field(default=None)
    dismissible: bool = Field(default=True)


class PlatformBannerCreate(PlatformBannerBase):
    pass


class PlatformBannerUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    content: Optional[str] = Field(default=None, min_length=1)
    category: Optional[BannerCategory] = Field(default=None)
    type: Optional[BannerType] = Field(default=None)
    image_url: Optional[str] = Field(default=None, max_length=500)
    cta_link: Optional[str] = Field(default=None, max_length=500)
    cta_label: Optional[str] = Field(default=None, max_length=64)
    is_active: Optional[bool] = Field(default=None)
    starts_at: Optional[datetime] = Field(default=None)
    ends_at: Optional[datetime] = Field(default=None)
    dismissible: Optional[bool] = Field(default=None)


class PlatformBannerResponse(PlatformBannerBase):
    id: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActiveBannersGrouped(BaseModel):
    promotional: list[PlatformBannerResponse] = Field(default_factory=list)
    system_alert: list[PlatformBannerResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
