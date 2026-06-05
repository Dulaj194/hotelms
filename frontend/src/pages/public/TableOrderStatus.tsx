import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  getGuestToken,
} from "@/hooks/useGuestSession";
import { useTranslation } from "react-i18next";
import { isSessionHttpError } from "@/features/public/sessionHttp";
import {
  fetchGuestSessionJson,
  resolveTableGuestName,
  resolveTableQrAccessKey,
  restoreTableGuestSession,
} from "@/features/public/tableSession";
import type { OrderDetailResponse } from "@/types/order";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/types/order";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";

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
  const { t, i18n } = useTranslation(["common", "menu", "cart"]);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  useEffect(() => {
    const handleLangChange = (lng: string) => {
      setCurrentLanguage(lng);
    };
    i18n.on("languageChanged", handleLangChange);
    return () => {
      i18n.off("languageChanged", handleLangChange);
    };
  }, [i18n]);

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

        setError(t("cart:guest_session_expired"));
        return;
      }

      setError(err instanceof Error ? err.message : "Could not load order.");
    }
  }, [orderId, restoreGuestSession, t]);

  useEffect(() => {
    if (getGuestToken()) {
      setSessionReady(true);
      return;
    }

    if (!restaurantId || !tableNumber || !effectiveQrAccessKey) {
      setError(t("cart:guest_session_expired"));
      return;
    }

    if (!guestName) {
      setError(t("cart:guest_session_expired"));
      return;
    }

    const restoreSession = async () => {
      const restored = await restoreGuestSession();
      if (!restored) {
        setError(t("cart:could_not_restore_session"));
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

        setCancelError(t("cart:guest_session_expired"));
        return;
      }

      setCancelError(err instanceof Error ? err.message : "Could not cancel order.");
    } finally {
      setCanceling(false);
    }
  }, [cancelRemaining, canceling, load, orderId, restoreGuestSession, t]);

  // Initial load
  useEffect(() => {
    if (!sessionReady) return;
    void load();
  }, [load, sessionReady, currentLanguage]);

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
        <p className="animate-pulse text-sm text-slate-500">{t("cart:loading_order")}</p>
      </div>
    );
  }

  const statusLabel = ORDER_STATUS_LABEL[order.status];
  const statusColor = ORDER_STATUS_COLOR[order.status];
  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col selection:bg-orange-200">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">{order.order_number}</p>
            <p className="text-xs text-slate-500">Table {order.table_number}</p>
            {guestName && <p className="text-xs text-orange-600">Guest: {guestName}</p>}
          </div>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusColor}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col space-y-5 px-4 py-6 pb-28 sm:px-5 sm:py-8">
        {/* Status timeline */}
        <section className="rounded-[2rem] border border-white/80 bg-white/60 p-5 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:bg-white/80 sm:p-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-sm">
            {t("cart:order_status_title")}
          </h2>
          <OrderTimeline order={order} />
        </section>

        {/* Items */}
        <section className="rounded-[2rem] border border-white/80 bg-white/60 p-5 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:bg-white/80 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-sm">
            {t("cart:items")}
          </h2>
          <div className="mt-3 space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="group flex items-start justify-between gap-3 rounded-2xl border border-white/50 bg-white/50 px-4 py-3.5 text-sm shadow-sm transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">
                    {item.item_name_snapshot_localized || item.item_name_snapshot}
                  </p>
                  {item.notes && (
                    <p className="mt-0.5 text-[10px] font-medium text-orange-600 italic">
                      “{item.notes}”
                    </p>
                  )}
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
        <section className="rounded-[2rem] border border-white/80 bg-white/60 p-5 text-sm shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:bg-white/80 sm:p-6">
          <div className="flex justify-between py-1">
            <span className="text-slate-500">{t("cart:subtotal")}</span>
            <span>${order.subtotal_amount.toFixed(2)}</span>
          </div>
          {order.tax_amount > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-slate-500">{t("cart:tax")}</span>
              <span>${order.tax_amount.toFixed(2)}</span>
            </div>
          )}
          {order.discount_amount > 0 && (
            <div className="flex justify-between py-1 text-emerald-600">
              <span>{t("cart:discount")}</span>
              <span>-${order.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
            <span>{t("cart:total")}</span>
            <span>${order.total_amount.toFixed(2)}</span>
          </div>
        </section>

        {/* Notes */}
        {order.notes && (
          <section className="rounded-[2rem] border border-white/80 bg-white/60 p-5 text-sm shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:bg-white/80 sm:p-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {t("cart:notes")}
            </p>
            <p className="text-slate-700">{order.notes}</p>
          </section>
        )}

        {!FINALIZED.has(order.status) && (
          <p className="text-center text-xs text-slate-400">
            {t("cart:auto_refresh_notice")}
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
              className="group relative inline-flex min-h-[3.25rem] w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-900 px-6 text-sm font-medium text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-95"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                <div className="relative h-full w-8 bg-white/20" />
              </div>
              <span className="relative z-10">{t("cart:view_my_orders")}</span>
            </Link>
            <Link
              to={
                effectiveQrAccessKey
                  ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                  : `/menu/${restaurantId}/table/${tableNumber}`
              }
              className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 shadow-sm transition-all duration-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
            >
              {t("cart:back_to_menu")}
            </Link>
          </div>
        )}
      </main>

      {order.status === "pending" && cancelRemaining > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/40 bg-white/80 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl sm:static sm:mx-auto sm:w-full sm:max-w-lg sm:border-t-0 sm:bg-transparent sm:px-5 sm:pb-0 sm:pt-0 sm:shadow-none">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 sm:mb-6 sm:bg-white">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">
                {t("cart:quick_cancel_window")}
              </p>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                {cancelRemaining}s
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleCancelOrder()}
              disabled={canceling}
              className="min-h-[3.25rem] w-full rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/30 transition-all duration-300 hover:bg-red-700 hover:shadow-xl hover:shadow-red-600/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canceling ? t("cart:cancelling") : `${t("cart:cancel_order")} (${cancelRemaining}s)`}
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
  const { t } = useTranslation(["common", "menu", "cart"]);
  if (order.status === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
        <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
        <span className="text-sm font-medium">{t("cart:order_rejected_timeline")}</span>
      </div>
    );
  }

  const statusIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="relative mt-2 pl-2">
      <div className="absolute bottom-4 left-[11px] top-4 w-[2px] bg-gradient-to-b from-orange-200 via-slate-200 to-slate-100" />
      <ol className="relative z-10 flex flex-col gap-5">
        {LIFECYCLE_STEPS.map((step, idx) => {
          const done = idx < statusIndex;
          const current = idx === statusIndex;
          
          let displayLabel = step.label;
          if (step.status === "pending") displayLabel = t("cart:order_placed_timeline");
          else if (step.status === "confirmed") displayLabel = t("cart:confirmed_timeline");
          else if (step.status === "processing") displayLabel = t("cart:being_prepared_timeline");
          else if (step.status === "completed") displayLabel = t("cart:ready_timeline");
          else if (step.status === "served") displayLabel = t("cart:served_timeline");
          else if (step.status === "paid") displayLabel = t("cart:paid_timeline");

          return (
            <li key={step.status} className="group flex items-center gap-4">
              <div
                className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                  done
                    ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
                    : current
                    ? "bg-orange-500 shadow-lg shadow-orange-500/40 ring-4 ring-orange-100"
                    : "bg-white border-2 border-slate-200"
                }`}
              >
                {current && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                )}
                {done && (
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {current && <span className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <span
                className={`text-sm transition-all duration-300 ${
                  current
                    ? "font-bold text-slate-900 tracking-tight"
                    : done
                    ? "font-medium text-slate-500"
                    : "font-medium text-slate-400"
                }`}
              >
                {displayLabel}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
