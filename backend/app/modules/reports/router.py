from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_restaurant_id, get_db, require_privilege, require_roles
from app.modules.reports import service
from app.modules.reports.schemas import SalesReportResponse

router = APIRouter()

_STAFF_ROLES = ("owner", "admin", "steward")


@router.get("/sales", response_model=SalesReportResponse)
def get_sales_report(
    filter_type: str = "single",
    date_value: date | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_privilege("QR_MENU")),
) -> SalesReportResponse:
    return service.get_sales_report(
        db,
        restaurant_id,
        filter_type=filter_type,
        selected_date=date_value,
        from_date=from_date,
        to_date=to_date,
    )


@router.get("/sales/export.csv")
def export_sales_report_csv(
    filter_type: str = "single",
    date_value: date | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    restaurant_id: int = Depends(get_current_restaurant_id),
    db: Session = Depends(get_db),
    _=Depends(require_roles(*_STAFF_ROLES)),
    __=Depends(require_privilege("QR_MENU")),
):
    csv_text = service.export_sales_report_csv(
        db,
        restaurant_id,
        filter_type=filter_type,
        selected_date=date_value,
        from_date=from_date,
        to_date=to_date,
    )
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="sales-report.csv"'},
    )
