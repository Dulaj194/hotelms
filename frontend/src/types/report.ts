export type ReportFilterType = "single" | "range";

export interface SalesReportRowResponse {
  order_id: number;
  order_number: string;
  sales_at: string;
  category_name: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  payment_method: string;
  customer_name: string | null;
  order_source: string;
  location_label: string;
}

export interface SalesCategorySummaryResponse {
  category_name: string;
  total_quantity: number;
  line_count: number;
  total_sales: number;
}

export interface SalesPaymentSummaryResponse {
  payment_method: string;
  payment_count: number;
  total_sales: number;
}

export interface SalesReportResponse {
  filter_type: ReportFilterType;
  selected_date: string | null;
  from_date: string | null;
  to_date: string | null;
  total_sales: number;
  total_quantity: number;
  total_items: number;
  total_orders: number;
  categories: SalesCategorySummaryResponse[];
  payment_methods: SalesPaymentSummaryResponse[];
  rows: SalesReportRowResponse[];
  available_dates: string[];
}

export interface SalesReportHistoryItemResponse {
  id: number;
  report_type: string;
  output_format: string;
  status: string;
  file_url: string | null;
  generated_by_user_id: number | null;
  generated_at: string;
  filter_type: string | null;
  selected_date: string | null;
  from_date: string | null;
  to_date: string | null;
  report_summary: Record<string, unknown>;
}

export interface SalesReportHistoryListResponse {
  items: SalesReportHistoryItemResponse[];
  total: number;
}
