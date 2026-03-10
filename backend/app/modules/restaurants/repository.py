from sqlalchemy.orm import Session

from app.modules.restaurants.model import Restaurant
from app.modules.restaurants.schemas import RestaurantUpdateRequest

# ─── Tenant-safe access ───────────────────────────────────────────────────────
#
# DESIGN: Repository methods for tenant-owned data explicitly require
# restaurant_id at the call site. This forces callers (service layer) to supply
# the authenticated tenant context rather than accepting an arbitrary ID.
# Cross-tenant data access is structurally impossible from these entry points.


def get_by_id(db: Session, restaurant_id: int) -> Restaurant | None:
    """Fetch a restaurant by its own primary key.

    restaurant_id must always come from the authenticated user context,
    never from a client-supplied request parameter.
    """
    return db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()


def update_profile(
    db: Session,
    restaurant_id: int,
    payload: RestaurantUpdateRequest,
) -> Restaurant | None:
    """Update allowed profile fields on a specific restaurant.

    restaurant_id must come from the authenticated context, never from the
    request body. Only fields explicitly included in the payload are updated
    (partial update via exclude_unset).
    """
    restaurant = get_by_id(db, restaurant_id)
    if not restaurant:
        return None

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(restaurant, field, value)

    db.commit()
    db.refresh(restaurant)
    return restaurant


# ─── Super-admin access ───────────────────────────────────────────────────────
#
# DESIGN: These methods are intentionally separate and named to signal that
# they bypass tenant isolation. They must ONLY be called from endpoints that
# enforce the super_admin role via require_roles("super_admin").


def get_by_id_for_super_admin(db: Session, restaurant_id: int) -> Restaurant | None:
    """Fetch any restaurant by ID. Use ONLY in super_admin endpoints."""
    return db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()


def list_all_for_super_admin(db: Session) -> list[Restaurant]:
    """List all restaurants across all tenants. Use ONLY in super_admin endpoints."""
    return db.query(Restaurant).all()
