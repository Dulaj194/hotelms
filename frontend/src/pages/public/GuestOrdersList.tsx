import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowLeft,
  CheckCircle,
  Plus,
  Receipt,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getGuestToken,
} from "@/hooks/useGuestSession";
import { isSessionHttpError } from "@/features/public/sessionHttp";
import {
  fetchGuestSessionJson,
  resolveTableGuestName,
  resolveTableQrAccessKey,
  restoreTableGuestSession,
} from "@/features/public/tableSession";
import type { OrderHeaderResponse } from "@/types/order";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/types/order";
import { toAssetUrl } from "@/lib/assets";


type OrdersFilterTab = "active" | "completed" | "canceled";

const TAB_TO_STATUSES: Record<OrdersFilterTab, OrderHeaderResponse["status"][]> = {
  active: ["pending", "confirmed", "processing"],
  completed: ["completed", "served", "paid"],
  canceled: ["rejected"],
};

const TAB_LABEL: Record<OrdersFilterTab, string> = {
  active: "Active",
  completed: "Completed",
  canceled: "Canceled",
};

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

const POLL_INTERVAL_MS = 5_000;

export default function GuestOrdersList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { restaurantId, tableNumber } = useParams<{
    restaurantId: string;
    tableNumber: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";
  const effectiveQrAccessKey = resolveTableQrAccessKey(restaurantId, tableNumber, qrAccessKey);
  const [sessionReady, setSessionReady] = useState(Boolean(getGuestToken()));
  const guestName = resolveTableGuestName(restaurantId, tableNumber);

  const [orders, setOrders] = useState<OrderHeaderResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingBill, setRequestingBill] = useState(false);
  const [billRequested, setBillRequested] = useState(false);
  const [activeTab, setActiveTab] = useState<OrdersFilterTab>("active");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  const restoreGuestSession = useCallback(async (): Promise<boolean> => {
    const restored = await restoreTableGuestSession({
      restaurantId,
      tableNumber,
      qrAccessKey: effectiveQrAccessKey,
      guestName,
    });
    if (restored) {
      setSessionReady(true);
      setError(null);
    }
    return restored;
  }, [effectiveQrAccessKey, guestName, restaurantId, tableNumber]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchGuestSessionJson<{ orders: OrderHeaderResponse[]; total: number }>(
        "/orders/my",
      );
      setOrders(data.orders);
    } catch (err) {
      if (isSessionHttpError(err, 401)) {
        const restored = await restoreGuestSession();
        if (restored) {
          try {
            const retried = await fetchGuestSessionJson<{
              orders: OrderHeaderResponse[];
              total: number;
            }>("/orders/my");
            setOrders(retried.orders);
            return;
          } catch (retryErr) {
            setError(retryErr instanceof Error ? retryErr.message : "Could not load orders.");
            return;
          }
        }

        setError("Guest session expired. Please scan the table QR code again.");
        return;
      }

      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [restoreGuestSession]);

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
      const restored = await restoreGuestSession();
      if (!restored) {
        setError("Could not restore the table session. Please scan the QR code again.");
      }
    };

    void restoreSession();
  }, [effectiveQrAccessKey, guestName, restaurantId, restoreGuestSession, tableNumber]);

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

  const handleRequestBill = async () => {
    setRequestingBill(true);
    try {
      await fetchGuestSessionJson("/table-sessions/my/request-bill", {
        method: "POST",
      });
      setBillRequested(true);
    } catch (err) {
      console.error("Failed to request bill:", err);
      // Even if it fails, we might want to show a message, but for now we keep it simple
    } finally {
      setRequestingBill(false);
    }
  };

  const totals = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        if (order.status !== "rejected") {
          acc.total += order.total_amount;
          acc.items += (order.item_previews ?? []).reduce((sum: number, item: any) => sum + item.quantity, 0);
        }
        return acc;
      },
      { total: 0, items: 0 },
    );
  }, [orders]);

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

  const groupedOrders = useMemo(() => {
    return {
      active: sortedOrders.filter((order) => TAB_TO_STATUSES.active.includes(order.status)),
      completed: sortedOrders.filter((order) => TAB_TO_STATUSES.completed.includes(order.status)),
      canceled: sortedOrders.filter((order) => TAB_TO_STATUSES.canceled.includes(order.status)),
    };
  }, [sortedOrders]);

  const tabs: OrdersFilterTab[] = ["active", "completed", "canceled"];

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isScrollingRef.current) return;
    const { scrollLeft, clientWidth } = e.currentTarget;
    if (clientWidth <= 0) return;

    const index = Math.round(scrollLeft / clientWidth);
    const targetTab = tabs[index];
    if (targetTab && targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
  };

  const handleTabClick = (tab: OrdersFilterTab) => {
    const index = tabs.indexOf(tab);
    if (index === -1) return;

    setActiveTab(tab);

    if (scrollRef.current) {
      isScrollingRef.current = true;
      const width = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({
        left: width * index,
        behavior: "smooth",
      });

      // Use a slightly longer timeout to ensure smooth scroll finishes
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 600);
    }
  };

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

  const getItemImageUrl = (imagePath: string | null | undefined): string | undefined => {
    return toAssetUrl(imagePath);
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
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <p className="animate-pulse text-sm text-slate-500">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#fbeaec_0%,#f8fafc_35%,#f8fafc_100%)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-rose-100/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-lg px-4 pb-4 pt-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const menuPath = effectiveQrAccessKey
                    ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                    : `/menu/${restaurantId}/table/${tableNumber}`;
                  navigate(menuPath);
                }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-900 transition hover:bg-slate-200"
                aria-label="Back to menu"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-xl font-black tracking-tight text-slate-900">My Orders</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {tableNumber && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">Table {tableNumber}</span>
                  )}
                  {guestName && (
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-600">
                      {guestName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>


          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-rose-100 bg-white p-1.5 shadow-sm">
            {tabs.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabClick(tab)}
                  className={`rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${isActive
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

      <main className="mx-auto w-full max-w-lg pb-32">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="no-scrollbar flex overflow-x-auto snap-x snap-mandatory pt-4 sm:pt-5"
        >
          {tabs.map((tab) => (
            <div key={tab} className="w-full shrink-0 snap-start px-4 sm:px-5">
              <div className="flex flex-col gap-3 pb-12 min-h-[60dvh]">
                {groupedOrders[tab].length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <p className={`text-sm font-medium text-slate-500 ${tab === 'active' && orders.length === 0 ? 'mb-4' : ''}`}>
                      {tab === 'active' && orders.length === 0 ? "No orders yet" : emptyTabMessage[tab]}
                    </p>
                    {tab === 'active' && orders.length === 0 && restaurantId && tableNumber && (
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
                ) : (
                  groupedOrders[tab].map((order) => {
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
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ORDER_STATUS_COLOR[order.status]
                                  }`}
                              >
                                {ORDER_STATUS_LABEL[order.status]}
                              </span>
                              <span className="truncate text-[11px] text-slate-500">{formatBreakdownText(order)}</span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {tab === "active" && (
                                <span className="rounded-full bg-rose-500 px-3 py-1 text-[11px] font-bold text-white">
                                  Track order
                                </span>
                              )}
                              {tab === "completed" && (
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
                              {tab === "canceled" && (
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
              </div>
            </div>
          ))}
        </div>
      </main>


      {/* Senior Engineer Billing Dashboard - Sticky Footer */}
      {orders.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/95 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          {tabCounts.completed === 0 && (
            <div className="bg-slate-900 py-1.5 px-4">
              <p className="text-center text-[9px] font-black uppercase tracking-[0.12em] text-rose-500">
                Wait for order to be served to request bill
              </p>
            </div>
          )}
          <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Running Bill
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-900">{formatCurrency(totals.total)}</span>
                <span className="text-[10px] font-bold text-slate-400">({totals.items} items)</span>
              </div>
            </div>

            {tabCounts.completed > 0 ? (
              <button
                type="button"
                disabled={requestingBill || billRequested}
                onClick={handleRequestBill}
                className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black transition-all duration-300 active:scale-95 ${billRequested
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    : "bg-slate-900 text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] hover:bg-slate-800"
                  }`}
              >
                {requestingBill ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Processing...
                  </span>
                ) : billRequested ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Bill Requested
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4" />
                    Request Bill
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const menuPath = effectiveQrAccessKey
                    ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                    : `/menu/${restaurantId}/table/${tableNumber}`;
                  navigate(menuPath);
                }}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 text-sm font-black text-white shadow-[0_14px_28px_rgba(249,115,22,0.2)] transition hover:bg-orange-600 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Add Items
              </button>
            )}
          </div>
        </div>
      ) : (
        restaurantId && tableNumber && (
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
        )
      )}
    </div>
  );
}
