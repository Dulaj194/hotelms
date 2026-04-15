import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getGuestDisplayName, getGuestToken } from "@/hooks/useGuestSession";
import { RESOLVED_API_BASE_URL } from "@/lib/networkBase";
import type { OrderHeaderResponse } from "@/types/order";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/types/order";

const BASE_URL = RESOLVED_API_BASE_URL;

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
  const guestName =
    restaurantId && tableNumber
      ? getGuestDisplayName(Number(restaurantId), tableNumber)
      : null;

  const [orders, setOrders] = useState<OrderHeaderResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Initial load
  useEffect(() => {
    void load();
  }, [load]);

  // Poll for updates
  useEffect(() => {
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        // Recent first
        return new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime();
      }),
    [orders]
  );

  const formatOrderItemTitle = (order: OrderHeaderResponse): string => {
    const primaryName = order.primary_item_name?.trim();
    if (primaryName) return primaryName;
    const firstPreview = order.item_previews?.[0];
    if (firstPreview?.item_name_snapshot) return firstPreview.item_name_snapshot;
    return order.order_number;
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900">My Orders</p>
            {restaurantId && tableNumber && (
              <p className="text-xs text-slate-500">Table {tableNumber}</p>
            )}
            {guestName && <p className="text-xs font-medium text-orange-600">Guest: {guestName}</p>}
          </div>
          <span className="text-sm font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">
            {orders.length}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col space-y-3 px-4 py-4 sm:px-5 sm:py-6">
        {sortedOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-slate-500 mb-4">No orders yet</p>
            {restaurantId && tableNumber && (
              <Link
                to={
                  qrAccessKey
                    ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(qrAccessKey)}`
                    : `/menu/${restaurantId}/table/${tableNumber}`
                }
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Place an order
              </Link>
            )}
          </div>
        ) : (
          sortedOrders.map((order) => (
            <Link
              key={order.id}
              to={
                qrAccessKey
                  ? `/menu/${order.restaurant_id}/table/${order.table_number}/order/${order.id}?k=${encodeURIComponent(qrAccessKey)}`
                  : `/menu/${order.restaurant_id}/table/${order.table_number}/order/${order.id}`
              }
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-slate-300 sm:p-5"
            >
              {/* Image + Name/Status Section */}
              <div className="flex items-start gap-3">
                {/* Circular Image */}
                <div className="shrink-0">
                  {order.item_previews?.[0]?.item_image_snapshot ? (
                    <img
                      src={getItemImageUrl(order.item_previews[0].item_image_snapshot) ?? undefined}
                      alt={formatOrderItemTitle(order)}
                      className="h-16 w-16 rounded-full border-2 border-slate-100 object-cover shadow-sm"
                      onError={(e) => {
                        // Fallback to placeholder if image fails
                        const img = e.currentTarget;
                        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23e2e8f0' width='100' height='100'/%3E%3C/svg%3E";
                      }}
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-100 bg-slate-100 shadow-sm">
                      <span className="text-xs text-slate-400">No image</span>
                    </div>
                  )}
                </div>

                {/* Name, Status, Breakdown */}
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="text-base font-semibold text-slate-900 capitalize truncate">
                      {formatOrderItemTitle(order)}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                        ORDER_STATUS_COLOR[order.status]
                      }`}
                    >
                      {ORDER_STATUS_LABEL[order.status]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="text-sm text-slate-500">
                  {formatBreakdownText(order)}
                </div>
                <div className="shrink-0 text-lg font-bold text-slate-900">
                  ${order.total_amount.toFixed(2)}
                </div>
              </div>
            </Link>
          ))
        )}
      </main>

      {/* Back to menu button */}
      {restaurantId && tableNumber && (
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.05)] backdrop-blur sm:mx-auto sm:w-full sm:max-w-lg sm:px-5">
          <Link
            to={
              qrAccessKey
                ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(qrAccessKey)}`
                : `/menu/${restaurantId}/table/${tableNumber}`
            }
            className="block w-full rounded-xl border border-orange-200 bg-orange-50 py-3 text-center text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
          >
            ← Back to menu
          </Link>
        </div>
      )}
    </div>
  );
}
