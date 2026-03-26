import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import OrderCard from "@/components/shared/OrderCard";
import { useKitchenSocket } from "@/hooks/useKitchenSocket";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { QR_MENU_STAFF_ROLES } from "@/lib/moduleAccess";
import type { NewOrderEvent, OrderStatusUpdatedEvent } from "@/types/realtime";
import type {
  KitchenOrderCard,
  KitchenOrderItemSummary,
  KitchenOrderListResponse,
  OrderStatus,
} from "@/types/order";

const KITCHEN_ROLES = new Set<string>(QR_MENU_STAFF_ROLES);

function orderCardFromEvent(data: NewOrderEvent["data"]): KitchenOrderCard {
  const items: KitchenOrderItemSummary[] = data.items.map((item, index) => ({
    id: index,
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
    customer_phone: null,
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
  const user = getUser();
  const role = user?.role ?? "";

  if (!user || !KITCHEN_ROLES.has(role)) {
    return null;
  }

  return (
    <DashboardLayout>
      <KitchenDashboard restaurantId={user.restaurant_id} />
    </DashboardLayout>
  );
}

interface KitchenDashboardProps {
  restaurantId: number | null;
}

function KitchenDashboard({ restaurantId }: KitchenDashboardProps) {
  const canAccessKitchen = Boolean(restaurantId);

  const [orders, setOrders] = useState<Map<number, KitchenOrderCard>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOrders = useCallback(
    async (silent = false) => {
      if (!restaurantId || !canAccessKitchen) {
        setLoading(false);
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setLoadError(null);

      try {
        const [pendingRes, processingRes] = await Promise.all([
          api.get<KitchenOrderListResponse>("/orders/pending"),
          api.get<KitchenOrderListResponse>("/orders/processing"),
        ]);

        const map = new Map<number, KitchenOrderCard>();
        // Table orders should appear only after steward confirmation.
        for (const order of pendingRes.orders) {
          if (order.order_source === "room") {
            map.set(order.id, order);
          }
        }
        for (const order of processingRes.orders) map.set(order.id, order);

        setOrders(map);
      } catch (err) {
        if (err instanceof ApiError) {
          setLoadError(err.detail || "Failed to load kitchen orders.");
        } else {
          setLoadError("Failed to load kitchen orders.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canAccessKitchen, restaurantId]
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!canAccessKitchen) return;
    const interval = setInterval(() => {
      void loadOrders(true);
    }, 60_000);
    return () => clearInterval(interval);
  }, [canAccessKitchen, loadOrders]);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  const handleNewOrder = useCallback((event: NewOrderEvent) => {
    const card = orderCardFromEvent(event.data);

    setOrders((prev) => {
      const next = new Map(prev);
      next.set(card.id, card);
      return next;
    });

    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
    }
    const locationLabel =
      card.order_source === "room" ? `Room ${card.room_number ?? "?"}` : `Table ${card.table_number ?? "?"}`;
    setAlert(`New order received: ${card.order_number} (${locationLabel})`);
    alertTimerRef.current = setTimeout(() => setAlert(null), 8000);
  }, []);

  const handleStatusUpdate = useCallback((event: OrderStatusUpdatedEvent) => {
    const { order_id, status, updated_at } = event.data;

    setOrders((prev) => {
      const current = prev.get(order_id);
      if (!current) return prev;

      const next = new Map(prev);
      if (status === "completed" || status === "rejected" || status === "paid") {
        next.delete(order_id);
        return next;
      }

      next.set(order_id, {
        ...current,
        status: status as OrderStatus,
        confirmed_at: status === "confirmed" ? updated_at : current.confirmed_at,
        processing_at: status === "processing" ? updated_at : current.processing_at,
        completed_at: status === "completed" ? updated_at : current.completed_at,
        rejected_at: status === "rejected" ? updated_at : current.rejected_at,
      });
      return next;
    });
  }, []);

  const { isConnected, connectionError } = useKitchenSocket({
    restaurantId: canAccessKitchen ? restaurantId : null,
    onNewOrder: handleNewOrder,
    onStatusUpdate: handleStatusUpdate,
  });

  const handleAction = useCallback(async (orderId: number, newStatus: string) => {
    setActionLoadingId(orderId);
    setActionError(null);

    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });

      setOrders((prev) => {
        const current = prev.get(orderId);
        if (!current) return prev;

        const now = new Date().toISOString();
        const next = new Map(prev);

        if (newStatus === "completed" || newStatus === "rejected" || newStatus === "paid") {
          next.delete(orderId);
          return next;
        }

        next.set(orderId, {
          ...current,
          status: newStatus as OrderStatus,
          confirmed_at: newStatus === "confirmed" ? now : current.confirmed_at,
          processing_at: newStatus === "processing" ? now : current.processing_at,
          completed_at: newStatus === "completed" ? now : current.completed_at,
          rejected_at: newStatus === "rejected" ? now : current.rejected_at,
        });

        return next;
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.detail || "Failed to update order status.");
      } else {
        setActionError("Failed to update order status.");
      }
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const sortedOrders = useMemo(
    () =>
      Array.from(orders.values())
        .sort((a, b) => new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()),
    [orders]
  );

  const tableOrders = useMemo(
    () =>
      sortedOrders.filter(
        (order) =>
          order.order_source !== "room" &&
          (order.status === "confirmed" || order.status === "processing")
      ),
    [sortedOrders]
  );

  const roomOrders = useMemo(
    () =>
      sortedOrders
        .filter((order) => order.order_source === "room")
        .filter((order) => order.status === "pending" || order.status === "confirmed" || order.status === "processing")
        .sort(
          (a, b) =>
            new Date(a.placed_at).getTime() -
            new Date(b.placed_at).getTime()
        ),
    [sortedOrders]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${
                isConnected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-slate-400"}`} />
              {isConnected ? "Live" : "Connecting"}
            </span>
            <button
              type="button"
              onClick={() => void loadOrders(true)}
              disabled={refreshing || loading}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {alert && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
          {alert}
        </div>
      )}

      {connectionError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {connectionError}
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading kitchen orders...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{loadError}</div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Table Orders</h2>
            {tableOrders.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-100 px-5 py-4 text-2xl text-amber-900">
                No orders found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {tableOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAction={handleAction}
                    actionLoading={actionLoadingId === order.id}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Room Orders</h2>
            {roomOrders.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-100 px-5 py-4 text-2xl text-amber-900">
                No room orders found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {roomOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAction={handleAction}
                    actionLoading={actionLoadingId === order.id}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
