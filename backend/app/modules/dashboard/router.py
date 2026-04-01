from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_restaurant_user, require_roles
from app.modules.audit_logs.service import write_audit_log
from app.modules.dashboard import repository
from app.modules.dashboard import service
from app.modules.dashboard.schemas import (
    AdminDashboardOverviewResponse,
    AlertDismissRequest,
    GenericDashboardMessage,
    SetupProgressUpdateRequest,
)

router = APIRouter()


@router.get("/admin-overview", response_model=AdminDashboardOverviewResponse)
def get_admin_dashboard_overview(
    current_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "steward", "housekeeper", "cashier", "accountant")),
) -> AdminDashboardOverviewResponse:
    restaurant_id = current_user.restaurant_id
    if restaurant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Restaurant context is required.",
        )
    return service.get_admin_dashboard_overview(
        db,
        restaurant_id=restaurant_id,
        role=current_user.role.value,
    )


@router.post("/alerts/{alert_key}/shown", response_model=GenericDashboardMessage)
def mark_alert_shown(
    alert_key: str,
    current_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> GenericDashboardMessage:
    restaurant_id = current_user.restaurant_id
    if restaurant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Restaurant context is required.")

    repository.upsert_alert_impression(
        db,
        restaurant_id=restaurant_id,
        alert_key=alert_key,
        alert_level="info",
        shown_date=datetime.now(UTC).date(),
    )
    write_audit_log(
        db,
        event_type="dashboard_alert_shown",
        user_id=current_user.id,
        metadata={"alert_key": alert_key},
    )
    return GenericDashboardMessage(message="Alert impression recorded.")


@router.post("/alerts/{alert_key}/dismiss", response_model=GenericDashboardMessage)
def dismiss_alert(
    alert_key: str,
    payload: AlertDismissRequest,
    current_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> GenericDashboardMessage:
    restaurant_id = current_user.restaurant_id
    if restaurant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Restaurant context is required.")

    hours = max(payload.hours, 1)
    dismiss_until = datetime.now(UTC) + timedelta(hours=hours)
    repository.dismiss_alert(
        db,
        restaurant_id=restaurant_id,
        alert_key=alert_key,
        dismissed_until=dismiss_until,
    )
    write_audit_log(
        db,
        event_type="dashboard_alert_dismissed",
        user_id=current_user.id,
        metadata={"alert_key": alert_key, "hours": hours},
    )
    return GenericDashboardMessage(message="Alert dismissed.")


@router.put("/setup-progress", response_model=GenericDashboardMessage)
def update_setup_progress(
    payload: SetupProgressUpdateRequest,
    current_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
) -> GenericDashboardMessage:
    restaurant_id = current_user.restaurant_id
    if restaurant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Restaurant context is required.")

    repository.upsert_setup_progress(
        db,
        restaurant_id=restaurant_id,
        current_step=max(payload.current_step, 1),
        completed_keys=payload.completed_keys,
    )
    write_audit_log(
        db,
        event_type="dashboard_setup_progress_updated",
        user_id=current_user.id,
        metadata={"current_step": payload.current_step, "completed_keys": payload.completed_keys},
    )
    return GenericDashboardMessage(message="Setup progress updated.")
