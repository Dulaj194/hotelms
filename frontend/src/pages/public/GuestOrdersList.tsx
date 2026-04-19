import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  getGuestDisplayName,
  getGuestQrAccessKey,
  getGuestToken,
  setGuestSession,
} from "@/hooks/useGuestSession";
import { RESOLVED_API_BASE_URL } from "@/lib/networkBase";
import { publicPost } from "@/lib/publicApi";
import type { OrderHeaderResponse } from "@/types/order";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/types/order";
import type { TableSessionStartResponse } from "@/types/session";

const BASE_URL = RESOLVED_API_BASE_URL;

type OrdersFilterTab = "active" | "completed" | "canceled";

const TAB_TO_STATUSES: Record<OrdersFilterTab, OrderHeaderResponse["status"][]> = {
  active: ["pending", "confirmed", "processing"],
  completed: ["completed", "paid"],
  canceled: ["rejected"],
};

const TAB_LABEL: Record<OrdersFilterTab, string> = {
  active: "Active",
  completed: "Completed",
  canceled: "Canceled",
};

async function fetchGuestOrdersList(): Promise<{ orders: OrderHeaderResponse[]; total: number }> {
  const token = getGuestToken();
  const response = await fetch(`${BASE_URL}/orders/my`, {
    headers: token ? { "X-Guest-Session": token } : {},
  });
  if (!response.ok) {
    throw new Error(`Failed to load orders — ${response.status}`);
  }
  return response.json();
}

const POLL_INTERVAL_MS = 15_000;

