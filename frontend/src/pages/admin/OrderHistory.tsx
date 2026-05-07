import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  History, 
  Search, 
  AlertCircle, 
  Download, 
  CheckCircle, 
  CreditCard, 
  XCircle, 
  ArrowLeftRight,
  Clock,
  Calendar
} from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/types/order";
import type { ActiveOrderListResponse, OrderHeaderResponse, OrderStatus } from "@/types/order";

const SOURCE_OPTIONS = ["all", "table", "room"] as const;
type SourceFilter = (typeof SOURCE_OPTIONS)[number];

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function sourceLabel(order: OrderHeaderResponse): string {
  if (order.order_source === "room") {
    return `Room ${order.room_number ?? "?"}`;
  }
  return `Table ${order.table_number ?? "?"}`;
}

export default function OrderHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderHeaderResponse[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({ completed: 0, paid: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusFilter = (searchParams.get("status") || "all") as "all" | OrderStatus;
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [searchText, setSearchText] = useState("");

  const statusList: ("all" | OrderStatus)[] = ["all", "completed", "paid", "rejected"];

  const handleStatusChange = useCallback((status: "all" | OrderStatus) => {
    setSearchParams(prev => {
      if (status === "all") prev.delete("status");
      else prev.set("status", status);
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const loadOrders = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [ordersRes, statsRes] = await Promise.all([
        api.get<ActiveOrderListResponse>("/orders/history"),
        api.get<Record<string, number>>("/orders/history/stats")
      ]);
      
      setOrders(ordersRes.orders);
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load order history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (sourceFilter !== "all") {
        if (sourceFilter === "room" && order.order_source !== "room") return false;
        if (sourceFilter === "table" && order.order_source === "room") return false;
      }
      if (!search) return true;
      const haystack = [
        order.order_number,
        order.customer_name ?? "",
        order.table_number ?? "",
        order.room_number ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });
  }, [orders, searchText, sourceFilter, statusFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header section */}
        <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xl shadow-slate-200">
                <History className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Order History</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">Track and review past service interactions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void loadOrders(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <Clock className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? "Refreshing..." : "Refresh Logs"}
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-100">
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Orders</p>
            <p className="text-3xl font-black text-slate-900 mt-2">{orders.length}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Completed</p>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-2">{stats.completed}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
             <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Paid</p>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-2">{stats.paid}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
             <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-500" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Rejected</p>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-2">{stats.rejected}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search order #, customer, or location..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 outline-none ring-2 ring-transparent focus:ring-blue-500/20 focus:bg-white transition-all"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
              {statusList.map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    statusFilter === status 
                      ? "bg-slate-900 text-white shadow-xl shadow-slate-200" 
                      : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {status}
                </button>
              ))}
              <div className="w-px h-8 bg-slate-100 mx-2 hidden lg:block" />
              <div className="flex p-1 bg-slate-50 rounded-2xl">
                {SOURCE_OPTIONS.map(source => (
                  <button
                    key={source}
                    onClick={() => setSourceFilter(source)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      sourceFilter === source 
                        ? "bg-white text-slate-900 shadow-sm" 
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-32 flex flex-col items-center justify-center gap-6">
              <div className="h-12 w-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Retreiving History...</p>
            </div>
          ) : error ? (
            <div className="p-20 text-center">
              <div className="h-16 w-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8" />
              </div>
              <p className="text-lg font-black text-slate-900">Sync Failure</p>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-32 text-center">
               <div className="h-20 w-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <History className="h-10 w-10" />
              </div>
              <p className="text-xl font-black text-slate-900">No records found</p>
              <p className="text-sm text-slate-400 mt-2">Adjust your filters to see more results</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Info</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredOrders.map(order => (
                    <tr key={order.id} className="group hover:bg-slate-50/30 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-slate-900 transition-all font-black text-xs">
                            #{order.id}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 leading-tight">#{order.order_number}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                              {order.customer_name || "Guest User"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-slate-700">
                          <ArrowLeftRight className="h-3.5 w-3.5 text-slate-300" />
                          <span className="font-bold text-sm">{sourceLabel(order)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${ORDER_STATUS_COLOR[order.status]}`}>
                          {ORDER_STATUS_LABEL[order.status]}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Calendar className="h-3.5 w-3.5 opacity-40" />
                          <span className="text-xs font-medium">{formatDateTime(order.placed_at)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <p className="text-base font-black text-slate-900 tabular-nums">
                          {order.total_amount.toFixed(2)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
