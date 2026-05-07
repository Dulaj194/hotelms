import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  BarChart3, 
  Download, 
  Printer, 
  TrendingUp, 
  Package, 
  Receipt,
  AlertCircle,
  FileText
} from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { api, ApiError, refreshAccessToken } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { RESOLVED_API_BASE_URL } from "@/lib/networkBase";
import type {
  SalesReportHistoryItemResponse,
  SalesReportHistoryListResponse,
  SalesReportResponse,
} from "@/types/report";

type ReportViewMode = "daily" | "monthly" | "range" | "history";

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString([], { dateStyle: 'medium' });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function money(value: number): string {
  return value.toFixed(2);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail || fallback;
  if (error instanceof Error) return error.message || fallback;
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
    return fetch(`${RESOLVED_API_BASE_URL}${pathWithQuery}`, {
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
      <div className="space-y-8">
        {/* Header Section */}
        <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xl shadow-slate-200">
                <BarChart3 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Finance Reports</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">Analyze sales performance and export data</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void downloadCsv()}
                disabled={viewMode === "history" || downloadBusy}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <Download className={`h-4 w-4 ${downloadBusy ? 'animate-bounce' : ''}`} />
                {downloadBusy ? "Preparing..." : "Export CSV"}
              </button>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-100"
              >
                <Printer className="h-4 w-4" />
                Print Report
              </button>
            </div>
          </div>
        </div>

        {/* View Mode & Filters */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {(["daily", "monthly", "range", "history"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  viewMode === mode 
                    ? "bg-slate-900 text-white shadow-xl shadow-slate-200" 
                    : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                }`}
              >
                {mode === "range" ? "Date Range" : mode === "history" ? "Report History" : mode}
              </button>
            ))}
          </div>

          <div className="h-px bg-slate-100" />

          <div className="flex flex-wrap items-end gap-4">
            {viewMode === "daily" && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">Selected Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white ring-2 ring-transparent focus:ring-blue-100 transition-all"
                />
              </div>
            )}
            {viewMode === "monthly" && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">Selected Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white ring-2 ring-transparent focus:ring-blue-100 transition-all"
                />
              </div>
            )}
            {viewMode === "range" && (
              <>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white ring-2 ring-transparent focus:ring-blue-100 transition-all"
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white ring-2 ring-transparent focus:ring-blue-100 transition-all"
                  />
                </div>
              </>
            )}
            {viewMode !== "history" && (
              <button
                onClick={() => void loadReport()}
                className="px-8 py-3.5 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-slate-200"
              >
                Apply Filters
              </button>
            )}
            {viewMode === "history" && (
              <div className="flex-1 flex items-center justify-between bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <p className="text-xs font-bold text-blue-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Showing generated report history from server-side logs.
                </p>
                <button 
                  onClick={() => void loadReport()}
                  className="text-xs font-black uppercase text-blue-700 hover:underline"
                >
                  Refresh Logs
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="p-32 flex flex-col items-center justify-center gap-6">
            <div className="h-12 w-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Processing Report Data...</p>
          </div>
        ) : error ? (
           <div className="p-20 text-center bg-white rounded-3xl border border-rose-100">
              <div className="h-16 w-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8" />
              </div>
              <p className="text-lg font-black text-slate-900 tracking-tight">Report Generation Failed</p>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
            </div>
        ) : (
          <>
            {report && (
              <div className="space-y-8 animate-in fade-in duration-700">
                {/* Metric Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <MetricCard label="Total Revenue" value={money(report.total_sales)} icon={TrendingUp} color="blue" />
                  <MetricCard label="Total Quantity" value={report.total_quantity.toString()} icon={Package} color="emerald" />
                  <MetricCard label="Total Orders" value={report.total_orders.toString()} icon={Receipt} color="amber" />
                </div>

                {/* Subsections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ReportTableSection title="Sales by Category" items={report.categories} type="category" />
                  <ReportTableSection title="Sales by Payment" items={report.payment_methods} type="payment" />
                </div>

                {/* Detailed Table */}
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Detailed Sales Log</h2>
                    <span className="bg-slate-50 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">{report.rows.length} entries</span>
                  </div>
                  {report.rows.length === 0 ? (
                    <EmptyState message="No sales records found for this period" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <tr>
                            <th className="px-8 py-4">Timestamp</th>
                            <th className="px-8 py-4">Item Details</th>
                            <th className="px-8 py-4">Location</th>
                            <th className="px-8 py-4">Payment</th>
                            <th className="px-8 py-4 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {report.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-8 py-6 text-xs font-medium text-slate-500">{formatDateTime(row.sales_at)}</td>
                              <td className="px-8 py-6">
                                <p className="font-bold text-slate-900">{row.item_name}</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Qty: {row.quantity} • {row.category_name}</p>
                              </td>
                              <td className="px-8 py-6 text-sm font-bold text-slate-600">{row.location_label}</td>
                              <td className="px-8 py-6">
                                <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-black uppercase text-slate-500">
                                  {row.payment_method}
                                </span>
                              </td>
                              <td className="px-8 py-6 text-right font-black text-slate-900">{money(row.total_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {viewMode === "history" && (
              <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                 <div className="p-8 border-b border-slate-50">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Generated History</h2>
                  </div>
                  {reportHistory.length === 0 ? (
                    <EmptyState message="No generated reports in history" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <tr>
                            <th className="px-8 py-4">ID</th>
                            <th className="px-8 py-4">Generated At</th>
                            <th className="px-8 py-4">Period</th>
                            <th className="px-8 py-4">Type</th>
                            <th className="px-8 py-4 text-right">Sales</th>
                            <th className="px-8 py-4 text-right">Quantity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {reportHistory.map(item => {
                             const totalSales = numberFromSummary(item.report_summary, "total_sales");
                             const totalQty = numberFromSummary(item.report_summary, "total_quantity");
                             return (
                              <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-8 py-6 font-black text-slate-400">#{item.id}</td>
                                <td className="px-8 py-6 text-sm font-bold text-slate-900">{formatDateTime(item.generated_at)}</td>
                                <td className="px-8 py-6 text-xs font-medium text-slate-500">{formatHistoryPeriod(item)}</td>
                                <td className="px-8 py-6">
                                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase">
                                    {item.filter_type}
                                  </span>
                                </td>
                                <td className="px-8 py-6 text-right font-black text-slate-900">{totalSales !== null ? money(totalSales) : "-"}</td>
                                <td className="px-8 py-6 text-right font-black text-slate-900">{totalQty ?? "-"}</td>
                              </tr>
                             );
                           })}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: 'blue' | 'emerald' | 'amber' }) {
  const styles = {
    blue: "bg-blue-50 border-blue-100 text-blue-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600"
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-4xl font-black text-slate-900 mt-2 tabular-nums">{value}</p>
      </div>
      <div className={`p-4 rounded-2xl ${styles[color]}`}>
        <Icon className="h-8 w-8" />
      </div>
    </div>
  );
}

function ReportTableSection({ title, items, type }: { title: string, items: any[], type: 'category' | 'payment' }) {
  return (
    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-8 border-b border-slate-50">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">{title}</h2>
      </div>
      {items.length === 0 ? (
        <EmptyState message={`No ${type} data found`} />
      ) : (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
             <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-4">{type === 'category' ? 'Category' : 'Method'}</th>
                  <th className="px-8 py-4 text-right">Count/Qty</th>
                  <th className="px-8 py-4 text-right">Total Revenue</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-8 py-5 font-bold text-slate-700">{type === 'category' ? item.category_name : item.payment_method}</td>
                    <td className="px-8 py-5 text-right font-bold text-slate-500 tabular-nums">{type === 'category' ? item.total_quantity : item.payment_count}</td>
                    <td className="px-8 py-5 text-right font-black text-slate-900 tabular-nums">{money(item.total_sales)}</td>
                  </tr>
                ))}
             </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-20 text-center">
      <div className="h-16 w-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
        <FileText className="h-8 w-8" />
      </div>
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{message}</p>
    </div>
  );
}
