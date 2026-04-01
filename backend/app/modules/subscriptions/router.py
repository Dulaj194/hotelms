from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_restaurant_id,
    get_db,
    require_platform_scopes,
    require_restaurant_user,
    require_roles,
)
from app.modules.subscriptions import service
from app.modules.subscriptions.schemas import (
    ActivateSubscriptionRequest,
    ActivateSubscriptionResponse,
    CancelSubscriptionResponse,
    ExpireOverdueResponse,
    StartTrialResponse,
    SubscriptionAccessSummaryResponse,
    SubscriptionChangeHistoryResponse,
    SubscriptionPrivilegeResponse,
    SubscriptionResponse,
    SubscriptionStatusResponse,
    SuperAdminSubscriptionUpdateRequest,
)
from app.modules.users.model import User

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


@router.get("/me/access", response_model=SubscriptionAccessSummaryResponse)
def get_my_subscription_access(
    restaurant_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> SubscriptionAccessSummaryResponse:
    return service.get_package_access_summary(db, restaurant_user.restaurant_id)


@router.post("/start-trial", response_model=StartTrialResponse)
def start_trial(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("owner", "admin")),
) -> StartTrialResponse:
    return service.start_trial(
        db,
        restaurant_id,
        actor_user_id=current_user.id,
    )


@router.post("/activate", response_model=ActivateSubscriptionResponse)
def activate_subscription(
    payload: ActivateSubscriptionRequest,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("owner", "admin")),
) -> ActivateSubscriptionResponse:
    return service.activate_subscription(
        db,
        restaurant_id,
        payload,
        actor_user_id=current_user.id,
    )


@router.post("/cancel", response_model=CancelSubscriptionResponse)
def cancel_subscription(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("owner", "admin")),
) -> CancelSubscriptionResponse:
    return service.cancel_subscription(
        db,
        restaurant_id,
        actor_user_id=current_user.id,
    )


# ─── Super-admin endpoints ────────────────────────────────────────────────────


@router.post("/admin/expire-overdue", response_model=ExpireOverdueResponse)
def expire_overdue_subscriptions(
    current_user: User = Depends(require_platform_scopes("billing_admin")),
    db: Session = Depends(get_db),
) -> ExpireOverdueResponse:
    """Manually trigger the expiry check that the background worker also runs."""
    count = service.expire_overdue_subscriptions(
        db,
        actor_user_id=current_user.id,
        source="super_admin",
    )
    return ExpireOverdueResponse(
        message=f"Expired {count} overdue subscription(s).",
        expired_count=count,
    )


@router.get("/admin/{restaurant_id}", response_model=SubscriptionResponse)
def get_subscription_for_hotel(
    restaurant_id: int,
    _: object = Depends(
        require_platform_scopes(
            "ops_viewer",
            "tenant_admin",
            "billing_admin",
            "security_admin",
        )
    ),
    db: Session = Depends(get_db),
) -> SubscriptionResponse:
    """Return the current subscription for any restaurant (super_admin only)."""
    return service.get_subscription_for_super_admin(db, restaurant_id)


@router.get("/admin/{restaurant_id}/access", response_model=SubscriptionAccessSummaryResponse)
def get_subscription_access_for_hotel(
    restaurant_id: int,
    _: object = Depends(
        require_platform_scopes(
            "ops_viewer",
            "tenant_admin",
            "billing_admin",
            "security_admin",
        )
    ),
    db: Session = Depends(get_db),
) -> SubscriptionAccessSummaryResponse:
    """Return the effective package-access summary for any restaurant."""
    return service.get_package_access_summary_for_super_admin(db, restaurant_id)


@router.get(
    "/admin/{restaurant_id}/history",
    response_model=SubscriptionChangeHistoryResponse,
)
def get_subscription_history_for_hotel(
    restaurant_id: int,
    limit: int = 100,
    _: object = Depends(
        require_platform_scopes(
            "ops_viewer",
            "tenant_admin",
            "billing_admin",
            "security_admin",
        )
    ),
    db: Session = Depends(get_db),
) -> SubscriptionChangeHistoryResponse:
    return service.get_subscription_change_history_for_super_admin(
        db,
        restaurant_id,
        limit=limit,
    )


@router.patch("/admin/{restaurant_id}", response_model=SubscriptionResponse)
def update_subscription_for_hotel(
    restaurant_id: int,
    payload: SuperAdminSubscriptionUpdateRequest,
    current_user: User = Depends(require_platform_scopes("billing_admin")),
    db: Session = Depends(get_db),
) -> SubscriptionResponse:
    """Update status, expiry, or package for any restaurant (super_admin only)."""
    return service.update_subscription_for_super_admin(
        db,
        restaurant_id,
        payload,
        actor_user_id=current_user.id,
    )
