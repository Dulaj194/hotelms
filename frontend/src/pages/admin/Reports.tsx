import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { api, ApiError, refreshAccessToken } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type {
  SalesReportHistoryItemResponse,
  SalesReportHistoryListResponse,
  SalesReportResponse,
} from "@/types/report";

type ReportViewMode = "daily" | "monthly" | "range" | "history";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function money(value: number): string {
  return value.toFixed(2);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.detail || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

function parseMonthInput(selectedMonth: string): { year: number; month: number } {
  const [yearRaw, monthRaw] = selectedMonth.split("-").map(Number);
  const currentDate = new Date();
  const year = Number.isFinite(yearRaw) ? yearRaw : currentDate.getFullYear();
  const month = Number.isFinite(monthRaw) ? monthRaw : currentDate.getMonth() + 1;
  return { year, month };
}

function buildMonthRange(selectedMonth: string): { fromDate: string; toDate: string } {
  const { year, month } = parseMonthInput(selectedMonth);
  const monthStart = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
  const monthEndDate = new Date(year, month, 0);
  const monthEnd = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${monthEndDate.getDate().toString().padStart(2, "0")}`;
  return { fromDate: monthStart, toDate: monthEnd };
}

function readContentDispositionFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? null;
}

function formatHistoryPeriod(item: SalesReportHistoryItemResponse): string {
  if (item.filter_type === "single" && item.selected_date) {
    return formatDate(item.selected_date);
  }
  if (item.from_date || item.to_date) {
    return `${formatDate(item.from_date)} - ${formatDate(item.to_date)}`;
  }
  return "-";
}

function numberFromSummary(summary: Record<string, unknown>, key: string): number | null {
  const value = summary[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchCsvWithAuthRetry(pathWithQuery: string): Promise<Response> {
  const requestOnce = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE_URL}${pathWithQuery}`, {
      method: "GET",
      headers,
      credentials: "include",
    });
  };

  let token = getAccessToken();
  let response = await requestOnce(token);
  if (response.status !== 401) return response;

  const nextToken = await refreshAccessToken();
  if (!nextToken) return response;
  response = await requestOnce(nextToken);
  return response;
}

