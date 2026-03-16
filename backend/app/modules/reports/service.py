from __future__ import annotations

import csv
import io
from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.reports import repository
from app.modules.reports.schemas import (
    SalesCategorySummaryResponse,
    SalesPaymentSummaryResponse,
    SalesReportResponse,
    SalesReportRowResponse,
)


def _normalize_date_range(
    filter_type: str,
    selected_date: date | None,
    from_date: date | None,
    to_date: date | None,
) -> tuple[str, date | None, date | None, date | None]:
    if filter_type not in ("single", "range"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid filter type.")

    if filter_type == "range":
        if from_date is None or to_date is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Both from_date and to_date are required for range filters.",
            )
        if to_date < from_date:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="to_date cannot be earlier than from_date.",
            )
        if to_date - from_date > timedelta(days=366):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Date range cannot exceed 366 days.",
            )
        return filter_type, None, from_date, to_date

    if selected_date is None:
        selected_date = datetime.now(UTC).date()
    return "single", selected_date, None, None


def get_sales_report(
    db: Session,
    restaurant_id: int,
    *,
    filter_type: str = "single",
    selected_date: date | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> SalesReportResponse:
    filter_type, selected_date, from_date, to_date = _normalize_date_range(
        filter_type,
        selected_date,
        from_date,
        to_date,
    )

    rows = repository.list_sales_rows(
        db,
        restaurant_id,
        selected_date=selected_date,
        from_date=from_date,
        to_date=to_date,
    )
    available_dates = repository.list_available_sales_dates(db, restaurant_id)

    mapped_rows: list[SalesReportRowResponse] = []
    total_sales = 0.0
    total_quantity = 0
    total_items = 0
    order_ids: set[int] = set()
    category_summary: dict[str, dict[str, float | int]] = {}
    payment_summary: dict[str, dict[str, float | int]] = {}

    for row in rows:
        location_label = (
            f"Room {row.room_number}" if row.order_source == "room" else f"Table {row.table_number}"
        )
        total_price = float(row.total_price)
        unit_price = float(row.unit_price)
        category_name = row.category_name or "Uncategorized"
        payment_method = row.payment_method or "Unknown"

        mapped_rows.append(
            SalesReportRowResponse(
                order_id=row.order_id,
                order_number=row.order_number,
                sales_at=row.sales_at,
                category_name=row.category_name,
                item_name=row.item_name,
                quantity=row.quantity,
                unit_price=unit_price,
                total_price=total_price,
                payment_method=payment_method,
                customer_name=row.customer_name,
                order_source=row.order_source,
                location_label=location_label,
            )
        )

        total_sales += total_price
        total_quantity += row.quantity
        total_items += 1
        order_ids.add(row.order_id)

        if category_name not in category_summary:
            category_summary[category_name] = {"total_quantity": 0, "line_count": 0, "total_sales": 0.0}
        category_summary[category_name]["total_quantity"] += row.quantity
        category_summary[category_name]["line_count"] += 1
        category_summary[category_name]["total_sales"] += total_price

        if payment_method not in payment_summary:
            payment_summary[payment_method] = {"payment_count": 0, "total_sales": 0.0}
        payment_summary[payment_method]["payment_count"] += 1
        payment_summary[payment_method]["total_sales"] += total_price

    category_rows = [
        SalesCategorySummaryResponse(
            category_name=key,
            total_quantity=int(value["total_quantity"]),
            line_count=int(value["line_count"]),
            total_sales=float(value["total_sales"]),
        )
        for key, value in sorted(category_summary.items(), key=lambda item: item[0].lower())
    ]

    payment_rows = [
        SalesPaymentSummaryResponse(
            payment_method=key,
            payment_count=int(value["payment_count"]),
            total_sales=float(value["total_sales"]),
        )
        for key, value in sorted(payment_summary.items(), key=lambda item: item[0].lower())
    ]

    return SalesReportResponse(
        filter_type=filter_type,
        selected_date=selected_date,
        from_date=from_date,
        to_date=to_date,
        total_sales=round(total_sales, 2),
        total_quantity=total_quantity,
        total_items=total_items,
        total_orders=len(order_ids),
        categories=category_rows,
        payment_methods=payment_rows,
        rows=mapped_rows,
        available_dates=available_dates,
    )


def export_sales_report_csv(
    db: Session,
    restaurant_id: int,
    *,
    filter_type: str = "single",
    selected_date: date | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> str:
    report = get_sales_report(
        db,
        restaurant_id,
        filter_type=filter_type,
        selected_date=selected_date,
        from_date=from_date,
        to_date=to_date,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Sales At",
        "Order Number",
        "Category",
        "Item Name",
        "Quantity",
        "Unit Price",
        "Total Price",
        "Payment Method",
        "Location",
        "Customer",
    ])

    for row in report.rows:
        writer.writerow([
            row.sales_at.isoformat(),
            row.order_number,
            row.category_name or "",
            row.item_name,
            row.quantity,
            f"{row.unit_price:.2f}",
            f"{row.total_price:.2f}",
            row.payment_method,
            row.location_label,
            row.customer_name or "",
        ])

    return output.getvalue()