export default function GuestOrdersList() {
  const [searchParams] = useSearchParams();
  const { restaurantId, tableNumber } = useParams<{
    restaurantId: string;
    tableNumber: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";
  const parsedRestaurantId = restaurantId ? Number(restaurantId) : NaN;
  const restoredQrAccessKey =
    Number.isNaN(parsedRestaurantId) || !tableNumber
      ? null
      : getGuestQrAccessKey(parsedRestaurantId, tableNumber);
  const effectiveQrAccessKey = qrAccessKey || restoredQrAccessKey || "";
  const [sessionReady, setSessionReady] = useState(Boolean(getGuestToken()));
  const guestName =
    restaurantId && tableNumber
      ? getGuestDisplayName(Number(restaurantId), tableNumber)
      : null;

  const [orders, setOrders] = useState<OrderHeaderResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrdersFilterTab>("active");

  const load = useCallback(async () => {
    try {
      const data = await fetchGuestOrdersList();
      setOrders(data.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getGuestToken()) {
      setSessionReady(true);
      return;
    }

    if (!restaurantId || !tableNumber || !effectiveQrAccessKey || !guestName) {
      setError("Guest session expired. Please scan the table QR code again.");
      return;
    }

    const restoreSession = async () => {
      try {
        const session = await publicPost<TableSessionStartResponse>(
          "/table-sessions/start",
          {
            restaurant_id: Number(restaurantId),
            table_number: tableNumber,
            customer_name: guestName,
            qr_access_key: effectiveQrAccessKey,
          },
        );
        setGuestSession(session);
        setSessionReady(true);
      } catch {
        setError("Could not restore the table session. Please scan the QR code again.");
      }
    };

    void restoreSession();
  }, [effectiveQrAccessKey, guestName, restaurantId, tableNumber]);

  // Initial load
  useEffect(() => {
    if (!sessionReady) return;
    void load();
  }, [load, sessionReady]);

  // Poll for updates
  useEffect(() => {
    if (!sessionReady) return;
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load, sessionReady]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        // Recent first
        return new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime();
      }),
    [orders]
  );

  const tabCounts = useMemo(() => {
    return {
      active: sortedOrders.filter((order) => TAB_TO_STATUSES.active.includes(order.status)).length,
      completed: sortedOrders.filter((order) => TAB_TO_STATUSES.completed.includes(order.status)).length,
      canceled: sortedOrders.filter((order) => TAB_TO_STATUSES.canceled.includes(order.status)).length,
    };
  }, [sortedOrders]);

  const filteredOrders = useMemo(
    () =>
      sortedOrders.filter((order) => {
        return TAB_TO_STATUSES[activeTab].includes(order.status);
      }),
    [activeTab, sortedOrders],
  );

  const emptyTabMessage: Record<OrdersFilterTab, string> = {
    active: "No active orders right now",
    completed: "No completed orders yet",
    canceled: "No canceled orders",
  };

  const formatOrderItemTitle = (order: OrderHeaderResponse): string => {
    const primaryName = order.primary_item_name?.trim();
    if (primaryName) return primaryName;
    const firstPreview = order.item_previews?.[0];
    if (firstPreview?.item_name_snapshot) return firstPreview.item_name_snapshot;
    return order.order_number;
  };

  const formatPlacedAt = (dateString: string): string => {
    return new Date(dateString).toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getItemImageUrl = (imagePath: string | null | undefined): string | null => {
    if (!imagePath) return null;
    return `${BASE_URL}/uploads${imagePath}`;
  };

  const formatBreakdownText = (order: OrderHeaderResponse): string => {
    const previews = order.item_previews ?? [];
    if (previews.length === 0) {
      return `$${order.subtotal_amount.toFixed(2)} + $${order.tax_amount.toFixed(2)} tax`;
    }
    const parts = previews.map(
      (item) => `${item.quantity} x $${item.unit_price_snapshot.toFixed(2)}`,
    );
    const leftSide = parts.join(" + ");
    return `${leftSide} + $${order.tax_amount.toFixed(2)} tax`;
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="animate-pulse text-sm text-slate-500">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbeaec_0%,#f8fafc_35%,#f8fafc_100%)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-rose-100/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-lg px-4 pb-4 pt-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xl font-black tracking-tight text-slate-900">My Orders</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {tableNumber && <span className="rounded-full bg-slate-100 px-2.5 py-1">Table {tableNumber}</span>}
                {guestName && <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-600">{guestName}</span>}
              </div>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
              {orders.length}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-rose-100 bg-white p-1.5 shadow-sm">
            {(["active", "completed", "canceled"] as OrdersFilterTab[]).map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${
                    isActive
                      ? "bg-rose-500 text-white shadow-sm"
                      : "text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                  }`}
                >
                  {TAB_LABEL[tab]} ({tabCounts[tab]})
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 pb-28 pt-4 sm:px-5 sm:pt-5">
        {orders.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="mb-4 text-sm text-slate-500">No orders yet</p>
            {restaurantId && tableNumber && (
              <Link
                to={
                  effectiveQrAccessKey
                    ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                    : `/menu/${restaurantId}/table/${tableNumber}`
                }
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-600"
              >
                Place an order
              </Link>
            )}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-500">{emptyTabMessage[activeTab]}</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const primaryPreview = order.item_previews?.[0];
            const itemCount = order.item_previews?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

            return (
              <Link
                key={order.id}
                to={
                  effectiveQrAccessKey
                    ? `/menu/${order.restaurant_id}/table/${order.table_number}/order/${order.id}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                    : `/menu/${order.restaurant_id}/table/${order.table_number}/order/${order.id}`
                }
                className="rounded-3xl border border-rose-100 bg-white p-4 shadow-sm transition hover:border-rose-200 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    {primaryPreview?.item_image_snapshot ? (
                      <img
                        src={getItemImageUrl(primaryPreview.item_image_snapshot) ?? undefined}
                        alt={formatOrderItemTitle(order)}
                        className="h-16 w-16 rounded-2xl object-cover ring-1 ring-rose-100"
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f1f5f9' width='100' height='100'/%3E%3C/svg%3E";
                        }}
                      />
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-[11px] font-semibold text-slate-400">
                        No img
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-bold text-slate-900 sm:text-[15px]">
                        {formatOrderItemTitle(order)}
                      </p>
                      <p className="shrink-0 text-sm font-extrabold text-rose-600">
                        ${order.total_amount.toFixed(2)}
                      </p>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{formatPlacedAt(order.placed_at)}</span>
                      <span>x{itemCount || 1}</span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          ORDER_STATUS_COLOR[order.status]
                        }`}
                      >
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                      <span className="truncate text-[11px] text-slate-500">{formatBreakdownText(order)}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeTab === "active" && (
                        <span className="rounded-full bg-rose-500 px-3 py-1 text-[11px] font-bold text-white">
                          Track order
                        </span>
                      )}
                      {activeTab === "completed" && (
                        <>
                          <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-600">
                            Leave a review
                          </span>
                          {restaurantId && tableNumber && (
                            <span className="rounded-full bg-rose-500 px-3 py-1 text-[11px] font-bold text-white">
                              Order again
                            </span>
                          )}
                        </>
                      )}
                      {activeTab === "canceled" && (
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-600">
                          Order canceled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </main>

      {restaurantId && tableNumber && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rose-100 bg-white/95 px-4 py-3 backdrop-blur sm:mx-auto sm:w-full sm:max-w-lg sm:px-5">
          <Link
            to={
              effectiveQrAccessKey
                ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                : `/menu/${restaurantId}/table/${tableNumber}`
            }
            className="block w-full rounded-2xl bg-slate-900 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Back to menu
          </Link>
        </div>
      )}
    </div>
  );
}
