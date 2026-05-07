import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { getRoomToken } from "@/hooks/useRoomSession";
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
  const steps: Array<{ status: OrderStatus; label: string }> = [
    { status: "pending", label: "Order placed" },
    { status: "confirmed", label: "Confirmed" },
    { status: "processing", label: "Being prepared" },
    { status: "completed", label: "Ready for delivery" },
    { status: "served", label: "Delivered" },
    { status: "paid", label: "Charged to folio" },
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
      <div className="flex items-center gap-2 text-red-600">
        <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
        <span className="text-sm font-medium">Order rejected</span>
      </div>
    );
  }

  const currentStepIndex = steps.findIndex((step) => step.status === order.status);

  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => {
        const done = index < currentStepIndex;
        const current = index === currentStepIndex;

        return (
          <li key={step.status} className="flex items-center gap-3 text-sm">
            <span
              className={`h-3 w-3 shrink-0 rounded-full ${
                done
                  ? "bg-emerald-500"
                  : current
                    ? "bg-orange-500 ring-4 ring-orange-100"
                    : "bg-slate-200"
              }`}
            />
            <span
              className={
                current
                  ? "font-semibold text-slate-900"
                  : done
                    ? "text-slate-500"
                    : "text-slate-400"
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

export default function RoomOrderStatus() {
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
      setError("Room session expired. Please scan the room QR code again.");
      return;
    }

    const startRoomSession = async () => {
      const restored = await restoreRoomGuestSession();
      if (!restored) {
        setError("Could not restore the room session. Please scan the room QR code again.");
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

        setError("Room session expired. Please scan the room QR code again.");
        return;
      }

      setError(
        loadError instanceof Error ? loadError.message : "Could not load room order.",
      );
    }
  }, [orderId, restoreRoomGuestSession, sessionReady]);

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

        setCancelError("Room session expired. Please scan the room QR code again.");
        return;
      }

      setCancelError(
        cancelErr instanceof Error ? cancelErr.message : "Could not cancel room order.",
      );
    } finally {
      setCanceling(false);
    }
  }, [cancelRemaining, canceling, loadOrder, orderId, restoreRoomGuestSession]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

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
        <p className="animate-pulse text-sm text-slate-500">Loading room order...</p>
      </div>
    );
  }

  const statusKey = orderStatus ?? "pending";
  const statusLabel = ORDER_STATUS_LABEL[statusKey];
  const statusColor = ORDER_STATUS_COLOR[statusKey];

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{order.order_number}</p>
            <p className="text-xs text-slate-500">
              Room {order.room_number ?? roomNumber ?? "-"}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            Order Status
          </h2>
          <OrderTimeline order={order} />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            Items
          </h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{item.item_name_snapshot}</p>
                  <p className="text-xs text-slate-400">
                    {item.quantity} x ${item.unit_price_snapshot.toFixed(2)}
                  </p>
                </div>
                <p className="font-semibold text-slate-900">
                  ${item.line_total.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>${order.subtotal_amount.toFixed(2)}</span>
          </div>
          {order.tax_amount > 0 && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-slate-500">Tax</span>
              <span>${order.tax_amount.toFixed(2)}</span>
            </div>
          )}
          {order.discount_amount > 0 && (
            <div className="mt-2 flex items-center justify-between text-emerald-600">
              <span>Discount</span>
              <span>-${order.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
            <span>Total</span>
            <span>${order.total_amount.toFixed(2)}</span>
          </div>
        </section>

        {order.notes && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Notes
            </p>
            <p className="text-slate-700">{order.notes}</p>
          </section>
        )}

        {(order.status === "pending" || order.status === "confirmed") && cancelRemaining > 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Quick Cancel Window
            </p>
            <p className="text-slate-600">
              You can cancel this room order within 10 seconds after placing it.
            </p>
            <button
              type="button"
              onClick={() => void handleCancelOrder()}
              disabled={canceling}
              className="w-full rounded-2xl bg-red-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canceling ? "Cancelling..." : `Cancel Order (${cancelRemaining}s)`}
            </button>
            {cancelError ? <p className="text-xs text-red-600">{cancelError}</p> : null}
          </section>
        )}

        {!orderStatus || !FINALIZED.has(orderStatus) ? (
          <p className="text-center text-xs text-slate-400">
            This page refreshes automatically every 15 seconds.
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
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-200 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              View my orders
            </Link>
            <Link
              to={
                qrAccessKey
                  ? `/menu/${restaurantId}/room/${roomNumber}?k=${encodeURIComponent(qrAccessKey)}`
                  : `/menu/${restaurantId}/room/${roomNumber}`
              }
              className="text-sm font-semibold text-orange-600 hover:underline"
            >
              Back to room menu
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
