/**
 * Steward — Order confirmation dashboard.
 *
 * Stewards see ALL incoming pending orders (table + room) and confirm
 * them before they reach the kitchen, or reject them outright.
 *
 * Mirrors the PHP admin_kitchen.php steward-confirmation flow:
 *   pending order → steward confirms → OrderStatus.confirmed → kitchen sees it
 *
 * Layout:
 *   Left column  — Table Orders (pending)
 *   Right column — Room Orders  (pending)
 *
 * Real-time via WebSocket (same channel as kitchen). Auto-refresh every 30s.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import KitchenOrderSection from "@/components/shared/KitchenOrderSection";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useKitchenSocket } from "@/hooks/useKitchenSocket";
import type { NewOrderEvent, OrderStatusUpdatedEvent } from "@/types/realtime";
import type {
  KitchenOrderCard,
  KitchenOrderListResponse,
  KitchenOrderItemSummary,
} from "@/types/order";

const STEWARD_ROLES = new Set(["owner", "admin", "steward"]);

// ── Build a card from a new_order WS event ────────────────────────────────────
function orderCardFromEvent(data: NewOrderEvent["data"]): KitchenOrderCard {
  const items: KitchenOrderItemSummary[] = data.items.map((item, idx) => ({
    id: idx,
    item_id: 0,
    item_name_snapshot: item.item_name_snapshot,
    quantity: item.quantity,
    unit_price_snapshot: item.quantity > 0 ? item.line_total / item.quantity : 0,
    line_total: item.line_total,
  }));
  return {
    id: data.order_id,
    order_number: data.order_number,
    table_number: data.table_number,
    customer_name: null,
    status: "pending",
    total_amount: data.total_amount,
    placed_at: data.placed_at,
    confirmed_at: null,
    processing_at: null,
    completed_at: null,
    rejected_at: null,
    notes: null,
    items,
    order_source: data.order_source,
    room_id: data.room_id,
    room_number: data.room_number,
  };
}

// ── Auth guard wrapper ─────────────────────────────────────────────────────────
export default function Steward() {
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    } else if (!STEWARD_ROLES.has(user.role)) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  if (!user || !STEWARD_ROLES.has(user.role)) return null;

  return <StewardDashboard restaurantId={user.restaurant_id} />;
}

// ── Dashboard internals ───────────────────────────────────────────────────────
interface StewardDashboardProps {
  restaurantId: number | null;
}

function StewardDashboard({ restaurantId }: StewardDashboardProps) {
  const [orders, setOrders] = useState<Map<number, KitchenOrderCard>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load pending orders ──────────────────────────────────────────────────
  const loadPending = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await api.get<KitchenOrderListResponse>("/orders/pending");
      const map = new Map<number, KitchenOrderCard>();
      for (const o of res.orders) map.set(o.id, o);
      setOrders(map);
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadError(err.detail || "Failed to load orders.");
      } else {
        setLoadError("Failed to load orders. Please refresh.");
      }
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    setLoadError(null);
    loadPending().finally(() => setLoading(false));
  }, [restaurantId, loadPending]);

  // ── Auto-refresh every 30 s (fallback if WS drops) ──────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const interval = setInterval(() => void loadPending(), 30_000);
    return () => clearInterval(interval);
  }, [restaurantId, loadPending]);

  // ── Alert helper ─────────────────────────────────────────────────────────
  const showAlert = useCallback((message: string) => {
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    setAlert(message);
    alertTimerRef.current = setTimeout(() => setAlert(null), 8000);
  }, []);

  // ── WebSocket handlers ────────────────────────────────────────────────────
  const handleNewOrder = useCallback(
    (event: NewOrderEvent) => {
      const card = orderCardFromEvent(event.data);
      setOrders((prev) => {
        const next = new Map(prev);
        next.set(card.id, card);
        return next;
      });
      const loc =
        event.data.order_source === "room"
          ? `Room ${event.data.room_number ?? "?"}`
          : `Table ${event.data.table_number ?? "?"}`;
      showAlert(`New order ${event.data.order_number} — ${loc} needs confirmation!`);
    },
    [showAlert]
  );

  const handleStatusUpdate = useCallback((event: OrderStatusUpdatedEvent) => {
    const { order_id, status } = event.data;
    // Remove from board once no longer pending (confirmed / rejected / etc.)
    if (status !== "pending") {
      setOrders((prev) => {
        if (!prev.has(order_id)) return prev;
        const next = new Map(prev);
        next.delete(order_id);
        return next;
      });
    }
  }, []);

  const { isConnected, connectionError } = useKitchenSocket({
    restaurantId,
    onNewOrder: handleNewOrder,
    onStatusUpdate: handleStatusUpdate,
  });

  // ── Status action handler ─────────────────────────────────────────────────
  const handleAction = useCallback(async (orderId: number, newStatus: string) => {
    setActionLoadingId(orderId);
    setActionError(null);
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      // Optimistic: remove confirmed/rejected orders from board immediately
      if (newStatus === "confirmed" || newStatus === "rejected") {
        setOrders((prev) => {
          const next = new Map(prev);
          next.delete(orderId);
          return next;
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.detail || "Failed to update order.");
      } else {
        setActionError("Failed to update order. Please try again.");
      }
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  // ── Derived order lists ───────────────────────────────────────────────────
  const allPending = useMemo(
    () =>
      Array.from(orders.values()).sort(
        (a, b) => new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()
      ),
    [orders]
  );

  const tableOrders = useMemo(
    () => allPending.filter((o) => o.order_source !== "room"),
    [allPending]
  );

  const roomOrders = useMemo(
    () => allPending.filter((o) => o.order_source === "room"),
    [allPending]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Steward Dashboard</h1>
          {!loading && (
            <span className="text-sm text-gray-400">
              {allPending.length} pending order{allPending.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            <span className={isConnected ? "text-green-600" : "text-gray-400"}>
              {isConnected ? "Live" : "Connecting…"}
            </span>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* New-order alert banner */}
      {alert && (
        <div className="bg-orange-500 text-white px-4 py-2.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <span className="font-semibold">{alert}</span>
          </div>
          <button
            onClick={() => setAlert(null)}
            className="text-white/80 hover:text-white text-lg leading-none ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* WS error */}
      {connectionError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
          ⚠ {connectionError}
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 flex justify-between">
          <span>⚠ {actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-2">
            ×
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400 text-sm">Loading orders…</div>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-red-600 text-sm">{loadError}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm bg-gray-800 text-white px-4 py-2 rounded"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KitchenOrderSection
              title="Table Orders"
              orders={tableOrders}
              headerColor="bg-indigo-600"
              emptyMessage="No pending table orders"
              onAction={handleAction}
              actionLoadingId={actionLoadingId}
            />
            <KitchenOrderSection
              title="Room Orders"
              orders={roomOrders}
              headerColor="bg-teal-600"
              emptyMessage="No pending room orders"
              onAction={handleAction}
              actionLoadingId={actionLoadingId}
            />
          </div>
        )}
      </main>
    </div>
  );
}
