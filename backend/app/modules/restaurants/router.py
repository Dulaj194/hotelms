from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_restaurant_user, require_roles
from app.modules.restaurants import service
from app.modules.restaurants.schemas import RestaurantMeResponse, RestaurantUpdateRequest
from app.modules.users.model import User

router = APIRouter()


@router.get("/me", response_model=RestaurantMeResponse)
def get_my_restaurant(
    current_user: User = Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> RestaurantMeResponse:
    """Return the authenticated tenant's restaurant profile.

    SECURITY: restaurant_id is read from the authenticated user object
    (backed by the verified JWT). It is never accepted from the request.
    """
    # current_user.restaurant_id is guaranteed non-None by require_restaurant_user
    return service.get_my_restaurant(db, current_user.restaurant_id)  # type: ignore[arg-type]


@router.patch("/me", response_model=RestaurantMeResponse)
def update_my_restaurant(
    payload: RestaurantUpdateRequest,
    current_user: User = Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> RestaurantMeResponse:
    """Update the authenticated tenant's restaurant profile.

    SECURITY: restaurant_id is read from the authenticated user object.
    The request payload (RestaurantUpdateRequest) intentionally does not
    contain a restaurant_id field — the tenant cannot redirect the update
    to a different restaurant.
    """
    return service.update_my_restaurant(db, current_user.restaurant_id, payload)  # type: ignore[arg-type]


@router.get("/{restaurant_id}", response_model=RestaurantMeResponse)
def get_restaurant_by_id(
    restaurant_id: int,
    _current_user: User = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
) -> RestaurantMeResponse:
    """Fetch any restaurant by ID. Super-admin only.

    SECURITY: Enforced by require_roles("super_admin"). Tenant-bound users
    are rejected before this handler executes.
    """
    return service.get_restaurant_for_super_admin(db, restaurant_id)
