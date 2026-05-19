from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_platform_scopes
from app.core.response_utils import success_response
from app.modules.platform_banners import service
from app.modules.platform_banners.schemas import (
    ActiveBannersGrouped,
    PlatformBannerCreate,
    PlatformBannerResponse,
    PlatformBannerUpdate,
)

# Management router (Super Admin only)
super_admin_router = APIRouter(prefix="/super-admin/banners", tags=["super-admin-banners"])

# Client router (Accessible to all authenticated staff on dashboard load)
client_router = APIRouter(prefix="/dashboard/banners", tags=["dashboard-banners"])


@super_admin_router.post(
    "",
    response_model=Any,
    status_code=status.HTTP_201_CREATED,
)
def create_banner(
    banner_data: PlatformBannerCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_platform_scopes("tenant_admin")),
) -> Any:
    """Create a new platform-wide banner (Super Admin only)."""
    banner = service.create_platform_banner(db, banner_data, current_user.id)
    return success_response(
        data=PlatformBannerResponse.model_validate(banner),
        message="Platform banner created successfully."
    )


@super_admin_router.get(
    "",
    response_model=Any,
)
def list_banners(
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_platform_scopes("ops_viewer", "tenant_admin")),
) -> Any:
    """List all platform banners including active, inactive, and expired (Super Admin only)."""
    banners = service.list_banners(db)
    banner_responses = [PlatformBannerResponse.model_validate(b) for b in banners]
    return success_response(
        data=banner_responses,
        message="Platform banners retrieved successfully."
    )


@super_admin_router.patch(
    "/{banner_id}",
    response_model=Any,
)
def update_banner(
    banner_id: int,
    update_data: PlatformBannerUpdate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_platform_scopes("tenant_admin")),
) -> Any:
    """Update platform banner details (Super Admin only)."""
    banner = service.update_platform_banner(db, banner_id, update_data)
    return success_response(
        data=PlatformBannerResponse.model_validate(banner),
        message="Platform banner updated successfully."
    )


@super_admin_router.delete(
    "/{banner_id}",
    status_code=status.HTTP_200_OK,
)
def delete_banner(
    banner_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_platform_scopes("tenant_admin")),
) -> Any:
    """Delete a platform banner (Super Admin only)."""
    service.delete_platform_banner(db, banner_id)
    return success_response(
        message=f"Platform banner {banner_id} deleted successfully."
    )


@client_router.get(
    "/active",
    response_model=Any,
)
def get_active_banners(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Fetch currently active scheduled banners grouped by promotional and system_alert categories."""
    grouped_banners = service.get_active_banners_grouped(db)
    return success_response(
        data=grouped_banners.model_dump(),
        message="Active platform banners retrieved successfully."
    )
