import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { getRoomToken } from "@/hooks/useRoomSession";
import { useTranslation } from "react-i18next";
import { isSessionHttpError } from "@/features/public/sessionHttp";
import { fetchRoomSessionJson, restoreRoomSession } from "@/features/public/roomSession";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from "@/types/order";
import type {
  RoomOrderDetailResponse,
} from "@/types/roomSession";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { 
  ClipboardList, 
  CheckCircle2, 
  ChefHat, 
  BellRing, 
  Utensils, 
  CreditCard,
  XCircle 
} from "lucide-react";
const CANCEL_WINDOW_SECONDS = 10;

const POLL_INTERVAL_MS = 15_000;
const FINALIZED: Set<OrderStatus> = new Set(["completed", "served", "paid", "rejected"]);

function parseServerTimestamp(value: string): number {
  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const normalized = hasTimezone ? value : `${value}Z`;
  return new Date(normalized).getTime();
}

function isKnownOrderStatus(value: string): value is OrderStatus {
  return value in ORDER_STATUS_LABEL;
}

function getRemainingCancelSeconds(order: RoomOrderDetailResponse | null): number {
  if (!order) return 0;
  if (order.status !== "pending" && order.status !== "confirmed") return 0;
  const placedMs = parseServerTimestamp(order.placed_at);
  if (Number.isNaN(placedMs)) return 0;
  const elapsedSeconds = Math.floor((Date.now() - placedMs) / 1000);
  return Math.max(0, CANCEL_WINDOW_SECONDS - elapsedSeconds);
}

