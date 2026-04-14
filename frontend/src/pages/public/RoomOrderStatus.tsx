import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { getRoomToken, setRoomSession } from "@/hooks/useRoomSession";
import { RESOLVED_API_BASE_URL } from "@/lib/networkBase";
import { publicPost } from "@/lib/publicApi";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from "@/types/order";
import type {
  RoomOrderDetailResponse,
  RoomSessionStartResponse,
} from "@/types/roomSession";

const BASE_URL = RESOLVED_API_BASE_URL;
const CANCEL_WINDOW_SECONDS = 5;

const POLL_INTERVAL_MS = 15_000;
const FINALIZED: Set<OrderStatus> = new Set(["completed", "paid", "rejected"]);

function isKnownOrderStatus(value: string): value is OrderStatus {
  return value in ORDER_STATUS_LABEL;
}

async function fetchRoomOrder(orderId: string): Promise<RoomOrderDetailResponse> {
  const token = getRoomToken();
  if (!token) {
    throw new Error("Room session expired. Please scan the room QR code again.");
  }

  const response = await fetch(`${BASE_URL}/room-orders/${orderId}`, {
    headers: { "X-Room-Session": token },
  });

  if (!response.ok) {
    throw new Error(`Failed to load room order - ${response.status}`);
  }

  return response.json() as Promise<RoomOrderDetailResponse>;
}

async function cancelRoomOrder(orderId: string): Promise<void> {
  const token = getRoomToken();
  if (!token) {
    throw new Error("Room session expired. Please scan the room QR code again.");
  }

  const response = await fetch(`${BASE_URL}/room-orders/${orderId}/cancel`, {
    method: "POST",
    headers: { "X-Room-Session": token },
  });

  if (!response.ok) {
    let detail = `Failed to cancel room order - ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) detail = payload.detail;
    } catch {
      // fallback keeps base detail
    }
    throw new Error(detail);
  }
}

function getRemainingCancelSeconds(order: RoomOrderDetailResponse | null): number {
  if (!order) return 0;
  if (order.status !== "pending" && order.status !== "confirmed") return 0;
  const placedMs = new Date(order.placed_at).getTime();
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
      try {
        const session = await publicPost<RoomSessionStartResponse>(
          "/room-sessions/start",
          {
            restaurant_id: Number(restaurantId),
            room_number: roomNumber,
            qr_access_key: qrAccessKey,
          },
        );
        setRoomSession(session);
        setSessionReady(true);
      } catch {
        setError("Could not restore the room session. Please scan the room QR code again.");
      }
    };

    void startRoomSession();
  }, [qrAccessKey, restaurantId, roomNumber]);

  const loadOrder = useCallback(async () => {
    if (!sessionReady || !orderId) return;

    try {
      setError(null);
      const data = await fetchRoomOrder(orderId);
      setOrder(data);
      setCancelRemaining(getRemainingCancelSeconds(data));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load room order.",
      );
    }
  }, [orderId, sessionReady]);

  const handleCancelOrder = useCallback(async () => {
    if (!orderId || cancelRemaining <= 0 || canceling) return;
    setCancelError(null);
    setCanceling(true);
    try {
      await cancelRoomOrder(orderId);
      await loadOrder();
    } catch (cancelErr) {
      setCancelError(
        cancelErr instanceof Error ? cancelErr.message : "Could not cancel room order.",
      );
    } finally {
      setCanceling(false);
    }
  }, [cancelRemaining, canceling, loadOrder, orderId]);

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm rounded-3xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="animate-pulse text-sm text-slate-500">Loading room order...</p>
      </div>
    );
  }

  const statusKey = orderStatus ?? "pending";
  const statusLabel = ORDER_STATUS_LABEL[statusKey];
  const statusColor = ORDER_STATUS_COLOR[statusKey];

  return (
    <div className="min-h-screen bg-slate-50">
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

        {(order.status === "pending" || order.status === "confirmed") && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Quick Cancel Window
            </p>
            <p className="text-slate-600">
              You can cancel this room order within 5 seconds after placing it.
            </p>
            <button
              type="button"
              onClick={() => void handleCancelOrder()}
              disabled={canceling || cancelRemaining <= 0}
              className="w-full rounded-2xl bg-red-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canceling
                ? "Cancelling..."
                : cancelRemaining > 0
                ? `Cancel Order (${cancelRemaining}s)`
                : "Cancel window expired"}
            </button>
            {cancelError ? <p className="text-xs text-red-600">{cancelError}</p> : null}
          </section>
        )}

        {!orderStatus || !FINALIZED.has(orderStatus) ? (
          <p className="text-center text-xs text-slate-400">
            This page refreshes automatically every 15 seconds.
          </p>
        ) : null}

        {restaurantId && roomNumber && (
          <div className="text-center">
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
