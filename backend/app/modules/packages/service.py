from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.packages import repository
from app.modules.packages.schemas import (
    PackageDetailResponse,
    PackageListResponse,
    PackageResponse,
)

_DEFAULT_PACKAGE_DEFINITIONS = [
    {
        "name": "Basic",
        "code": "basic",
        "description": "Starter plan for small operations.",
        "price": Decimal("19.00"),
        "billing_period_days": 30,
        "is_active": True,
        "privileges": ["QR_MENU"],
    },
    {
        "name": "Standard",
        "code": "standard",
        "description": "Adds housekeeping and expanded operations.",
        "price": Decimal("49.00"),
        "billing_period_days": 30,
        "is_active": True,
        "privileges": ["QR_MENU", "HOUSEKEEPING"],
    },
    {
        "name": "Premium",
        "code": "premium",
        "description": "Full package with advanced feature flags.",
        "price": Decimal("99.00"),
        "billing_period_days": 30,
        "is_active": True,
        "privileges": ["QR_MENU", "HOUSEKEEPING", "OFFERS"],
    },
]


def ensure_default_packages(db: Session) -> None:
    has_changes = False

    for package_data in _DEFAULT_PACKAGE_DEFINITIONS:
        package = repository.get_package_by_code(db, package_data["code"])
        if package is None:
            package = repository.create_package(
                db,
                name=package_data["name"],
                code=package_data["code"],
                description=package_data["description"],
                price=package_data["price"],
                billing_period_days=package_data["billing_period_days"],
                is_active=package_data["is_active"],
            )
            has_changes = True

        for privilege in package_data["privileges"]:
            existing_privilege = repository.get_package_privilege(db, package.id, privilege)
            if existing_privilege is None:
                repository.add_package_privilege(db, package.id, privilege)
                has_changes = True

    if has_changes:
        db.commit()


def list_active_packages(db: Session) -> PackageListResponse:
    ensure_default_packages(db)
    packages = repository.list_active_packages(db)
    return PackageListResponse(items=[PackageResponse.model_validate(p) for p in packages])


def get_package_detail(db: Session, package_id: int) -> PackageDetailResponse:
    ensure_default_packages(db)
    package = repository.get_package_by_id(db, package_id)
    if package is None or not package.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found.",
        )

    privileges = [p.privilege_code for p in repository.list_package_privileges(db, package.id)]

    return PackageDetailResponse(
        id=package.id,
        name=package.name,
        code=package.code,
        description=package.description,
        price=package.price,
        billing_period_days=package.billing_period_days,
        is_active=package.is_active,
        created_at=package.created_at,
        updated_at=package.updated_at,
        privileges=privileges,
    )
