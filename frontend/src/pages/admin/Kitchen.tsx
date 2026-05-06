import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

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
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState<Map<number, KitchenOrderCard>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTab = searchParams.get("tab") || "table";
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInternalScrollRef = useRef(false);

  const tabList = ["table", "room"];
  const activeIndex = useMemo(() => tabList.indexOf(activeTab), [activeTab]);

  const handleTabChange = useCallback((tab: string) => {
    setSearchParams(prev => {
      prev.set("tab", tab);
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  // Handle programmatic tab changes
  useEffect(() => {
    if (scrollRef.current && !isInternalScrollRef.current) {
      const container = scrollRef.current;
      const width = container.clientWidth;
      container.scrollTo({
        left: width * (activeIndex === -1 ? 0 : activeIndex),
        behavior: "smooth",
      });
    }
    isInternalScrollRef.current = false;
  }, [activeIndex]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth;
    if (width <= 0) return;

    const index = Math.round(scrollLeft / width);
    const targetTab = tabList[index];

    if (targetTab && targetTab !== activeTab) {
      isInternalScrollRef.current = true;
      handleTabChange(targetTab);
    }
  };

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
        for (const order of pendingRes.orders) {
          map.set(order.id, order);
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
          (order.status === "pending" || order.status === "confirmed" || order.status === "processing")
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
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => handleTabChange("table")}
          className={`flex flex-1 min-w-[140px] items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition-all ${
            activeTab === "table"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-100"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Table Orders</span>
          <span className={`rounded-md px-2 py-0.5 text-xs ${activeTab === "table" ? "bg-white/20" : "bg-slate-200"}`}>
            {tableOrders.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("room")}
          className={`flex flex-1 min-w-[140px] items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition-all ${
            activeTab === "room"
              ? "bg-teal-600 text-white shadow-lg shadow-teal-100"
              : "bg-teal-50 text-teal-700 hover:bg-teal-100/50"
          }`}
        >
          <span>Room Orders</span>
          <span className={`rounded-md px-2 py-0.5 text-xs ${activeTab === "room" ? "bg-white/20" : "bg-teal-200/50"}`}>
            {roomOrders.length}
          </span>
        </button>
        
        <div className="flex items-center gap-2 ml-auto">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
              isConnected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-slate-400"}`} />
            {isConnected ? "Live" : "Connecting"}
          </span>
          <button
            type="button"
            onClick={() => void loadOrders(true)}
            disabled={refreshing || loading}
            className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            title="Refresh"
          >
            <svg className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
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
      <div className="relative overflow-hidden">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Table Orders Section */}
          <div className="w-full shrink-0 snap-start">
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Table Queue</h2>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              {tableOrders.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-100">
                  <p className="text-sm font-medium text-slate-400">No active table orders.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
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
          </div>

          {/* Room Orders Section */}
          <div className="w-full shrink-0 snap-start">
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Room Queue</h2>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              {roomOrders.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-100">
                  <p className="text-sm font-medium text-slate-400">No active room orders.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
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
        </div>
      </div>
      )}
    </div>
  );
}
