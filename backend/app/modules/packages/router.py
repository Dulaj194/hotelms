from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.modules.packages import service
from app.modules.packages.schemas import (
    PackageDetailResponse,
    PackageListResponse,
)

router = APIRouter()


@router.get("", response_model=PackageListResponse)
def list_packages(db: Session = Depends(get_db)) -> PackageListResponse:
    return service.list_active_packages(db)


@router.get("/{package_id}", response_model=PackageDetailResponse)
def get_package(package_id: int, db: Session = Depends(get_db)) -> PackageDetailResponse:
    return service.get_package_detail(db, package_id)
