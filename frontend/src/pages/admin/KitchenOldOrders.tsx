import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/types/order";
import type { ActiveOrderListResponse, OrderHeaderResponse, OrderStatus } from "@/types/order";

const KITCHEN_HISTORY_STATUSES: OrderStatus[] = ["completed", "paid", "rejected"];
const SOURCE_OPTIONS = ["all", "table", "room"] as const;

type SourceFilter = (typeof SOURCE_OPTIONS)[number];

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function sourceLabel(order: OrderHeaderResponse): string {
  if (order.order_source === "room") {
    return `Room ${order.room_number ?? "?"}`;
  }
  return `Table ${order.table_number ?? "?"}`;
}

export default function KitchenOldOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderHeaderResponse[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({ completed: 0, paid: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const statusFilter = (searchParams.get("status") || "all") as "all" | OrderStatus;
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [searchText, setSearchText] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const isInternalScrollRef = useRef(false);

  const statusList: ("all" | OrderStatus)[] = ["all", "completed", "paid", "rejected"];
  const activeIndex = useMemo(() => statusList.indexOf(statusFilter), [statusFilter]);

  const handleStatusChange = useCallback((status: "all" | OrderStatus) => {
    setSearchParams(prev => {
      if (status === "all") prev.delete("status");
      else prev.set("status", status);
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const loadOrders = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Load orders and stats in parallel
      const [ordersRes, statsRes] = await Promise.all([
        api.get<ActiveOrderListResponse>("/orders/history"),
        api.get<Record<string, number>>("/orders/history/stats")
      ]);
      
      setOrders(ordersRes.orders);
      setStats(statsRes);
      setLastUpdated(new Date());
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to load old orders.");
      } else {
        setError("Failed to load old orders.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Handle programmatic tab changes
  useEffect(() => {
    if (scrollRef.current && !isInternalScrollRef.current) {
      const container = scrollRef.current;
      const width = container.clientWidth;
      container.scrollTo({
        left: width * activeIndex,
        behavior: "smooth",
      });
    }
    isInternalScrollRef.current = false;
  }, [activeIndex]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth;
    if (width <= 0) return;

    const index = Math.round(scrollLeft / width);
    const targetStatus = statusList[index];

    if (targetStatus && targetStatus !== statusFilter) {
      isInternalScrollRef.current = true;
      handleStatusChange(targetStatus);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadOrders(true);
    }, 60_000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }

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
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [orders, searchText, sourceFilter, statusFilter]);



  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Kitchen Old Orders</h1>
              <p className="mt-1 text-sm text-slate-600">
                Completed, paid, and rejected order history with auto-refresh every 60 seconds.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadOrders(true)}
              disabled={refreshing}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {lastUpdated && (
            <p className="mt-2 text-xs text-slate-500">Last updated: {lastUpdated.toLocaleTimeString()}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => handleStatusChange("all")}
            className={`flex flex-1 min-w-[120px] items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition-all ${
              statusFilter === "all"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>All Orders</span>
            <span className={`rounded-md px-2 py-0.5 text-xs ${statusFilter === "all" ? "bg-white/20" : "bg-slate-200"}`}>
              {orders.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleStatusChange("completed")}
            className={`flex flex-1 min-w-[120px] items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition-all ${
              statusFilter === "completed"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/50"
            }`}
          >
            <span>Completed</span>
            <span className={`rounded-md px-2 py-0.5 text-xs ${statusFilter === "completed" ? "bg-white/20" : "bg-emerald-200/50"}`}>
              {stats.completed}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleStatusChange("paid")}
            className={`flex flex-1 min-w-[120px] items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition-all ${
              statusFilter === "paid"
                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-100"
                : "bg-cyan-50 text-cyan-700 hover:bg-cyan-100/50"
            }`}
          >
            <span>Paid</span>
            <span className={`rounded-md px-2 py-0.5 text-xs ${statusFilter === "paid" ? "bg-white/20" : "bg-cyan-200/50"}`}>
              {stats.paid}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleStatusChange("rejected")}
            className={`flex flex-1 min-w-[120px] items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition-all ${
              statusFilter === "rejected"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-100"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100/50"
            }`}
          >
            <span>Rejected</span>
            <span className={`rounded-md px-2 py-0.5 text-xs ${statusFilter === "rejected" ? "bg-white/20" : "bg-rose-200/50"}`}>
              {stats.rejected}
            </span>
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search order number / customer / table / room"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />

            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Sources</option>
              <option value="table">Table Orders</option>
              <option value="room">Room Orders</option>
            </select>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {statusList.map((status) => {
              const ordersForStatus = status === "all" 
                ? filteredOrders 
                : filteredOrders.filter(o => o.status === status);

              return (
                <div key={status} className="w-full shrink-0 snap-start">
                  {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-4">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
                      <p className="text-sm text-slate-500 font-medium tracking-wide animate-pulse">
                        Synchronizing order history...
                      </p>
                    </div>
                  ) : error ? (
                    <div className="p-8 text-center text-sm text-rose-700">{error}</div>
                  ) : ordersForStatus.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <span className="text-2xl">📋</span>
                      </div>
                      <p className="text-sm text-slate-500 font-medium">No {status} orders found.</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search text.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 p-4 md:hidden">
                        {ordersForStatus.map((order) => (
                          <article key={order.id} className="group rounded-2xl border border-slate-100 p-4 text-sm transition-all hover:border-slate-300 hover:shadow-md">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-black text-slate-900 tracking-tight">{order.order_number}</p>
                                {order.customer_name && <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{order.customer_name}</p>}
                              </div>
                              <span
                                className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                                  ORDER_STATUS_COLOR[order.status]
                                }`}
                              >
                                {ORDER_STATUS_LABEL[order.status]}
                              </span>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-50 pt-4">
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Source</p>
                                <p className="text-xs font-bold text-slate-700">{sourceLabel(order)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Total</p>
                                <p className="text-xs font-black text-slate-900">{order.total_amount.toFixed(2)}</p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>

                      <div className="app-table-scroll hidden md:block">
                        <table className="min-w-[720px] w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50/50 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            <tr>
                              <th className="px-6 py-4">Order Details</th>
                              <th className="px-6 py-4">Source</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4">Timestamp</th>
                              <th className="px-6 py-4 text-right">Total Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {ordersForStatus.map((order) => (
                              <tr key={order.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-bold text-slate-900">{order.order_number}</div>
                                  {order.customer_name && <div className="text-[10px] font-medium text-slate-400">{order.customer_name}</div>}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-slate-700">{sourceLabel(order)}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                                      ORDER_STATUS_COLOR[order.status]
                                    }`}
                                  >
                                    {ORDER_STATUS_LABEL[order.status]}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-xs font-medium text-slate-500">{formatDateTime(order.placed_at)}</div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="text-sm font-black text-slate-900">{order.total_amount.toFixed(2)}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
