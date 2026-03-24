import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import KitchenOrderSection from "@/components/shared/KitchenOrderSection";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { useKitchenSocket } from "@/hooks/useKitchenSocket";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { NewOrderEvent, OrderStatusUpdatedEvent } from "@/types/realtime";
import type {
  KitchenOrderCard,
  KitchenOrderItemSummary,
  KitchenOrderListResponse,
  OrderStatus,
} from "@/types/order";

const KITCHEN_ROLES = new Set(["owner", "admin", "steward"]);
type SourceFilter = "all" | "table" | "room";

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

function sourceMatches(order: KitchenOrderCard, sourceFilter: SourceFilter): boolean {
  if (sourceFilter === "all") return true;
  if (sourceFilter === "room") return order.order_source === "room";
  return order.order_source !== "room";
}

function locationMatches(order: KitchenOrderCard, locationFilter: string): boolean {
  const filter = locationFilter.trim().toLowerCase();
  if (!filter) return true;

  const haystack = [
    order.order_number,
    order.customer_name ?? "",
    order.table_number ?? "",
    order.room_number ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(filter);
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
  const { loading: privilegeLoading, hasPrivilege } = useSubscriptionPrivileges();
  const qrMenuEnabled = hasPrivilege("QR_MENU");
  const canAccessKitchen = !privilegeLoading && qrMenuEnabled && Boolean(restaurantId);

  const [orders, setOrders] = useState<Map<number, KitchenOrderCard>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [locationFilter, setLocationFilter] = useState("");
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
        const [pendingRes, processingRes, completedRes] = await Promise.all([
          api.get<KitchenOrderListResponse>("/orders/pending"),
          api.get<KitchenOrderListResponse>("/orders/processing"),
          api.get<KitchenOrderListResponse>("/orders/completed"),
        ]);

        const map = new Map<number, KitchenOrderCard>();
        for (const order of pendingRes.orders) map.set(order.id, order);
        for (const order of processingRes.orders) map.set(order.id, order);
        for (const order of completedRes.orders) map.set(order.id, order);

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
    if (!privilegeLoading) {
      void loadOrders();
    }
  }, [loadOrders, privilegeLoading]);

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
      if (status === "rejected" || status === "paid") {
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

        if (newStatus === "rejected" || newStatus === "paid") {
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
        .filter((order) => sourceMatches(order, sourceFilter))
        .filter((order) => locationMatches(order, locationFilter))
        .sort((a, b) => new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()),
    [locationFilter, orders, sourceFilter]
  );

  const processingOrders = useMemo(
    () => sortedOrders.filter((order) => order.status === "confirmed" || order.status === "processing"),
    [sortedOrders]
  );

  const completedOrders = useMemo(
    () =>
      sortedOrders
        .filter((order) => order.status === "completed")
        .sort(
          (a, b) =>
            new Date(b.completed_at ?? b.placed_at).getTime() -
            new Date(a.completed_at ?? a.placed_at).getTime()
        ),
    [sortedOrders]
  );

  const tableOrderCount = useMemo(
    () => sortedOrders.filter((order) => order.order_source !== "room").length,
    [sortedOrders]
  );
  const roomOrderCount = useMemo(
    () => sortedOrders.filter((order) => order.order_source === "room").length,
    [sortedOrders]
  );

  if (!privilegeLoading && !qrMenuEnabled) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Kitchen module is locked for this restaurant because the current subscription does not include the QR_MENU
        privilege.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Kitchen Orders</h1>
            <p className="mt-1 text-sm text-slate-600">
              Track order progression in real time. Auto-refresh runs every 60 seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOrders(true)}
            disabled={refreshing || loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${
              isConnected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-slate-400"}`} />
            {isConnected ? "Live" : "Connecting"}
          </span>
          <span className="text-slate-500">In progress: {processingOrders.length}</span>
          <span className="text-slate-500">Completed: {completedOrders.length}</span>
          <span className="text-slate-500">Table: {tableOrderCount}</span>
          <span className="text-slate-500">Room: {roomOrderCount}</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All Sources</option>
            <option value="table">Table Orders</option>
            <option value="room">Room Orders</option>
          </select>

          <input
            type="text"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            placeholder="Filter by order no / table / room / customer"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
    </div>
  );
}
