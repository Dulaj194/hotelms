from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_restaurant_user, require_roles
from app.modules.dashboard import service
from app.modules.dashboard.schemas import AdminDashboardOverviewResponse

router = APIRouter()


@router.get("/admin-overview", response_model=AdminDashboardOverviewResponse)
def get_admin_dashboard_overview(
    current_user=Depends(require_restaurant_user),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "admin", "steward", "housekeeper")),
) -> AdminDashboardOverviewResponse:
    restaurant_id = current_user.restaurant_id
    if restaurant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Restaurant context is required.",
        )
    return service.get_admin_dashboard_overview(db, restaurant_id=restaurant_id)
