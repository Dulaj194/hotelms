from sqlalchemy.orm import Session

from app.modules.restaurants.model import Restaurant
from app.modules.restaurants.schemas import RestaurantUpdateRequest

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
    payload: RestaurantUpdateRequest,
) -> Restaurant | None:
    """Update allowed profile fields. Only fields in the payload are changed."""
    restaurant = get_by_id(db, restaurant_id)
    if not restaurant:
        return None

    update_data = payload.model_dump(exclude_unset=True)
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


def create_restaurant(
    db: Session,
    name: str,
    email: str | None,
    phone: str | None,
    address: str | None,
    country: str | None,
    currency: str | None,
    opening_time: str | None,
    closing_time: str | None,
) -> Restaurant:
    """Create a new restaurant. Use ONLY in super_admin endpoints."""
    restaurant = Restaurant(
        name=name,
        email=email,
        phone=phone,
        address=address,
        country=country,
        currency=currency,
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
