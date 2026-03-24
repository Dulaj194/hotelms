import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import KitchenOrderSection from "@/components/shared/KitchenOrderSection";
import { useKitchenSocket } from "@/hooks/useKitchenSocket";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { NewOrderEvent, OrderStatusUpdatedEvent } from "@/types/realtime";
import type {
  KitchenOrderCard,
  KitchenOrderItemSummary,
  KitchenOrderListResponse,
} from "@/types/order";

const STEWARD_ROLES = new Set(["owner", "admin", "steward"]);
const POLL_INTERVAL_MS = 3000;
const SERVED_STORAGE_TTL_MS = 12 * 60 * 60 * 1000;

type StewardTab = "awaiting" | "ready";
type SourceFilter = "all" | "table" | "room";

interface StoredServedState {
  [orderId: string]: number;
}

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

function playNotificationTone() {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const audioContext = new AudioCtx();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.25);
    oscillator.onended = () => {
      void audioContext.close();
    };
  } catch {
    // Audio notification is best-effort only.
  }
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
    order.table_number ?? "",
    order.room_number ?? "",
    order.customer_name ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(filter);
}

function loadServedOrderIds(storageKey: string | null): Set<number> {
  if (!storageKey) return new Set();

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();

    const parsed = JSON.parse(raw) as StoredServedState;
    const now = Date.now();
    const filteredEntries = Object.entries(parsed).filter(([, ts]) => now - ts <= SERVED_STORAGE_TTL_MS);
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(filteredEntries)));

    return new Set(filteredEntries.map(([id]) => Number(id)).filter((id) => Number.isFinite(id)));
  } catch {
    return new Set();
  }
}

function persistServedOrderIds(storageKey: string | null, servedOrderIds: Set<number>) {
  if (!storageKey) return;

  const now = Date.now();
  const payload: StoredServedState = {};
  servedOrderIds.forEach((id) => {
    payload[String(id)] = now;
  });

  localStorage.setItem(storageKey, JSON.stringify(payload));
}

export default function Steward() {
  const user = getUser();
  const role = user?.role ?? "";

  if (!user || !STEWARD_ROLES.has(role)) {
    return null;
  }

  return (
    <DashboardLayout>
      <StewardDashboard restaurantId={user.restaurant_id} />
    </DashboardLayout>
  );
}

interface StewardDashboardProps {
  restaurantId: number | null;
}

