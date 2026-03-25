import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { api, ApiError } from "@/lib/api";
import type { ReportFilterType, SalesReportResponse } from "@/types/report";

type ReportViewMode = "daily" | "monthly" | "range";

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

export default function Reports() {
  const { loading: privilegeLoading, hasPrivilege } = useSubscriptionPrivileges();
  const reportsEnabled = hasPrivilege("QR_MENU");

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!reportsEnabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let queryFilterType: ReportFilterType = "single";
      let path = "";

      if (viewMode === "daily") {
        queryFilterType = "single";
        path = `/reports/sales?filter_type=single&date_value=${encodeURIComponent(selectedDate)}`;
      } else if (viewMode === "monthly") {
        queryFilterType = "range";
        const [yearRaw, monthRaw] = selectedMonth.split("-").map(Number);
        const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
        const month = Number.isFinite(monthRaw) ? monthRaw : new Date().getMonth() + 1;
        const monthStart = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
        const monthEndDate = new Date(year, month, 0);
        const monthEnd = `${year.toString().padStart(4, "0")}-${month
          .toString()
          .padStart(2, "0")}-${monthEndDate.getDate().toString().padStart(2, "0")}`;
        path = `/reports/sales?filter_type=${queryFilterType}&from_date=${encodeURIComponent(monthStart)}&to_date=${encodeURIComponent(monthEnd)}`;
      } else {
        queryFilterType = "range";
        path = `/reports/sales?filter_type=${queryFilterType}&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`;
      }

      const data = await api.get<SalesReportResponse>(path);
      setReport(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to load sales report.");
      } else {
        setError("Failed to load sales report.");
      }
    } finally {
      setLoading(false);
    }
  }, [fromDate, reportsEnabled, selectedDate, selectedMonth, toDate, viewMode]);

  useEffect(() => {
    if (!privilegeLoading) {
      void loadReport();
    }
  }, [loadReport, privilegeLoading]);

  function downloadCsv() {
    if (!report) return;

    const header = [
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
    ];

    const rows = report.rows.map((row) => [
      row.sales_at,
      row.order_number,
      row.category_name ?? "",
      row.item_name,
      String(row.quantity),
      money(row.unit_price),
      money(row.total_price),
      row.payment_method,
      row.location_label,
      row.customer_name ?? "",
    ]);

    const csv = [header, ...rows]
      .map((columns) =>
        columns.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sales-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardLayout>
      <div className="app-page-stack">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="app-section-title text-gray-900">Reports</h1>
              <p className="app-muted-text mt-1 text-gray-600">
                Review paid sales, filter by date, and export operational summaries.
              </p>
            </div>
            <div className="app-form-actions">
              <button
                onClick={downloadCsv}
                disabled={!report || !reportsEnabled}
                className="app-btn-base w-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 sm:w-auto"
              >
                Download CSV
              </button>
              <button
                onClick={() => window.print()}
                disabled={!reportsEnabled}
                className="app-btn-base w-full bg-green-600 text-white hover:bg-green-700 sm:w-auto"
              >
                Print
              </button>
            </div>
          </div>
        </div>

        {!privilegeLoading && !reportsEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Reports are locked because this restaurant does not currently have the QR_MENU privilege.
          </div>
        )}

        {reportsEnabled && (
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
            ) : (
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
            )}
          </section>
        )}

        {loading && reportsEnabled && (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-500">Loading report...</div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {reportsEnabled && report && !loading && (
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
