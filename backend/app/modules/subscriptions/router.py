from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_restaurant_id,
    get_db,
    require_platform_scopes,
    require_restaurant_user,
    require_roles,
)
from app.modules.access import role_catalog
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
from app.core.response_schemas import ApiResponse
from app.core.response_utils import success_response
from app.core.pagination import PaginationParams, pagination_depends, create_paginated_response
from app.modules.users.model import User, UserRole

router = APIRouter()

_RESTAURANT_ADMIN_ROLES = role_catalog.RESTAURANT_ADMIN_ROLES
_SUPER_ADMIN_SOURCE = UserRole.super_admin.value


@router.get("/me", response_model=ApiResponse[SubscriptionResponse])
def get_my_subscription(
    restaurant_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.get_current_subscription(db, restaurant_user.restaurant_id), message="Subscription retrieved")


@router.get("/me/status", response_model=ApiResponse[SubscriptionStatusResponse])
def get_my_subscription_status(
    restaurant_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.get_current_subscription_status(db, restaurant_user.restaurant_id), message="Subscription status retrieved")


@router.get("/me/privileges", response_model=ApiResponse[SubscriptionPrivilegeResponse])
def get_my_subscription_privileges(
    restaurant_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.get_effective_privileges(db, restaurant_user.restaurant_id), message="Privileges retrieved")


@router.get("/me/access", response_model=ApiResponse[SubscriptionAccessSummaryResponse])
def get_my_subscription_access(
    restaurant_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.get_package_access_summary(db, restaurant_user.restaurant_id), message="Access summary retrieved")


@router.post("/start-trial", response_model=ApiResponse[StartTrialResponse])
def start_trial(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
) -> ApiResponse:
    return success_response(data=service.start_trial(
        db,
        restaurant_id,
        actor_user_id=current_user.id,
    ), message="Trial started")


@router.post("/activate", response_model=ApiResponse[ActivateSubscriptionResponse])
def activate_subscription(
    payload: ActivateSubscriptionRequest,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
) -> ApiResponse:
    return success_response(data=service.activate_subscription(
        db,
        restaurant_id,
        payload,
        actor_user_id=current_user.id,
    ), message="Subscription activated")


@router.post("/cancel", response_model=ApiResponse[CancelSubscriptionResponse])
def cancel_subscription(
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*_RESTAURANT_ADMIN_ROLES)),
) -> ApiResponse:
    return success_response(data=service.cancel_subscription(
        db,
        restaurant_id,
        actor_user_id=current_user.id,
    ), message="Subscription cancelled")


# ─── Super-admin endpoints ────────────────────────────────────────────────────


@router.post("/admin/expire-overdue", response_model=ApiResponse[ExpireOverdueResponse])
def expire_overdue_subscriptions(
    current_user: User = Depends(require_platform_scopes("billing_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Manually trigger the expiry check that the background worker also runs."""
    count = service.expire_overdue_subscriptions(
        db,
        actor_user_id=current_user.id,
        source=_SUPER_ADMIN_SOURCE,
    )
    return success_response(data=ExpireOverdueResponse(
        message=f"Expired {count} overdue subscription(s).",
        expired_count=count,
    ), message="Checked overdue subscriptions")


@router.get("/admin/{restaurant_id}", response_model=ApiResponse[SubscriptionResponse])
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
) -> ApiResponse:
    """Return the current subscription for any restaurant (super_admin only)."""
    return success_response(data=service.get_subscription_for_super_admin(db, restaurant_id), message="Subscription retrieved")


@router.get("/admin/{restaurant_id}/access", response_model=ApiResponse[SubscriptionAccessSummaryResponse])
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
) -> ApiResponse:
    """Return the effective package-access summary for any restaurant."""
    return success_response(data=service.get_package_access_summary_for_super_admin(db, restaurant_id), message="Access retrieved")


@router.get(
    "/admin/{restaurant_id}/history",
    response_model=ApiResponse,
)
def get_subscription_history_for_hotel(
    restaurant_id: int,
    pagination: PaginationParams = Depends(pagination_depends),
    _: object = Depends(
        require_platform_scopes(
            "ops_viewer",
            "tenant_admin",
            "billing_admin",
            "security_admin",
        )
    ),
    db: Session = Depends(get_db),
) -> ApiResponse:
    items, total = service.get_subscription_change_history_for_super_admin(
        db,
        restaurant_id,
        skip=pagination.skip,
        limit=pagination.limit,
    )
    paginated_data = create_paginated_response(items, total, pagination.page, pagination.limit)
    return success_response(data=paginated_data, message="History retrieved")


@router.patch("/admin/{restaurant_id}", response_model=ApiResponse[SubscriptionResponse])
def update_subscription_for_hotel(
    restaurant_id: int,
    payload: SuperAdminSubscriptionUpdateRequest,
    current_user: User = Depends(require_platform_scopes("billing_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    """Update status, expiry, or package for any restaurant (super_admin only)."""
    return success_response(data=service.update_subscription_for_super_admin(
        db,
        restaurant_id,
        payload,
        actor_user_id=current_user.id,
    ), message="Subscription updated")
