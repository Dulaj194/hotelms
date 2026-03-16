import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { api, ApiError } from "@/lib/api";
import type { ReportFilterType, SalesReportResponse } from "@/types/report";

function formatDate(value: string | null): string {
  if (!value) return "—";
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

  const [filterType, setFilterType] = useState<ReportFilterType>("single");
  const [selectedDate, setSelectedDate] = useState(today);
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
      const path =
        filterType === "range"
          ? `/reports/sales?filter_type=range&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`
          : `/reports/sales?filter_type=single&date_value=${encodeURIComponent(selectedDate)}`;
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
  }, [filterType, fromDate, reportsEnabled, selectedDate, toDate]);

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
      .map((columns) => columns.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
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
      <div className="space-y-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
            <p className="mt-1 text-sm text-gray-600">
              Review paid sales, filter by date, and export operational summaries.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              disabled={!report || !reportsEnabled}
              className="rounded-md border px-4 py-2 text-sm text-gray-700 disabled:opacity-60"
            >
              Download CSV
            </button>
            <button
              onClick={() => window.print()}
              disabled={!reportsEnabled}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Print
            </button>
          </div>
        </div>

        {!privilegeLoading && !reportsEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Reports are locked because this restaurant does not currently have the QR_MENU privilege.
          </div>
        )}

        {reportsEnabled && (
          <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFilterType("single")}
                className={`rounded-md px-3 py-2 text-sm ${
                  filterType === "single" ? "bg-blue-600 text-white" : "border text-gray-700"
                }`}
              >
                Single Date
              </button>
              <button
                onClick={() => setFilterType("range")}
                className={`rounded-md px-3 py-2 text-sm ${
                  filterType === "range" ? "bg-blue-600 text-white" : "border text-gray-700"
                }`}
              >
                Date Range
              </button>
            </div>

            {filterType === "single" ? (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={() => void loadReport()}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Apply
                </button>
                {report && report.available_dates.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">History</label>
                    <select
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setFilterType("single");
                      }}
                      className="rounded-md border px-3 py-2 text-sm"
                    >
                      {report.available_dates.map((value) => (
                        <option key={value} value={value}>
                          {formatDate(value)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={() => void loadReport()}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
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
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
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
              <div className="rounded-xl border bg-white p-6 shadow-sm overflow-auto">
                <h2 className="text-base font-semibold text-gray-900">Sales by Category</h2>
                {report.categories.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No category data for the selected period.</p>
                ) : (
                  <table className="mt-4 w-full text-sm">
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
                )}
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-sm overflow-auto">
                <h2 className="text-base font-semibold text-gray-900">Sales by Payment Method</h2>
                {report.payment_methods.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No payment data for the selected period.</p>
                ) : (
                  <table className="mt-4 w-full text-sm">
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
                )}
              </div>
            </section>

            <section className="rounded-xl border bg-white p-6 shadow-sm overflow-auto">
              <h2 className="text-base font-semibold text-gray-900">Detailed Sales Report</h2>
              {report.rows.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No paid sales found for the selected period.</p>
              ) : (
                <table className="mt-4 w-full text-sm min-w-[900px]">
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
                        <td className="py-2 pr-3">{row.category_name ?? "—"}</td>
                        <td className="py-2 pr-3">{row.item_name}</td>
                        <td className="py-2 pr-3">{row.quantity}</td>
                        <td className="py-2 pr-3">{money(row.unit_price)}</td>
                        <td className="py-2 pr-3 font-medium">{money(row.total_price)}</td>
                        <td className="py-2 pr-3">{row.payment_method}</td>
                        <td className="py-2 pr-3">{row.location_label}</td>
                        <td className="py-2 pr-3">{row.customer_name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
