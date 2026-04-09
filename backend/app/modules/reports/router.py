from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_restaurant_id, get_db, require_module_access, require_roles
from app.modules.access import role_catalog
from app.modules.reports import service
from app.modules.reports.schemas import SalesReportHistoryListResponse, SalesReportResponse
from app.modules.users.model import User

router = APIRouter()

_STAFF_ROLES = role_catalog.QR_MENU_STAFF_ROLES


@router.get("/sales", response_model=SalesReportResponse)
def get_sales_report(
    filter_type: str = "single",
    date_value: date | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("reports")),
) -> SalesReportResponse:
    return service.get_sales_report(
        db,
        restaurant_id,
        filter_type=filter_type,
        selected_date=date_value,
        from_date=from_date,
        to_date=to_date,
        generated_by_user_id=current_user.id,
    )


@router.get("/sales/monthly", response_model=SalesReportResponse)
def get_monthly_sales_report(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("reports")),
) -> SalesReportResponse:
    return service.get_monthly_sales_report(
        db,
        restaurant_id,
        year=year,
        month=month,
        generated_by_user_id=current_user.id,
    )


@router.get("/sales/export.csv")
def export_sales_report_csv(
    filter_type: str = "single",
    date_value: date | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("reports")),
):
    csv_text = service.export_sales_report_csv(
        db,
        restaurant_id,
        filter_type=filter_type,
        selected_date=date_value,
        from_date=from_date,
        to_date=to_date,
        generated_by_user_id=current_user.id,
    )
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="sales-report.csv"'},
    )


@router.get("/sales/history", response_model=SalesReportHistoryListResponse)
def get_sales_report_history(
    limit: int = Query(default=100, ge=1, le=500),
    output_format: str | None = Query(default=None),
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_module_access("reports")),
) -> SalesReportHistoryListResponse:
    normalized_format = output_format.strip().lower() if output_format else None
    if normalized_format not in {None, "json", "csv"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="output_format must be one of: json, csv",
        )
    return service.list_sales_report_history(
        db,
        restaurant_id,
        limit=limit,
        output_format=normalized_format,
    )
