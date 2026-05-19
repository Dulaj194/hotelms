from __future__ import annotations

from datetime import datetime
from typing import Sequence

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.modules.platform_banners.model import PlatformBanner
from app.modules.platform_banners.schemas import PlatformBannerCreate, PlatformBannerUpdate


def get_banner_by_id(db: Session, banner_id: int) -> PlatformBanner | None:
    return db.query(PlatformBanner).filter(PlatformBanner.id == banner_id).first()


def list_all_banners(db: Session) -> Sequence[PlatformBanner]:
    return db.query(PlatformBanner).order_by(PlatformBanner.created_at.desc()).all()


def create_banner(
    db: Session, banner_data: PlatformBannerCreate, user_id: int
) -> PlatformBanner:
    db_banner = PlatformBanner(
        title=banner_data.title,
        content=banner_data.content,
        category=banner_data.category,
        type=banner_data.type,
        image_url=banner_data.image_url,
        cta_link=banner_data.cta_link,
        cta_label=banner_data.cta_label,
        is_active=banner_data.is_active,
        starts_at=banner_data.starts_at,
        ends_at=banner_data.ends_at,
        dismissible=banner_data.dismissible,
        created_by_id=user_id,
    )
    db.add(db_banner)
    db.commit()
    db.refresh(db_banner)
    return db_banner


def update_banner(
    db: Session, db_banner: PlatformBanner, update_data: PlatformBannerUpdate
) -> PlatformBanner:
    banner_dict = update_data.model_dump(exclude_unset=True)
    for field, value in banner_dict.items():
        setattr(db_banner, field, value)
    
    db_banner.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_banner)
    return db_banner


def delete_banner(db: Session, db_banner: PlatformBanner) -> None:
    db.delete(db_banner)
    db.commit()


def get_active_banners(db: Session) -> Sequence[PlatformBanner]:
    """Fetch active banners that are currently scheduled to be displayed."""
    now = datetime.utcnow()
    return (
        db.query(PlatformBanner)
        .filter(
            and_(
                PlatformBanner.is_active == True,
                or_(
                    PlatformBanner.starts_at == None,
                    PlatformBanner.starts_at <= now,
                ),
                or_(
                    PlatformBanner.ends_at == None,
                    PlatformBanner.ends_at >= now,
                ),
            )
        )
        .order_by(PlatformBanner.created_at.desc())
        .all()
    )