function StewardDashboard({ restaurantId }: StewardDashboardProps) {
  const canAccessSteward = Boolean(restaurantId);

  const servedStorageKey = useMemo(
    () => (restaurantId ? `steward_served_orders_${restaurantId}` : null),
    [restaurantId]
  );

  const [pendingOrders, setPendingOrders] = useState<Map<number, KitchenOrderCard>>(new Map());
  const [readyOrders, setReadyOrders] = useState<Map<number, KitchenOrderCard>>(new Map());
  const [servedOrderIds, setServedOrderIds] = useState<Set<number>>(() => loadServedOrderIds(servedStorageKey));

  const [activeTab, setActiveTab] = useState<StewardTab>("awaiting");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [locationFilter, setLocationFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [alert, setAlert] = useState<string | null>(null);

  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPendingCountRef = useRef<number | null>(null);

  useEffect(() => {
    setServedOrderIds(loadServedOrderIds(servedStorageKey));
  }, [servedStorageKey]);

  useEffect(() => {
    persistServedOrderIds(servedStorageKey, servedOrderIds);
  }, [servedOrderIds, servedStorageKey]);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    };
  }, []);

  const showAlert = useCallback((message: string, withSound = false) => {
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    setAlert(message);
    alertTimerRef.current = setTimeout(() => setAlert(null), 8000);
    if (withSound) playNotificationTone();
  }, []);

  const loadData = useCallback(
    async (silent = false, notifyIfIncreased = false) => {
      if (!restaurantId || !canAccessSteward) {
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
        const [pendingRes, completedRes] = await Promise.all([
          api.get<KitchenOrderListResponse>("/orders/pending"),
          api.get<KitchenOrderListResponse>("/orders/completed"),
        ]);

        const nextPending = new Map<number, KitchenOrderCard>();
        for (const order of pendingRes.orders) {
          nextPending.set(order.id, order);
        }

        const nextReady = new Map<number, KitchenOrderCard>();
        for (const order of completedRes.orders) {
          if (!servedOrderIds.has(order.id)) {
            nextReady.set(order.id, order);
          }
        }

        setPendingOrders(nextPending);
        setReadyOrders(nextReady);

        if (
          notifyIfIncreased &&
          lastPendingCountRef.current !== null &&
          nextPending.size > lastPendingCountRef.current
        ) {
          showAlert("New pending orders arrived.", true);
        }

        lastPendingCountRef.current = nextPending.size;
      } catch (err) {
        if (err instanceof ApiError) {
          setLoadError(err.detail || "Failed to load steward orders.");
        } else {
          setLoadError("Failed to load steward orders.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canAccessSteward, restaurantId, servedOrderIds, showAlert]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!canAccessSteward) return;
    const interval = setInterval(() => {
      void loadData(true, true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [canAccessSteward, loadData]);

  const handleNewOrder = useCallback(
    (event: NewOrderEvent) => {
      const order = orderCardFromEvent(event.data);

      setPendingOrders((prev) => {
        const next = new Map(prev);
        if (!next.has(order.id)) {
          showAlert(`New order ${order.order_number} requires confirmation.`, true);
        }
        next.set(order.id, order);
        lastPendingCountRef.current = next.size;
        return next;
      });
    },
    [showAlert]
  );

  const handleStatusUpdate = useCallback(
    (event: OrderStatusUpdatedEvent) => {
      const { order_id, status, updated_at } = event.data;

      setPendingOrders((prev) => {
        if (!prev.has(order_id)) return prev;
        const next = new Map(prev);
        if (status !== "pending") {
          next.delete(order_id);
        }
        lastPendingCountRef.current = next.size;
        return next;
      });

      setReadyOrders((prev) => {
        const next = new Map(prev);

        if (status === "completed") {
          const current = next.get(order_id);
          if (current) {
            next.set(order_id, { ...current, status: "completed", completed_at: updated_at });
          }
        }

        if (status === "paid" || status === "rejected") {
          next.delete(order_id);
        }

        return next;
      });

      if (status === "completed") {
        void loadData(true);
      }
    },
    [loadData]
  );

  const { isConnected, connectionError } = useKitchenSocket({
    restaurantId: canAccessSteward ? restaurantId : null,
    onNewOrder: handleNewOrder,
    onStatusUpdate: handleStatusUpdate,
  });

  const handlePendingAction = useCallback(async (orderId: number, newStatus: string) => {
    setActionLoadingId(orderId);
    setActionError(null);

    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });

      setPendingOrders((prev) => {
        const next = new Map(prev);
        next.delete(orderId);
        lastPendingCountRef.current = next.size;
        return next;
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.detail || "Failed to update order.");
      } else {
        setActionError("Failed to update order.");
      }
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const handleMarkServed = useCallback((orderId: number) => {
    setServedOrderIds((prev) => {
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });
    setReadyOrders((prev) => {
      const next = new Map(prev);
      next.delete(orderId);
      return next;
    });
  }, []);

  const filteredPendingOrders = useMemo(() => {
    return Array.from(pendingOrders.values())
      .filter((order) => sourceMatches(order, sourceFilter))
      .filter((order) => locationMatches(order, locationFilter))
      .sort((a, b) => new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime());
  }, [locationFilter, pendingOrders, sourceFilter]);

  const filteredReadyOrders = useMemo(() => {
    return Array.from(readyOrders.values())
      .filter((order) => sourceMatches(order, sourceFilter))
      .filter((order) => locationMatches(order, locationFilter))
      .sort(
        (a, b) =>
          new Date(b.completed_at ?? b.placed_at).getTime() -
          new Date(a.completed_at ?? a.placed_at).getTime()
      );
  }, [locationFilter, readyOrders, sourceFilter]);

  const awaitingTableOrders = useMemo(
    () => filteredPendingOrders.filter((order) => order.order_source !== "room"),
    [filteredPendingOrders]
  );
  const awaitingRoomOrders = useMemo(
    () => filteredPendingOrders.filter((order) => order.order_source === "room"),
    [filteredPendingOrders]
  );
  const readyTableOrders = useMemo(
    () => filteredReadyOrders.filter((order) => order.order_source !== "room"),
    [filteredReadyOrders]
  );
  const readyRoomOrders = useMemo(
    () => filteredReadyOrders.filter((order) => order.order_source === "room"),
    [filteredReadyOrders]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Steward Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Confirm incoming orders quickly and manage the ready-to-serve queue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
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
            {isConnected ? "Live" : "Polling every 3s"}
          </span>
          <span className="text-slate-500">Awaiting: {pendingOrders.size}</span>
          <span className="text-slate-500">Ready to Serve: {readyOrders.size}</span>
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

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("awaiting")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "awaiting"
                ? "bg-blue-600 text-white"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Awaiting Confirmation ({pendingOrders.size})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ready")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "ready"
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Ready to Serve ({readyOrders.size})
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
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

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading steward orders...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{loadError}</div>
      ) : activeTab === "awaiting" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <KitchenOrderSection
            title="Table Orders"
            orders={awaitingTableOrders}
            headerColor="bg-indigo-600"
            emptyMessage="No pending table orders"
            onAction={handlePendingAction}
            actionLoadingId={actionLoadingId}
          />
          <KitchenOrderSection
            title="Room Orders"
            orders={awaitingRoomOrders}
            headerColor="bg-teal-600"
            emptyMessage="No pending room orders"
            onAction={handlePendingAction}
            actionLoadingId={actionLoadingId}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <KitchenOrderSection
            title="Ready Table Orders"
            orders={readyTableOrders}
            headerColor="bg-emerald-600"
            emptyMessage="No ready table orders"
            onAction={handlePendingAction}
            actionLoadingId={actionLoadingId}
            renderActions={(order) => (
              <button
                type="button"
                onClick={() => handleMarkServed(order.id)}
                className="w-full rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Mark Served
              </button>
            )}
          />
          <KitchenOrderSection
            title="Ready Room Orders"
            orders={readyRoomOrders}
            headerColor="bg-cyan-600"
            emptyMessage="No ready room orders"
            onAction={handlePendingAction}
            actionLoadingId={actionLoadingId}
            renderActions={(order) => (
              <button
                type="button"
                onClick={() => handleMarkServed(order.id)}
                className="w-full rounded bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
              >
                Mark Served
              </button>
            )}
          />
        </div>
      )}
    </div>
  );
}
