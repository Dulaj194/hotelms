from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_platform_scopes
from app.modules.packages import service
from app.modules.packages.schemas import (
    PackageAdminListResponse,
    PackageCreateRequest,
    PackageDeleteResponse,
    PackageDetailResponse,
    PackageListResponse,
    PackagePrivilegeCatalogResponse,
    PackageUpdateRequest,
)
from app.modules.users.model import User

router = APIRouter()


@router.get("", response_model=PackageListResponse)
def list_packages(db: Session = Depends(get_db)) -> PackageListResponse:
    return service.list_active_packages(db)


@router.get("/admin", response_model=PackageAdminListResponse)
def list_packages_for_super_admin(
    _current_user: User = Depends(require_platform_scopes("billing_admin")),
    db: Session = Depends(get_db),
) -> PackageAdminListResponse:
    return service.list_packages_for_super_admin(db)


@router.get("/admin/privileges", response_model=PackagePrivilegeCatalogResponse)
def list_package_privileges_for_super_admin(
    _current_user: User = Depends(require_platform_scopes("billing_admin")),
) -> PackagePrivilegeCatalogResponse:
    return service.list_package_privilege_catalog()


@router.post("/admin", response_model=PackageDetailResponse, status_code=status.HTTP_201_CREATED)
def create_package_for_super_admin(
    payload: PackageCreateRequest,
    _current_user: User = Depends(require_platform_scopes("billing_admin")),
    db: Session = Depends(get_db),
) -> PackageDetailResponse:
    return service.create_package_for_super_admin(db, payload)


@router.get("/admin/{package_id}", response_model=PackageDetailResponse)
def get_package_for_super_admin(
    package_id: int,
    _current_user: User = Depends(require_platform_scopes("billing_admin")),
    db: Session = Depends(get_db),
) -> PackageDetailResponse:
    return service.get_package_detail(db, package_id)


@router.patch("/admin/{package_id}", response_model=PackageDetailResponse)
def update_package_for_super_admin(
    package_id: int,
    payload: PackageUpdateRequest,
    _current_user: User = Depends(require_platform_scopes("billing_admin")),
    db: Session = Depends(get_db),
) -> PackageDetailResponse:
    return service.update_package_for_super_admin(db, package_id, payload)


@router.delete("/admin/{package_id}", response_model=PackageDeleteResponse)
def delete_package_for_super_admin(
    package_id: int,
    _current_user: User = Depends(require_platform_scopes("billing_admin")),
    db: Session = Depends(get_db),
) -> PackageDeleteResponse:
    return service.delete_package_for_super_admin(db, package_id)


@router.get("/{package_id}", response_model=PackageDetailResponse)
def get_package(package_id: int, db: Session = Depends(get_db)) -> PackageDetailResponse:
    return service.get_package_detail(db, package_id)
