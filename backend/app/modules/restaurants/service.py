from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.restaurants import repository
from app.modules.restaurants.schemas import RestaurantMeResponse, RestaurantUpdateRequest


def get_my_restaurant(db: Session, restaurant_id: int) -> RestaurantMeResponse:
    """Return the authenticated tenant's restaurant profile.

    restaurant_id must come from the authenticated user context (dependency injected),
    never from a client-supplied value.
    """
    restaurant = repository.get_by_id(db, restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return RestaurantMeResponse.model_validate(restaurant)


def update_my_restaurant(
    db: Session,
    restaurant_id: int,
    payload: RestaurantUpdateRequest,
) -> RestaurantMeResponse:
    """Update the authenticated tenant's restaurant profile.

    restaurant_id must come from the authenticated user context (dependency injected),
    never from a client-supplied value.
    """
    restaurant = repository.update_profile(db, restaurant_id, payload)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return RestaurantMeResponse.model_validate(restaurant)


def get_restaurant_for_super_admin(
    db: Session, restaurant_id: int
) -> RestaurantMeResponse:
    """Fetch any restaurant by ID. Restricted to super_admin use only."""
    restaurant = repository.get_by_id_for_super_admin(db, restaurant_id)
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return RestaurantMeResponse.model_validate(restaurant)