export default function Reports() {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultFromDate = useMemo(() => {
    const current = new Date();
    current.setDate(current.getDate() - 30);
    return current.toISOString().split("T")[0];
  }, []);

  const [viewMode, setViewMode] = useState<ReportViewMode>("daily");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(today);

  const [report, setReport] = useState<SalesReportResponse | null>(null);
  const [reportHistory, setReportHistory] = useState<SalesReportHistoryItemResponse[]>([]);

  const [loading, setLoading] = useState(true);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildSalesRequest = useCallback(() => {
    if (viewMode === "daily") {
      const query = `filter_type=single&date_value=${encodeURIComponent(selectedDate)}`;
      return {
        dataPath: `/reports/sales?${query}`,
        exportPath: `/reports/sales/export.csv?${query}`,
      };
    }

    if (viewMode === "monthly") {
      const { year, month } = parseMonthInput(selectedMonth);
      const monthApiQuery = `year=${encodeURIComponent(String(year))}&month=${encodeURIComponent(
        String(month),
      )}`;
      const monthRange = buildMonthRange(selectedMonth);
      const exportQuery = `filter_type=range&from_date=${encodeURIComponent(
        monthRange.fromDate,
      )}&to_date=${encodeURIComponent(monthRange.toDate)}`;
      return {
        dataPath: `/reports/sales/monthly?${monthApiQuery}`,
        exportPath: `/reports/sales/export.csv?${exportQuery}`,
      };
    }

    const query = `filter_type=range&from_date=${encodeURIComponent(
      fromDate,
    )}&to_date=${encodeURIComponent(toDate)}`;
    return {
      dataPath: `/reports/sales?${query}`,
      exportPath: `/reports/sales/export.csv?${query}`,
    };
  }, [fromDate, selectedDate, selectedMonth, toDate, viewMode]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (viewMode === "history") {
        const data = await api.get<SalesReportHistoryListResponse>("/reports/sales/history?limit=150");
        setReportHistory(data.items);
        setReport(null);
        return;
      }

      const { dataPath } = buildSalesRequest();
      const data = await api.get<SalesReportResponse>(dataPath);
      setReport(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load sales report."));
    } finally {
      setLoading(false);
    }
  }, [buildSalesRequest, viewMode]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  async function downloadCsv() {
    if (viewMode === "history") return;

    setDownloadBusy(true);
    setError(null);
    try {
      const { exportPath } = buildSalesRequest();
      const response = await fetchCsvWithAuthRetry(exportPath);
      if (!response.ok) {
        let detail = "Failed to export CSV report.";
        try {
          const payload = (await response.json()) as { detail?: string };
          detail = payload.detail || detail;
        } catch {
          detail = response.statusText || detail;
        }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const filenameFromHeader = readContentDispositionFilename(
        response.headers.get("content-disposition"),
      );
      const filename = filenameFromHeader || "sales-report.csv";

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to export CSV report."));
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="app-page-stack">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="app-section-title text-gray-900">Reports</h1>
              <p className="app-muted-text mt-1 text-gray-600">
                Review daily and monthly sales, browse history, and download server-generated reports.
              </p>
            </div>
            <div className="app-form-actions">
              <button
                onClick={() => void downloadCsv()}
                disabled={viewMode === "history" || downloadBusy}
                className="app-btn-base w-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {downloadBusy ? "Downloading..." : "Download CSV"}
              </button>
              <button
                onClick={() => window.print()}
                className="app-btn-base w-full bg-green-600 text-white hover:bg-green-700 sm:w-auto"
              >
                Print
              </button>
            </div>
          </div>
        </div>

        <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
          <div className="app-form-actions">
            <button
              onClick={() => setViewMode("daily")}
              className={`app-btn-compact w-full sm:w-auto ${
                viewMode === "daily"
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setViewMode("monthly")}
              className={`app-btn-compact w-full sm:w-auto ${
                viewMode === "monthly"
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode("range")}
              className={`app-btn-compact w-full sm:w-auto ${
                viewMode === "range"
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Date Range
            </button>
            <button
              onClick={() => setViewMode("history")}
              className={`app-btn-compact w-full sm:w-auto ${
                viewMode === "history"
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Report History
            </button>
          </div>

          {viewMode === "daily" ? (
            <div className="app-form-grid items-end">
              <div>
                <label className="app-muted-text mb-1 block font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {report && report.available_dates.length > 0 && (
                <div>
                  <label className="app-muted-text mb-1 block font-medium text-gray-700">
                    History
                  </label>
                  <select
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setViewMode("daily");
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {report.available_dates.map((value) => (
                      <option key={value} value={value}>
                        {formatDate(value)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={() => void loadReport()}
                className={`app-btn-base w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto ${
                  report && report.available_dates.length > 0 ? "md:col-span-2" : ""
                }`}
              >
                Apply
              </button>
            </div>
          ) : viewMode === "monthly" ? (
            <div className="app-form-grid items-end">
              <div>
                <label className="app-muted-text mb-1 block font-medium text-gray-700">
                  Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={() => void loadReport()}
                className="app-btn-base w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
              >
                Apply
              </button>
            </div>
          ) : viewMode === "range" ? (
            <div className="app-form-grid items-end">
              <div>
                <label className="app-muted-text mb-1 block font-medium text-gray-700">
                  From
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="app-muted-text mb-1 block font-medium text-gray-700">
                  To
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={() => void loadReport()}
                className="app-btn-base w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto md:col-span-2"
              >
                Apply
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm text-blue-800">
                Showing generated report history from server-side report logs.
              </p>
              <button
                type="button"
                onClick={() => void loadReport()}
                className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                Refresh History
              </button>
            </div>
          )}
        </section>

        {loading && (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-500">Loading report...</div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && viewMode === "history" && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="app-section-title text-gray-900">Generated Report History</h2>
            {reportHistory.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No report history found yet.</p>
            ) : (
              <>
                <div className="mt-4 space-y-3 md:hidden">
                  {reportHistory.map((item) => {
                    const totalSales = numberFromSummary(item.report_summary, "total_sales");
                    const totalQuantity = numberFromSummary(item.report_summary, "total_quantity");
                    const totalOrders = numberFromSummary(item.report_summary, "total_orders");
                    return (
                      <article key={item.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">#{item.id}</p>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                            {item.output_format.toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-600">Generated: {formatDateTime(item.generated_at)}</p>
                        <p className="mt-1 text-xs text-gray-600">Period: {formatHistoryPeriod(item)}</p>
                        <p className="mt-2 text-xs text-gray-700">
                          Total Sales: {totalSales !== null ? money(totalSales) : "-"}
                        </p>
                        <p className="text-xs text-gray-700">
                          Qty: {totalQuantity !== null ? totalQuantity : "-"} | Orders:{" "}
                          {totalOrders !== null ? totalOrders : "-"}
                        </p>
                      </article>
                    );
                  })}
                </div>
                <div className="app-table-scroll hidden md:block">
                  <table className="mt-4 w-full min-w-[920px] text-sm">
                    <thead className="text-left text-gray-500">
                      <tr>
                        <th className="pb-2">ID</th>
                        <th className="pb-2">Generated At</th>
                        <th className="pb-2">Filter</th>
                        <th className="pb-2">Period</th>
                        <th className="pb-2">Format</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Total Sales</th>
                        <th className="pb-2 text-right">Quantity</th>
                        <th className="pb-2 text-right">Orders</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reportHistory.map((item) => {
                        const totalSales = numberFromSummary(item.report_summary, "total_sales");
                        const totalQuantity = numberFromSummary(item.report_summary, "total_quantity");
                        const totalOrders = numberFromSummary(item.report_summary, "total_orders");
                        return (
                          <tr key={item.id}>
                            <td className="py-2 pr-3">{item.id}</td>
                            <td className="py-2 pr-3">{formatDateTime(item.generated_at)}</td>
                            <td className="py-2 pr-3">{item.filter_type ?? "-"}</td>
                            <td className="py-2 pr-3">{formatHistoryPeriod(item)}</td>
                            <td className="py-2 pr-3">{item.output_format.toUpperCase()}</td>
                            <td className="py-2 pr-3">{item.status}</td>
                            <td className="py-2 pr-3 text-right">
                              {totalSales !== null ? money(totalSales) : "-"}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {totalQuantity !== null ? totalQuantity : "-"}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {totalOrders !== null ? totalOrders : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {report && !loading && viewMode !== "history" && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Sales</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{money(report.total_sales)}</p>
              </div>
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Quantity</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{report.total_quantity}</p>
              </div>
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Orders</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{report.total_orders}</p>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="app-section-title text-gray-900">Sales by Category</h2>
                {report.categories.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No category data for the selected period.</p>
                ) : (
                  <>
                    <div className="mt-4 space-y-2 md:hidden">
                      {report.categories.map((row) => (
                        <article key={row.category_name} className="rounded-lg border border-gray-200 p-3">
                          <p className="text-sm font-semibold text-gray-900">{row.category_name}</p>
                          <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-gray-600">
                            <p>Qty: {row.total_quantity}</p>
                            <p className="text-right">Lines: {row.line_count}</p>
                            <p className="col-span-2 text-right font-semibold text-gray-800">
                              Sales: {money(row.total_sales)}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="app-table-scroll hidden md:block">
                      <table className="mt-4 w-full min-w-[480px] text-sm">
                        <thead className="text-left text-gray-500">
                          <tr>
                            <th className="pb-2">Category</th>
                            <th className="pb-2">Qty</th>
                            <th className="pb-2">Lines</th>
                            <th className="pb-2 text-right">Sales</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {report.categories.map((row) => (
                            <tr key={row.category_name}>
                              <td className="py-2 pr-3">{row.category_name}</td>
                              <td className="py-2 pr-3">{row.total_quantity}</td>
                              <td className="py-2 pr-3">{row.line_count}</td>
                              <td className="py-2 text-right font-medium">{money(row.total_sales)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="app-section-title text-gray-900">Sales by Payment Method</h2>
                {report.payment_methods.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No payment data for the selected period.</p>
                ) : (
                  <>
                    <div className="mt-4 space-y-2 md:hidden">
                      {report.payment_methods.map((row) => (
                        <article key={row.payment_method} className="rounded-lg border border-gray-200 p-3">
                          <p className="text-sm font-semibold text-gray-900">{row.payment_method}</p>
                          <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-gray-600">
                            <p>Count: {row.payment_count}</p>
                            <p className="text-right font-semibold text-gray-800">
                              Sales: {money(row.total_sales)}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="app-table-scroll hidden md:block">
                      <table className="mt-4 w-full min-w-[420px] text-sm">
                        <thead className="text-left text-gray-500">
                          <tr>
                            <th className="pb-2">Method</th>
                            <th className="pb-2">Count</th>
                            <th className="pb-2 text-right">Sales</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {report.payment_methods.map((row) => (
                            <tr key={row.payment_method}>
                              <td className="py-2 pr-3">{row.payment_method}</td>
                              <td className="py-2 pr-3">{row.payment_count}</td>
                              <td className="py-2 text-right font-medium">{money(row.total_sales)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="app-section-title text-gray-900">Detailed Sales Report</h2>
              {report.rows.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No paid sales found for the selected period.</p>
              ) : (
                <>
                  <div className="mt-4 space-y-3 md:hidden">
                    {report.rows.map((row) => (
                      <article
                        key={`${row.order_id}-${row.item_name}-${row.sales_at}`}
                        className="rounded-lg border border-gray-200 p-3 text-sm"
                      >
                        <p className="font-semibold text-gray-900">{row.item_name}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(row.sales_at)}</p>
                        <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-600">
                          <p>Category: {row.category_name ?? "-"}</p>
                          <p className="text-right">Qty: {row.quantity}</p>
                          <p>Unit: {money(row.unit_price)}</p>
                          <p className="text-right">Total: {money(row.total_price)}</p>
                          <p>Method: {row.payment_method}</p>
                          <p className="text-right">Location: {row.location_label}</p>
                          <p className="col-span-2">Customer: {row.customer_name ?? "-"}</p>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="app-table-scroll hidden md:block">
                    <table className="mt-4 w-full min-w-[900px] text-sm">
                      <thead className="text-left text-gray-500">
                        <tr>
                          <th className="pb-2">Date & Time</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2">Item</th>
                          <th className="pb-2">Qty</th>
                          <th className="pb-2">Unit</th>
                          <th className="pb-2">Total</th>
                          <th className="pb-2">Method</th>
                          <th className="pb-2">Location</th>
                          <th className="pb-2">Customer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {report.rows.map((row) => (
                          <tr key={`${row.order_id}-${row.item_name}-${row.sales_at}`}>
                            <td className="py-2 pr-3">{formatDateTime(row.sales_at)}</td>
                            <td className="py-2 pr-3">{row.category_name ?? "-"}</td>
                            <td className="py-2 pr-3">{row.item_name}</td>
                            <td className="py-2 pr-3">{row.quantity}</td>
                            <td className="py-2 pr-3">{money(row.unit_price)}</td>
                            <td className="py-2 pr-3 font-medium">{money(row.total_price)}</td>
                            <td className="py-2 pr-3">{row.payment_method}</td>
                            <td className="py-2 pr-3">{row.location_label}</td>
                            <td className="py-2 pr-3">{row.customer_name ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
