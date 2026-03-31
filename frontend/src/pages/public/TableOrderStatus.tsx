import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getGuestToken } from "@/hooks/useGuestSession";
import type { OrderDetailResponse } from "@/types/order";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/types/order";

const BASE_URL =
  (import.meta as { env: Record<string, string | undefined> }).env.VITE_API_URL ??
  "http://localhost:8000/api/v1";

async function fetchOrderForGuest(orderId: string): Promise<OrderDetailResponse> {
  const token = getGuestToken();
  const response = await fetch(`${BASE_URL}/orders/my/${orderId}`, {
    headers: token ? { "X-Guest-Session": token } : {},
  });
  if (!response.ok) {
    throw new Error(`Failed to load order — ${response.status}`);
  }
  return response.json() as Promise<OrderDetailResponse>;
}

const POLL_INTERVAL_MS = 15_000; // refresh every 15 s

const FINALIZED: Set<string> = new Set(["completed", "paid", "rejected"]);

export default function TableOrderStatus() {
  const [searchParams] = useSearchParams();
  const { restaurantId, tableNumber, orderId } = useParams<{
    restaurantId: string;
    tableNumber: string;
    orderId: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";

  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await fetchOrderForGuest(orderId);
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load order.");
    }
  }, [orderId]);

  // Initial load
  useEffect(() => {
    void load();
  }, [load]);

  // Poll until finalized
  useEffect(() => {
    if (!order || FINALIZED.has(order.status)) return;
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [order, load]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-red-600 text-center max-w-sm">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading order…</p>
      </div>
    );
  }

  const statusLabel = ORDER_STATUS_LABEL[order.status];
  const statusColor = ORDER_STATUS_COLOR[order.status];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-semibold text-base">{order.order_number}</p>
            <p className="text-xs text-gray-500">Table {order.table_number}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6 space-y-6">
        {/* Status timeline */}
        <section className="bg-white rounded-xl border p-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">
            Order Status
          </h2>
          <OrderTimeline order={order} />
        </section>

        {/* Items */}
        <section className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Items
          </h2>
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-start text-sm"
            >
              <div className="flex-1">
                <p className="font-medium">{item.item_name_snapshot}</p>
                <p className="text-xs text-gray-400">
                  {item.quantity} × ${item.unit_price_snapshot.toFixed(2)}
                </p>
              </div>
              <p className="font-semibold ml-4">${item.line_total.toFixed(2)}</p>
            </div>
          ))}
        </section>

        {/* Totals */}
        <section className="bg-white rounded-xl border p-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span>${order.subtotal_amount.toFixed(2)}</span>
          </div>
          {order.tax_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Tax</span>
              <span>${order.tax_amount.toFixed(2)}</span>
            </div>
          )}
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>−${order.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
            <span>Total</span>
            <span>${order.total_amount.toFixed(2)}</span>
          </div>
        </section>

        {/* Notes */}
        {order.notes && (
          <section className="bg-white rounded-xl border p-4 text-sm">
            <p className="text-gray-500 text-xs uppercase font-semibold mb-1">
              Notes
            </p>
            <p>{order.notes}</p>
          </section>
        )}

        {!FINALIZED.has(order.status) && (
          <p className="text-center text-xs text-gray-400">
            This page refreshes automatically every 15 seconds.
          </p>
        )}

        {/* Back to menu link */}
        {restaurantId && tableNumber && (
          <div className="text-center">
            <Link
              to={
                qrAccessKey
                  ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(qrAccessKey)}`
                  : `/menu/${restaurantId}/table/${tableNumber}`
              }
              className="text-sm text-orange-600 hover:underline"
            >
              ← Back to menu
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Timeline component ────────────────────────────────────────────────────────

const LIFECYCLE_STEPS: Array<{ status: OrderDetailResponse["status"]; label: string }> = [
  { status: "pending", label: "Order placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "processing", label: "Being prepared" },
  { status: "completed", label: "Ready" },
  { status: "paid", label: "Paid" },
];

function OrderTimeline({ order }: { order: OrderDetailResponse }) {
  if (order.status === "rejected") {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
        <span className="text-sm font-medium">Order rejected</span>
      </div>
    );
  }

  const statusIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === order.status);

  return (
    <ol className="flex flex-col gap-2">
      {LIFECYCLE_STEPS.map((step, idx) => {
        const done = idx < statusIndex;
        const current = idx === statusIndex;
        return (
          <li key={step.status} className="flex items-center gap-3 text-sm">
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
