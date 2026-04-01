from sqlalchemy.orm import Session

from app.modules.restaurants.model import RegistrationStatus, Restaurant
from app.modules.users.model import User, UserRole

# ─── Tenant-safe access ───────────────────────────────────────────────────────
#
# DESIGN: Repository methods for tenant-owned data explicitly require
# restaurant_id at the call site. This forces callers (service layer) to supply
# the authenticated tenant context rather than accepting an arbitrary ID.


def get_by_id(db: Session, restaurant_id: int) -> Restaurant | None:
    """Fetch a restaurant by its primary key.

    restaurant_id must always come from the authenticated user context,
    never from a client-supplied request parameter.
    """
    return db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()


def update_profile(
    db: Session,
    restaurant_id: int,
    update_data: dict,
) -> Restaurant | None:
    """Update allowed profile fields. Only fields in the payload are changed."""
    restaurant = get_by_id(db, restaurant_id)
    if not restaurant:
        return None

    for field, value in update_data.items():
        setattr(restaurant, field, value)

    db.commit()
    db.refresh(restaurant)
    return restaurant


def update_logo(db: Session, restaurant_id: int, logo_url: str) -> Restaurant | None:
    """Save the logo URL path after a file upload.

    logo_url is a server-generated path (UUID-based filename).
    restaurant_id must come from authenticated context.
    """
    restaurant = get_by_id(db, restaurant_id)
    if not restaurant:
        return None

    restaurant.logo_url = logo_url
    db.commit()
    db.refresh(restaurant)
    return restaurant


# ─── Super-admin access ───────────────────────────────────────────────────────
#
# DESIGN: Intentionally named to signal these bypass tenant isolation.
# Must ONLY be called from endpoints enforcing the super_admin role.


def get_by_id_for_super_admin(db: Session, restaurant_id: int) -> Restaurant | None:
    """Fetch any restaurant by ID. Use ONLY in super_admin endpoints."""
    return db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()


def list_all_for_super_admin(db: Session) -> list[Restaurant]:
    """List all restaurants across all tenants. Use ONLY in super_admin endpoints."""
    return db.query(Restaurant).order_by(Restaurant.id.desc()).all()


def list_by_registration_status(
    db: Session,
    registration_status: RegistrationStatus,
    *,
    limit: int = 100,
) -> list[Restaurant]:
    return (
        db.query(Restaurant)
        .filter(Restaurant.registration_status == registration_status)
        .order_by(Restaurant.created_at.desc(), Restaurant.id.desc())
        .limit(limit)
        .all()
    )


def count_by_registration_status(
    db: Session,
    registration_status: RegistrationStatus,
) -> int:
    return (
        db.query(Restaurant)
        .filter(Restaurant.registration_status == registration_status)
        .count()
    )


def list_reviewed_registrations(
    db: Session,
    *,
    registration_status: RegistrationStatus | None = None,
    limit: int = 100,
) -> list[Restaurant]:
    query = db.query(Restaurant).filter(
        Restaurant.registration_status.in_(
            [RegistrationStatus.APPROVED, RegistrationStatus.REJECTED]
        )
    )
    if registration_status is not None:
        query = query.filter(Restaurant.registration_status == registration_status)
    return (
        query.order_by(
            Restaurant.registration_reviewed_at.desc().nullslast(),
            Restaurant.updated_at.desc(),
            Restaurant.id.desc(),
        )
        .limit(limit)
        .all()
    )


def count_reviewed_registrations(
    db: Session,
    *,
    registration_status: RegistrationStatus | None = None,
) -> int:
    query = db.query(Restaurant).filter(
        Restaurant.registration_status.in_(
            [RegistrationStatus.APPROVED, RegistrationStatus.REJECTED]
        )
    )
    if registration_status is not None:
        query = query.filter(Restaurant.registration_status == registration_status)
    return query.count()


def get_owner_user(db: Session, restaurant_id: int) -> User | None:
    return (
        db.query(User)
        .filter(
            User.restaurant_id == restaurant_id,
            User.role == UserRole.owner,
        )
        .order_by(User.created_at.asc(), User.id.asc())
        .first()
    )


def create_restaurant(
    db: Session,
    name: str,
    email: str | None,
    phone: str | None,
    address: str | None,
    country_id: int | None,
    currency_id: int | None,
    country: str | None,
    currency: str | None,
    billing_email: str | None,
    opening_time: str | None,
    closing_time: str | None,
) -> Restaurant:
    """Create a new restaurant. Use ONLY in super_admin endpoints."""
    restaurant = Restaurant(
        name=name,
        email=email,
        phone=phone,
        address=address,
        country_id=country_id,
        currency_id=currency_id,
        country=country,
        currency=currency,
        billing_email=billing_email,
        opening_time=opening_time,
        closing_time=closing_time,
    )
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    return restaurant


def update_for_super_admin(
    db: Session,
    restaurant_id: int,
    update_data: dict,
) -> Restaurant | None:
    """Update any restaurant by ID. Use ONLY in super_admin endpoints."""
    restaurant = get_by_id_for_super_admin(db, restaurant_id)
    if not restaurant:
        return None

    for field, value in update_data.items():
        setattr(restaurant, field, value)

    db.commit()
    db.refresh(restaurant)
    return restaurant


def delete_for_super_admin(db: Session, restaurant_id: int) -> bool:
    """Delete any restaurant by ID. Use ONLY in super_admin endpoints."""
    restaurant = get_by_id_for_super_admin(db, restaurant_id)
    if not restaurant:
        return False

    db.delete(restaurant)
    db.commit()
    return True
