import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
import type { OrderDetailResponse } from "@/types/order";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/types/order";

const CANCEL_WINDOW_SECONDS = 10;

function parseServerTimestamp(value: string): number {
  // Backend may return naive datetime strings (no timezone suffix).
  // Treat those as UTC so countdown doesn't expire incorrectly on client timezone.
  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const normalized = hasTimezone ? value : `${value}Z`;
  return new Date(normalized).getTime();
}

function getRemainingCancelSeconds(order: OrderDetailResponse | null): number {
  if (!order || order.status !== "pending") return 0;
  const placedMs = parseServerTimestamp(order.placed_at);
  if (Number.isNaN(placedMs)) return 0;
  const elapsedSeconds = Math.floor((Date.now() - placedMs) / 1000);
  return Math.max(0, CANCEL_WINDOW_SECONDS - elapsedSeconds);
}

const POLL_INTERVAL_MS = 15_000; // refresh every 15 s

const FINALIZED: Set<string> = new Set(["completed", "served", "paid", "rejected"]);

export default function TableOrderStatus() {
  const [searchParams] = useSearchParams();
  const { restaurantId, tableNumber, orderId } = useParams<{
    restaurantId: string;
    tableNumber: string;
    orderId: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";
  const effectiveQrAccessKey = resolveTableQrAccessKey(restaurantId, tableNumber, qrAccessKey);
  const [sessionReady, setSessionReady] = useState(Boolean(getGuestToken()));
  const guestName = resolveTableGuestName(restaurantId, tableNumber);

  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelRemaining, setCancelRemaining] = useState(0);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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
    if (!orderId) return;
    try {
      const data = await fetchGuestSessionJson<OrderDetailResponse>(`/orders/my/${orderId}`);
      setOrder(data);
      setCancelRemaining(getRemainingCancelSeconds(data));
    } catch (err) {
      if (isSessionHttpError(err, 401)) {
        const restored = await restoreGuestSession();
        if (restored) {
          try {
            const retried = await fetchGuestSessionJson<OrderDetailResponse>(`/orders/my/${orderId}`);
            setOrder(retried);
            setCancelRemaining(getRemainingCancelSeconds(retried));
            return;
          } catch (retryErr) {
            setError(retryErr instanceof Error ? retryErr.message : "Could not load order.");
            return;
          }
        }

        setError("Guest session expired. Please scan the table QR code again.");
        return;
      }

      setError(err instanceof Error ? err.message : "Could not load order.");
    }
  }, [orderId, restoreGuestSession]);

  useEffect(() => {
    if (getGuestToken()) {
      setSessionReady(true);
      return;
    }

    if (!restaurantId || !tableNumber || !effectiveQrAccessKey) {
      setError("Guest session expired. Please scan the table QR code again.");
      return;
    }

    if (!guestName) {
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

  const handleCancelOrder = useCallback(async () => {
    if (!orderId || cancelRemaining <= 0 || canceling) return;
    setCancelError(null);
    setCanceling(true);
    try {
      await fetchGuestSessionJson<unknown>(`/orders/my/${orderId}/cancel`, { method: "POST" });
      await load();
    } catch (err) {
      if (isSessionHttpError(err, 401)) {
        const restored = await restoreGuestSession();
        if (restored) {
          try {
            await fetchGuestSessionJson<unknown>(`/orders/my/${orderId}/cancel`, { method: "POST" });
            await load();
            return;
          } catch (retryErr) {
            setCancelError(
              retryErr instanceof Error ? retryErr.message : "Could not cancel order.",
            );
            return;
          }
        }

        setCancelError("Guest session expired. Please scan the table QR code again.");
        return;
      }

      setCancelError(err instanceof Error ? err.message : "Could not cancel order.");
    } finally {
      setCanceling(false);
    }
  }, [cancelRemaining, canceling, load, orderId, restoreGuestSession]);

  // Initial load
  useEffect(() => {
    if (!sessionReady) return;
    void load();
  }, [load, sessionReady]);

  // Poll until finalized
  useEffect(() => {
    if (!order || FINALIZED.has(order.status) || !sessionReady) return;
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [order, load, sessionReady]);

  useEffect(() => {
    setCancelRemaining(getRemainingCancelSeconds(order));
    if (!order || order.status !== "pending") return;
    const timer = setInterval(() => {
      setCancelRemaining(getRemainingCancelSeconds(order));
    }, 1000);
    return () => clearInterval(timer);
  }, [order]);

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <p className="animate-pulse text-sm text-slate-500">Loading order...</p>
      </div>
    );
  }

  const statusLabel = ORDER_STATUS_LABEL[order.status];
  const statusColor = ORDER_STATUS_COLOR[order.status];
  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">{order.order_number}</p>
            <p className="text-xs text-slate-500">Table {order.table_number}</p>
            {guestName && <p className="text-xs text-orange-600">Guest: {guestName}</p>}
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col space-y-4 px-4 py-4 pb-28 sm:px-5 sm:py-6 sm:pb-8">
        {/* Status timeline */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-sm">
            Order Status
          </h2>
          <OrderTimeline order={order} />
        </section>

        {/* Items */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-sm">
            Items
          </h2>
          <div className="mt-3 space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{item.item_name_snapshot}</p>
                  <p className="text-xs text-slate-500">
                  {item.quantity} x ${item.unit_price_snapshot.toFixed(2)}
                  </p>
                </div>
                <p className="ml-2 shrink-0 font-semibold text-slate-900">${item.line_total.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Totals */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm sm:p-5">
          <div className="flex justify-between py-1">
            <span className="text-slate-500">Subtotal</span>
            <span>${order.subtotal_amount.toFixed(2)}</span>
          </div>
          {order.tax_amount > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Tax</span>
              <span>${order.tax_amount.toFixed(2)}</span>
            </div>
          )}
          {order.discount_amount > 0 && (
            <div className="flex justify-between py-1 text-emerald-600">
              <span>Discount</span>
              <span>-${order.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
            <span>Total</span>
            <span>${order.total_amount.toFixed(2)}</span>
          </div>
        </section>

        {/* Notes */}
        {order.notes && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm sm:p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Notes
            </p>
            <p className="text-slate-700">{order.notes}</p>
          </section>
        )}

        {!FINALIZED.has(order.status) && (
          <p className="text-center text-xs text-slate-400">
            This page refreshes automatically every 15 seconds.
          </p>
        )}

        {/* Navigation buttons */}
        {restaurantId && tableNumber && (
          <div className="flex flex-col gap-2">
            <Link
              to={
                effectiveQrAccessKey
                  ? `/orders/my/${restaurantId}/${tableNumber}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                  : `/orders/my/${restaurantId}/${tableNumber}`
              }
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-50 border border-blue-200 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              View my orders
            </Link>
            <Link
              to={
                effectiveQrAccessKey
                  ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                  : `/menu/${restaurantId}/table/${tableNumber}`
              }
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-orange-200 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
            >
              Back to menu
            </Link>
          </div>
        )}
      </main>

      {order.status === "pending" && cancelRemaining > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:mx-auto sm:w-full sm:max-w-lg sm:border-t-0 sm:bg-transparent sm:px-5 sm:pb-0 sm:pt-0 sm:shadow-none">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 sm:mb-6 sm:bg-white">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">
                Quick Cancel Window
              </p>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                {cancelRemaining}s
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleCancelOrder()}
              disabled={canceling}
              className="min-h-12 w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canceling ? "Cancelling..." : `Cancel Order (${cancelRemaining}s)`}
            </button>
            {cancelError && <p className="mt-2 text-xs text-red-600">{cancelError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Timeline component ────────────────────────────────────────────────────────

const LIFECYCLE_STEPS: Array<{ status: OrderDetailResponse["status"]; label: string }> = [
  { status: "pending", label: "Order placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "processing", label: "Being prepared" },
  { status: "completed", label: "Ready" },
  { status: "served", label: "Served" },
  { status: "paid", label: "Paid" },
];

function OrderTimeline({ order }: { order: OrderDetailResponse }) {
  if (order.status === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
        <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
        <span className="text-sm font-medium">Order rejected</span>
      </div>
    );
  }

  const statusIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === order.status);

  return (
    <ol className="flex flex-col gap-2.5">
      {LIFECYCLE_STEPS.map((step, idx) => {
        const done = idx < statusIndex;
        const current = idx === statusIndex;
        return (
          <li key={step.status} className="flex items-center gap-3 rounded-lg px-1 py-1 text-sm">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                done
                  ? "bg-green-500"
                  : current
                  ? "bg-orange-500 ring-2 ring-orange-200"
                  : "bg-gray-200"
              }`}
            />
            <span
              className={
                current
                  ? "font-semibold text-gray-900"
                  : done
                  ? "text-gray-500 line-through"
                  : "text-gray-400"
              }
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
