from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.packages import repository
from app.modules.packages.schemas import (
    PackageAdminListResponse,
    PackageCreateRequest,
    PackageDeleteResponse,
    PackageDetailResponse,
    PackageListResponse,
    PackagePrivilegeCatalogItem,
    PackagePrivilegeCatalogResponse,
    PackageResponse,
    PackageUpdateRequest,
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

_PACKAGE_PRIVILEGE_CATALOG = {
    "QR_MENU": {
        "label": "QR Menu",
        "description": "Enables table and room QR ordering operations.",
    },
    "HOUSEKEEPING": {
        "label": "Housekeeping",
        "description": "Enables housekeeping workflows and room task management.",
    },
    "OFFERS": {
        "label": "Offers",
        "description": "Enables promotional offers and discount campaign tools.",
    },
}


def _serialize_package_detail(db: Session, package) -> PackageDetailResponse:
    privileges = [
        privilege.privilege_code for privilege in repository.list_package_privileges(db, package.id)
    ]
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


def _validate_privileges(privileges: list[str]) -> list[str]:
    invalid = sorted({value for value in privileges if value not in _PACKAGE_PRIVILEGE_CATALOG})
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported privilege code(s): {', '.join(invalid)}",
        )
    return privileges


def ensure_default_packages(db: Session, *, commit: bool = True) -> None:
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

    if has_changes and commit:
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

    return _serialize_package_detail(db, package)


def list_package_privilege_catalog() -> PackagePrivilegeCatalogResponse:
    items = [
        PackagePrivilegeCatalogItem(code=code, **metadata)
        for code, metadata in _PACKAGE_PRIVILEGE_CATALOG.items()
    ]
    return PackagePrivilegeCatalogResponse(items=items)


def list_packages_for_super_admin(db: Session) -> PackageAdminListResponse:
    ensure_default_packages(db)
    packages = repository.list_all_packages(db)
    items = [_serialize_package_detail(db, package) for package in packages]
    return PackageAdminListResponse(items=items, total=len(items))


def create_package_for_super_admin(
    db: Session,
    payload: PackageCreateRequest,
) -> PackageDetailResponse:
    ensure_default_packages(db)
    _validate_privileges(payload.privileges)

    existing = repository.get_package_by_code(db, payload.code)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Package code '{payload.code}' already exists.",
        )

    package = repository.create_package(
        db,
        name=payload.name.strip(),
        code=payload.code,
        description=payload.description.strip() if payload.description else None,
        price=payload.price,
        billing_period_days=payload.billing_period_days,
        is_active=payload.is_active,
    )
    for privilege in payload.privileges:
        repository.add_package_privilege(db, package.id, privilege)

    db.commit()
    db.refresh(package)
    return _serialize_package_detail(db, package)


def update_package_for_super_admin(
    db: Session,
    package_id: int,
    payload: PackageUpdateRequest,
) -> PackageDetailResponse:
    ensure_default_packages(db)
    package = repository.get_package_by_id(db, package_id)
    if package is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "code" in update_data:
        existing = repository.get_package_by_code(db, update_data["code"])
        if existing is not None and existing.id != package.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Package code '{update_data['code']}' already exists.",
            )
    if "name" in update_data and update_data["name"] is not None:
        update_data["name"] = update_data["name"].strip()
    if "description" in update_data and update_data["description"] is not None:
        update_data["description"] = update_data["description"].strip() or None
    if "privileges" in update_data:
        privileges = _validate_privileges(update_data.pop("privileges"))
    else:
        privileges = None

    repository.update_package(db, package, update_data=update_data)
    if privileges is not None:
        repository.delete_package_privileges(db, package.id)
        for privilege in privileges:
            repository.add_package_privilege(db, package.id, privilege)

    db.commit()
    db.refresh(package)
    return _serialize_package_detail(db, package)


def delete_package_for_super_admin(
    db: Session,
    package_id: int,
) -> PackageDeleteResponse:
    ensure_default_packages(db)
    package = repository.get_package_by_id(db, package_id)
    if package is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found.",
        )

    active_subscriptions = repository.count_package_subscriptions(db, package.id)
    if active_subscriptions > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Package cannot be deleted because it is linked to subscriptions.",
        )

    repository.delete_package(db, package)
    db.commit()
    return PackageDeleteResponse(
        message="Package deleted successfully.",
        package_id=package_id,
    )
