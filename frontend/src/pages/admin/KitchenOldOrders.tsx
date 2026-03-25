import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [orders, setOrders] = useState<OrderHeaderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [searchText, setSearchText] = useState("");

  const loadOrders = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await api.get<ActiveOrderListResponse>("/orders/history");
      setOrders(response.orders);
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

  const statusCounts = useMemo(() => {
    return KITCHEN_HISTORY_STATUSES.reduce<Record<OrderStatus, number>>(
      (acc, status) => {
        acc[status] = orders.filter((order) => order.status === status).length;
        return acc;
      },
      {
        pending: 0,
        confirmed: 0,
        processing: 0,
        completed: 0,
        paid: 0,
        rejected: 0,
      }
    );
  }, [orders]);

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

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Completed: <span className="font-semibold">{statusCounts.completed}</span>
          </div>
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">
            Paid: <span className="font-semibold">{statusCounts.paid}</span>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Rejected: <span className="font-semibold">{statusCounts.rejected}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search order number / customer / table / room"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>

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

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading old orders...</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-rose-700">{error}</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No old orders found for current filters.</div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {filteredOrders.map((order) => (
                  <article key={order.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{order.order_number}</p>
                        {order.customer_name && <p className="text-xs text-slate-500">{order.customer_name}</p>}
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          ORDER_STATUS_COLOR[order.status]
                        }`}
                      >
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p>Source: {sourceLabel(order)}</p>
                      <p>Placed At: {formatDateTime(order.placed_at)}</p>
                      <p>Total: {order.total_amount.toFixed(2)}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="app-table-scroll hidden md:block">
                <table className="min-w-[720px] w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Placed At</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{order.order_number}</div>
                          {order.customer_name && <div className="text-xs text-slate-500">{order.customer_name}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{sourceLabel(order)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              ORDER_STATUS_COLOR[order.status]
                            }`}
                          >
                            {ORDER_STATUS_LABEL[order.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(order.placed_at)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {order.total_amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
