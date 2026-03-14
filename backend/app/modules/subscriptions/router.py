from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_restaurant_id,
    get_db,
    require_restaurant_user,
    require_roles,
)
from app.modules.subscriptions import service
from app.modules.subscriptions.schemas import (
    ActivateSubscriptionRequest,
    ActivateSubscriptionResponse,
    CancelSubscriptionResponse,
    StartTrialResponse,
    SubscriptionPrivilegeResponse,
    SubscriptionResponse,
    SubscriptionStatusResponse,
)

router = APIRouter()


@router.get("/me", response_model=SubscriptionResponse)
def get_my_subscription(
    restaurant_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> SubscriptionResponse:
    return service.get_current_subscription(db, restaurant_user.restaurant_id)


@router.get("/me/status", response_model=SubscriptionStatusResponse)
def get_my_subscription_status(
    restaurant_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> SubscriptionStatusResponse:
    return service.get_current_subscription_status(db, restaurant_user.restaurant_id)


@router.get("/me/privileges", response_model=SubscriptionPrivilegeResponse)
def get_my_subscription_privileges(
    restaurant_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> SubscriptionPrivilegeResponse:
    return service.get_effective_privileges(db, restaurant_user.restaurant_id)


@router.post("/start-trial", response_model=StartTrialResponse)
def start_trial(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin")),
) -> StartTrialResponse:
    return service.start_trial(db, restaurant_id)


@router.post("/activate", response_model=ActivateSubscriptionResponse)
def activate_subscription(
    payload: ActivateSubscriptionRequest,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin")),
) -> ActivateSubscriptionResponse:
    return service.activate_subscription(db, restaurant_id, payload)


@router.post("/cancel", response_model=CancelSubscriptionResponse)
def cancel_subscription(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin")),
) -> CancelSubscriptionResponse:
    return service.cancel_subscription(db, restaurant_id)