function OrderTimeline({ order }: { order: RoomOrderDetailResponse }) {
  const { t } = useTranslation(["common", "menu", "cart"]);
  const steps: Array<{ status: OrderStatus; label: string }> = [
    { status: "pending", label: t("cart:order_placed_timeline") },
    { status: "confirmed", label: t("cart:confirmed_timeline") },
    { status: "processing", label: t("cart:being_prepared_timeline") },
    { status: "completed", label: t("cart:ready_delivery_timeline") },
    { status: "served", label: t("cart:delivered_timeline") },
    { status: "paid", label: t("cart:charged_folio_timeline") },
  ];

  if (!isKnownOrderStatus(order.status)) {
    return (
      <div className="text-sm text-slate-500">
        Current status: <strong>{order.status}</strong>
      </div>
    );
  }

  if (order.status === "rejected") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-700 shadow-sm backdrop-blur-md">
        <XCircle className="h-6 w-6 text-red-500" />
        <span className="text-sm font-semibold">{t("cart:order_rejected_timeline")}</span>
      </div>
    );
  }

  const currentStepIndex = steps.findIndex((step) => step.status === order.status);

  // Custom icons mapping
  const ICONS: Record<string, React.ElementType> = {
    pending: ClipboardList,
    confirmed: CheckCircle2,
    processing: ChefHat,
    completed: BellRing,
    served: Utensils,
    paid: CreditCard,
  };

  return (
    <div className="relative w-full pb-2 pt-2">
      <div className="w-full relative">
        {/* Line Container */}
        <div className="absolute top-[15px] sm:top-[21px] left-[1.5rem] right-[1.5rem] sm:left-[2rem] sm:right-[2rem]">
          <div className="w-full h-[2px] bg-slate-200 absolute top-0" />
          <div 
            className="absolute top-0 left-0 h-[3px] bg-gradient-to-r from-orange-400 to-emerald-400 transition-all duration-700 ease-out rounded-full" 
            style={{ width: `${(Math.max(0, currentStepIndex) / (steps.length - 1)) * 100}%` }}
          />
        </div>
        
        <ol className="relative z-10 flex justify-between w-full">
          {steps.map((step, index) => {
            const passed = index < currentStepIndex;
            const current = index === currentStepIndex;
            const Icon = ICONS[step.status] || ClipboardList;

            return (
              <li key={step.status} className="group flex flex-col items-center gap-1.5 sm:gap-3 relative w-12 sm:w-16">
                <div
                  className={`relative flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full transition-all duration-500 z-10 ${
                    passed
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : current
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40 ring-4 ring-orange-100 scale-110"
                      : "bg-white text-slate-400 border-2 border-slate-200"
                  }`}
                >
                  {current && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                  )}
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${current ? 'scale-110' : ''}`} strokeWidth={current ? 2.5 : 2} />
                </div>
                <span
                  className={`text-[9px] sm:text-[11px] leading-tight text-center transition-all duration-300 ${
                    current
                      ? "font-bold text-slate-900 scale-105"
                      : passed
                      ? "font-semibold text-slate-600"
                      : "font-medium text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export default function RoomOrderStatus() {
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
  const { restaurantId, roomNumber, orderId } = useParams<{
    restaurantId: string;
    roomNumber: string;
    orderId: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";

  const [sessionReady, setSessionReady] = useState<boolean>(Boolean(getRoomToken()));
  const [order, setOrder] = useState<RoomOrderDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelRemaining, setCancelRemaining] = useState(0);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const restoreRoomGuestSession = useCallback(async (): Promise<boolean> => {
    const restored = await restoreRoomSession({
      restaurantId,
      roomNumber,
      qrAccessKey,
    });

    if (restored) {
      setSessionReady(true);
      setError(null);
    }

    return restored;
  }, [qrAccessKey, restaurantId, roomNumber]);

  useEffect(() => {
    if (getRoomToken()) {
      setSessionReady(true);
      return;
    }

    if (!restaurantId || !roomNumber || !qrAccessKey) {
      setError(t("cart:room_session_expired"));
      return;
    }

    const startRoomSession = async () => {
      const restored = await restoreRoomGuestSession();
      if (!restored) {
        setError(t("cart:could_not_restore_room_session"));
      }
    };

    void startRoomSession();
  }, [qrAccessKey, restaurantId, restoreRoomGuestSession, roomNumber]);

  const loadOrder = useCallback(async () => {
    if (!sessionReady || !orderId) return;

    try {
      setError(null);
      const data = await fetchRoomSessionJson<RoomOrderDetailResponse>(`/room-orders/${orderId}`);
      setOrder(data);
      setCancelRemaining(getRemainingCancelSeconds(data));
    } catch (loadError) {
      if (isSessionHttpError(loadError, 401)) {
        const restored = await restoreRoomGuestSession();
        if (restored) {
          try {
            const retried = await fetchRoomSessionJson<RoomOrderDetailResponse>(
              `/room-orders/${orderId}`,
            );
            setOrder(retried);
            setCancelRemaining(getRemainingCancelSeconds(retried));
            return;
          } catch (retryErr) {
            setError(
              retryErr instanceof Error ? retryErr.message : "Could not load room order.",
            );
            return;
          }
        }

        setError(t("cart:room_session_expired"));
        return;
      }

      setError(
        loadError instanceof Error ? loadError.message : "Could not load room order.",
      );
    }
  }, [orderId, restoreRoomGuestSession, sessionReady, t]);

  const handleCancelOrder = useCallback(async () => {
    if (!orderId || cancelRemaining <= 0 || canceling) return;
    setCancelError(null);
    setCanceling(true);
    try {
      await fetchRoomSessionJson<unknown>(`/room-orders/${orderId}/cancel`, {
        method: "POST",
      });
      await loadOrder();
    } catch (cancelErr) {
      if (isSessionHttpError(cancelErr, 401)) {
        const restored = await restoreRoomGuestSession();
        if (restored) {
          try {
            await fetchRoomSessionJson<unknown>(`/room-orders/${orderId}/cancel`, {
              method: "POST",
            });
            await loadOrder();
            return;
          } catch (retryErr) {
            setCancelError(
              retryErr instanceof Error ? retryErr.message : "Could not cancel room order.",
            );
            return;
          }
        }

        setCancelError(t("cart:room_session_expired"));
        return;
      }

      setCancelError(
        cancelErr instanceof Error ? cancelErr.message : "Could not cancel room order.",
      );
    } finally {
      setCanceling(false);
    }
  }, [cancelRemaining, canceling, loadOrder, orderId, restoreRoomGuestSession, t]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder, currentLanguage]);

  const orderStatus = useMemo<OrderStatus | null>(() => {
    if (!order || !isKnownOrderStatus(order.status)) return null;
    return order.status;
  }, [order]);

  useEffect(() => {
    if (!orderStatus || FINALIZED.has(orderStatus)) return;

    const timer = window.setInterval(() => {
      void loadOrder();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [loadOrder, orderStatus]);

  useEffect(() => {
    setCancelRemaining(getRemainingCancelSeconds(order));
    if (!order || (order.status !== "pending" && order.status !== "confirmed")) return;

    const timer = window.setInterval(() => {
      setCancelRemaining(getRemainingCancelSeconds(order));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [order]);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm rounded-3xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <p className="animate-pulse text-sm text-slate-500">{t("cart:loading_room_order")}</p>
      </div>
    );
  }

  const statusKey = orderStatus ?? "pending";
  const statusLabel = ORDER_STATUS_LABEL[statusKey];
  const statusColor = ORDER_STATUS_COLOR[statusKey];

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col selection:bg-orange-200">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{order.order_number}</p>
            <p className="text-xs text-slate-500">
              Room {order.room_number ?? roomNumber ?? "-"}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 pb-28">
        <section className="rounded-[2rem] border border-white/80 bg-white/60 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:bg-white/80">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-sm">
            {t("cart:order_status_title")}
          </h2>
          <OrderTimeline order={order} />
        </section>

        <section className="rounded-[2rem] border border-white/80 bg-white/60 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:bg-white/80">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-sm">
            {t("cart:items")}
          </h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="group flex items-start justify-between gap-4 rounded-2xl border border-white/50 bg-white/50 px-4 py-3.5 text-sm shadow-sm transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:shadow-md">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {item.item_name_snapshot_localized || item.item_name_snapshot}
                  </p>
                  {item.notes && (
                    <p className="mt-0.5 text-[10px] font-medium text-orange-600 italic">
                      “{item.notes}”
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-slate-400">
                      {item.quantity} x ${item.unit_price_snapshot.toFixed(2)}
                    </p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ORDER_STATUS_COLOR[item.status]}`}>
                      {ORDER_STATUS_LABEL[item.status]}
                    </span>
                  </div>
                </div>
                <p className="font-semibold text-slate-900">
                  ${item.line_total.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/80 bg-white/60 p-6 text-sm shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:bg-white/80">
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-500">{t("cart:subtotal")}</span>
            <span>${order.subtotal_amount.toFixed(2)}</span>
          </div>
          {order.tax_amount > 0 && (
            <div className="mt-2 flex items-center justify-between py-1">
              <span className="text-slate-500">{t("cart:tax")}</span>
              <span>${order.tax_amount.toFixed(2)}</span>
            </div>
          )}
          {order.discount_amount > 0 && (
            <div className="mt-2 flex items-center justify-between py-1 text-emerald-600">
              <span>{t("cart:discount")}</span>
              <span>-${order.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
            <span>{t("cart:total")}</span>
            <span>${order.total_amount.toFixed(2)}</span>
          </div>
        </section>

        {order.notes && (
          <section className="rounded-[2rem] border border-white/80 bg-white/60 p-6 text-sm shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:bg-white/80">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {t("cart:notes")}
            </p>
            <p className="text-slate-700">{order.notes}</p>
          </section>
        )}

        {(order.status === "pending" || order.status === "confirmed") && cancelRemaining > 0 && (
          <section className="rounded-[2rem] border border-white/80 bg-white/60 p-6 text-sm shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:bg-white/80 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {t("cart:quick_cancel_window")}
            </p>
            <p className="text-slate-600">
              {t("cart:quick_cancel_room_desc")}
            </p>
            <button
              type="button"
              onClick={() => void handleCancelOrder()}
              disabled={canceling}
              className="min-h-[3.25rem] w-full rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/30 transition-all duration-300 hover:bg-red-700 hover:shadow-xl hover:shadow-red-600/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canceling ? t("cart:cancelling") : `${t("cart:cancel_order")} (${cancelRemaining}s)`}
            </button>
            {cancelError ? <p className="text-xs text-red-600">{cancelError}</p> : null}
          </section>
        )}

        {!orderStatus || !FINALIZED.has(orderStatus) ? (
          <p className="text-center text-xs text-slate-400">
            {t("cart:auto_refresh_notice")}
          </p>
        ) : null}

        {/* Navigation buttons */}
        {restaurantId && roomNumber && (
          <div className="flex flex-col gap-2">
            <Link
              to={
                qrAccessKey
                  ? `/room-orders/my/${restaurantId}/${roomNumber}?k=${encodeURIComponent(qrAccessKey)}`
                  : `/room-orders/my/${restaurantId}/${roomNumber}`
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
                qrAccessKey
                  ? `/menu/${restaurantId}/room/${roomNumber}?k=${encodeURIComponent(qrAccessKey)}`
                  : `/menu/${restaurantId}/room/${roomNumber}`
              }
              className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 shadow-sm transition-all duration-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
            >
              {t("cart:back_to_menu")}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
