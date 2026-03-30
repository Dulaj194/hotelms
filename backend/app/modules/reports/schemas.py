from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel

ReportFilterType = Literal["single", "range"]


class SalesReportRowResponse(BaseModel):
    order_id: int
    order_number: str
    sales_at: datetime
    category_name: str | None
    item_name: str
    quantity: int
    unit_price: float
    total_price: float
    payment_method: str
    customer_name: str | None
    order_source: str
    location_label: str


class SalesCategorySummaryResponse(BaseModel):
    category_name: str
    total_quantity: int
    line_count: int
    total_sales: float


class SalesPaymentSummaryResponse(BaseModel):
    payment_method: str
    payment_count: int
    total_sales: float


class SalesReportResponse(BaseModel):
    filter_type: ReportFilterType
    selected_date: date | None
    from_date: date | None
    to_date: date | None
    total_sales: float
    total_quantity: int
    total_items: int
    total_orders: int
    categories: list[SalesCategorySummaryResponse]
    payment_methods: list[SalesPaymentSummaryResponse]
    rows: list[SalesReportRowResponse]
    available_dates: list[date]


class SalesReportHistoryItemResponse(BaseModel):
    id: int
    report_type: str
    output_format: str
    status: str
    file_url: str | None
    generated_by_user_id: int | None
    generated_at: datetime
    filter_type: str | None
    selected_date: date | None
    from_date: date | None
    to_date: date | None
    report_summary: dict[str, Any]


class SalesReportHistoryListResponse(BaseModel):
    items: list[SalesReportHistoryItemResponse]
    total: int
