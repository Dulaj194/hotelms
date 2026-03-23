/**
 * Kitchen — Real-time kitchen order dashboard.
 *
 * Displays three sections:
 *   1. Pending — orders waiting for confirmation
 *   2. In Progress — confirmed + currently preparing
 *   3. Completed — recently fulfilled orders
 *
 * Real-time updates arrive via WebSocket (Redis pub/sub fan-out).
 * Staff actions (confirm / reject / start / complete) call the HTTP API,
 * with an optimistic update so the UI responds immediately.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
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
  OrderStatus,
} from "@/types/order";

// Roles permitted to access the kitchen dashboard
const KITCHEN_ROLES = new Set(["owner", "admin", "steward"]);

// ── Helper: build a KitchenOrderCard from a new_order WS event ───────────────
function orderCardFromEvent(data: NewOrderEvent["data"]): KitchenOrderCard {
  const items: KitchenOrderItemSummary[] = data.items.map((item, idx) => ({
    id: idx,       // placeholder — real id not in event payload
    item_id: 0,    // placeholder
    item_name_snapshot: item.item_name_snapshot,
    quantity: item.quantity,
    unit_price_snapshot:
      item.quantity > 0 ? item.line_total / item.quantity : 0,
    line_total: item.line_total,
  }));

  return {
    id: data.order_id,
    order_number: data.order_number,
    table_number: data.table_number,
    customer_name: null,
    status: data.status as OrderStatus,
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

export default function Kitchen() {
  const navigate = useNavigate();
  const user = getUser();

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    } else if (!KITCHEN_ROLES.has(user.role)) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  if (!user || !KITCHEN_ROLES.has(user.role)) return null;

  const restaurantId = user.restaurant_id;

  return <KitchenDashboard restaurantId={restaurantId} />;
}

// ── Kitchen dashboard internals ───────────────────────────────────────────────
// Separated so hooks are not called conditionally.

interface KitchenDashboardProps {
  restaurantId: number | null;
}

function KitchenDashboard({ restaurantId }: KitchenDashboardProps) {
  // Unified order store — keyed by order id
  const [orders, setOrders] = useState<Map<number, KitchenOrderCard>>(new Map());

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Alert for operator awareness (set by WS handlers)
  const [alert, setAlert] = useState<string | null>(null);

  // ── Initial data load ──────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [pendingRes, processingRes, completedRes] = await Promise.all([
          api.get<KitchenOrderListResponse>("/orders/pending"),
          api.get<KitchenOrderListResponse>("/orders/processing"),
          api.get<KitchenOrderListResponse>("/orders/completed"),
        ]);

        const map = new Map<number, KitchenOrderCard>();
        for (const o of pendingRes.orders) map.set(o.id, o);
        for (const o of processingRes.orders) map.set(o.id, o);
        for (const o of completedRes.orders) map.set(o.id, o);

        setOrders(map);
      } catch (err) {
        if (err instanceof ApiError) {
          setLoadError(err.detail || "Failed to load orders.");
        } else {
          setLoadError("Failed to load orders. Please refresh.");
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [restaurantId]);

  // ── WebSocket event handlers ───────────────────────────────────────────
  const handleNewOrder = useCallback(
    (event: NewOrderEvent) => {
      // Add to internal map so status-update deltas work once steward confirms.
      // Kitchen does NOT display pending orders — that is the Steward's job.
      const card = orderCardFromEvent(event.data);
      setOrders((prev) => {
        const next = new Map(prev);
        next.set(card.id, card);
        return next;
      });
    },
    []
  );

  const handleStatusUpdate = useCallback((event: OrderStatusUpdatedEvent) => {
    const { order_id, status, updated_at } = event.data;

    setOrders((prev) => {
      const order = prev.get(order_id);
      if (!order) return prev;

      // Build updated order with new status and appropriate timestamp
      const updated: KitchenOrderCard = {
        ...order,
        status: status as OrderStatus,
        confirmed_at:
          status === "confirmed" ? updated_at : order.confirmed_at,
        processing_at:
          status === "processing" ? updated_at : order.processing_at,
        completed_at:
          status === "completed" ? updated_at : order.completed_at,
        rejected_at:
          status === "rejected" ? updated_at : order.rejected_at,
      };

      const next = new Map(prev);
      // Remove rejected orders from the visible board
      if (status === "rejected" || status === "paid") {
        next.delete(order_id);
      } else {
        next.set(order_id, updated);
      }
      return next;
    });
  }, []);

  const { isConnected, connectionError } = useKitchenSocket({
    restaurantId,
    onNewOrder: handleNewOrder,
    onStatusUpdate: handleStatusUpdate,
  });

  // ── Action handler ─────────────────────────────────────────────────────
  const handleAction = useCallback(
    async (orderId: number, newStatus: string) => {
      setActionLoadingId(orderId);
      setActionError(null);
      try {
        await api.patch(`/orders/${orderId}/status`, { status: newStatus });

        // Optimistic update (WS event also updates — idempotent)
        setOrders((prev) => {
          const order = prev.get(orderId);
          if (!order) return prev;
          const now = new Date().toISOString();
          const updated: KitchenOrderCard = {
            ...order,
            status: newStatus as OrderStatus,
            confirmed_at:
              newStatus === "confirmed" ? now : order.confirmed_at,
            processing_at:
              newStatus === "processing" ? now : order.processing_at,
            completed_at:
              newStatus === "completed" ? now : order.completed_at,
            rejected_at:
              newStatus === "rejected" ? now : order.rejected_at,
          };
          const next = new Map(prev);
          if (newStatus === "rejected" || newStatus === "paid") {
            next.delete(orderId);
          } else {
            next.set(orderId, updated);
          }
          return next;
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setActionError(err.detail || "Failed to update order.");
        } else {
          setActionError("Failed to update order. Please try again.");
        }
      } finally {
        setActionLoadingId(null);
      }
    },
    []
  );

  // ── Derived sections ───────────────────────────────────────────────────
  const sorted = useMemo(
    () =>
      Array.from(orders.values()).sort(
        (a, b) =>
          new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()
      ),
    [orders]
  );

  const processingOrders = useMemo(
    () =>
      sorted.filter(
        (o) => o.status === "confirmed" || o.status === "processing"
      ),
    [sorted]
  );

  const completedOrders = useMemo(
    () =>
      sorted
        .filter((o) => o.status === "completed")
        .sort(
          (a, b) =>
            new Date(b.completed_at ?? b.placed_at).getTime() -
            new Date(a.completed_at ?? a.placed_at).getTime()
        ),
    [sorted]
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Kitchen Dashboard</h1>
          {!loading && (
            <span className="text-sm text-gray-400">
              {orders.size} active order{orders.size !== 1 ? "s" : ""}
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

          {/* Refresh button */}
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* New order alert banner */}
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

      {/* WS connection error */}
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
              title="In Progress"
              orders={processingOrders}
              headerColor="bg-blue-600"
              emptyMessage="No orders in progress"
              onAction={handleAction}
              actionLoadingId={actionLoadingId}
            />
            <KitchenOrderSection
              title="Completed"
              orders={completedOrders}
              headerColor="bg-green-600"
              emptyMessage="No completed orders"
              onAction={handleAction}
              actionLoadingId={actionLoadingId}
            />
          </div>
        )}
      </main>
    </div>
  );
}
