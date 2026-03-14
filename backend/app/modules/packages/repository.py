from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.packages.model import Package, PackagePrivilege


def list_active_packages(db: Session) -> Sequence[Package]:
    return (
        db.query(Package)
        .filter(Package.is_active.is_(True))
        .order_by(Package.price.asc(), Package.id.asc())
        .all()
    )


def get_package_by_id(db: Session, package_id: int) -> Package | None:
    return db.query(Package).filter(Package.id == package_id).first()


def get_package_by_code(db: Session, code: str) -> Package | None:
    return db.query(Package).filter(Package.code == code.lower()).first()


def create_package(
    db: Session,
    *,
    name: str,
    code: str,
    description: str | None,
    price: Decimal,
    billing_period_days: int,
    is_active: bool,
) -> Package:
    package = Package(
        name=name,
        code=code.lower(),
        description=description,
        price=price,
        billing_period_days=billing_period_days,
        is_active=is_active,
    )
    db.add(package)
    db.flush()
    db.refresh(package)
    return package


def list_package_privileges(db: Session, package_id: int) -> Sequence[PackagePrivilege]:
    return (
        db.query(PackagePrivilege)
        .filter(PackagePrivilege.package_id == package_id)
        .order_by(PackagePrivilege.privilege_code.asc())
        .all()
    )


def get_package_privilege(
    db: Session,
    package_id: int,
    privilege_code: str,
) -> PackagePrivilege | None:
    return (
        db.query(PackagePrivilege)
        .filter(
            PackagePrivilege.package_id == package_id,
            PackagePrivilege.privilege_code == privilege_code.upper(),
        )
        .first()
    )


def add_package_privilege(
    db: Session,
    package_id: int,
    privilege_code: str,
) -> PackagePrivilege:
    privilege = PackagePrivilege(
        package_id=package_id,
        privilege_code=privilege_code.upper(),
    )
    db.add(privilege)
    db.flush()
    db.refresh(privilege)
    return privilege
