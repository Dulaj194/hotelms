from __future__ import annotations

from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.platform_banners import repository
from app.modules.platform_banners.model import BannerCategory, PlatformBanner
from app.modules.platform_banners.schemas import (
    ActiveBannersGrouped,
    PlatformBannerCreate,
    PlatformBannerUpdate,
)


def create_platform_banner(
    db: Session, banner_data: PlatformBannerCreate, user_id: int
) -> PlatformBanner:
    return repository.create_banner(db, banner_data, user_id)


def get_banner(db: Session, banner_id: int) -> PlatformBanner:
    db_banner = repository.get_banner_by_id(db, banner_id)
    if not db_banner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Platform banner with ID {banner_id} not found.",
        )
    return db_banner


def list_banners(db: Session) -> Sequence[PlatformBanner]:
    return repository.list_all_banners(db)


def update_platform_banner(
    db: Session, banner_id: int, update_data: PlatformBannerUpdate
) -> PlatformBanner:
    db_banner = get_banner(db, banner_id)
    return repository.update_banner(db, db_banner, update_data)


def delete_platform_banner(db: Session, banner_id: int) -> None:
    db_banner = get_banner(db, banner_id)
    repository.delete_banner(db, db_banner)


def get_active_banners_grouped(db: Session) -> ActiveBannersGrouped:
    active_banners = repository.get_active_banners(db)
    
    promotional = []
    system_alert = []
    
    for banner in active_banners:
        if banner.category == BannerCategory.promotional:
            promotional.append(banner)
        elif banner.category == BannerCategory.system_alert:
            system_alert.append(banner)
            
    return ActiveBannersGrouped(
        promotional=promotional,
        system_alert=system_alert
    )
