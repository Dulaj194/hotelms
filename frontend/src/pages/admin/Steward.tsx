import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { 
  Droplets, 
  FileText, 
  User, 
  Utensils, 
  Layers, 
  Sparkles, 
  RotateCcw, 
  Salad, 
  Smile, 
  Wifi, 
  Star,
  Check,
  Bell,
  Clock
} from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import KitchenOrderSection from "@/components/shared/KitchenOrderSection";
import { useKitchenSocket } from "@/hooks/useKitchenSocket";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { QR_MENU_STAFF_ROLES } from "@/lib/moduleAccess";
import type { 
  BillRequestedEvent,
  NewOrderEvent, 
  OrderStatusUpdatedEvent, 
  ServiceRequestedEvent,
} from "@/types/realtime";
import type {
  KitchenOrderCard,
  KitchenOrderItemSummary,
  KitchenOrderListResponse,
} from "@/types/order";

const STEWARD_ROLES = new Set<string>(QR_MENU_STAFF_ROLES);
const POLL_INTERVAL_MS = 3000;
const SERVED_STORAGE_TTL_MS = 12 * 60 * 60 * 1000;

const SERVICE_CONFIG: Record<string, { label: string; icon: any; color: string; textColor: string }> = {
  WATER: { label: "Water", icon: Droplets, color: "bg-blue-500", textColor: "text-blue-500" },
  BILL: { label: "Bill Request", icon: FileText, color: "bg-slate-900", textColor: "text-slate-900" },
  STEWARD: { label: "Call Steward", icon: User, color: "bg-amber-500", textColor: "text-amber-500" },
  CUTLERY: { label: "Extra Cutlery", icon: Utensils, color: "bg-slate-600", textColor: "text-slate-600" },
  NAPKINS: { label: "Napkins / Tissues", icon: Layers, color: "bg-pink-500", textColor: "text-pink-500" },
  CLEANING: { label: "Table Cleaning", icon: Sparkles, color: "bg-emerald-500", textColor: "text-emerald-500" },
  ORDER_UPDATE: { label: "Order Help", icon: RotateCcw, color: "bg-cyan-500", textColor: "text-cyan-500" },
  CONDIMENTS: { label: "Sauces / Spices", icon: Salad, color: "bg-orange-500", textColor: "text-orange-500" },
  REFRESHMENTS: { label: "Toothpicks", icon: Smile, color: "bg-teal-500", textColor: "text-teal-500" },
  WIFI: { label: "Wifi Password", icon: Wifi, color: "bg-indigo-500", textColor: "text-indigo-500" },
  FEEDBACK: { label: "Feedback", icon: Star, color: "bg-purple-500", textColor: "text-purple-500" },
};

type StewardTab = "awaiting" | "ready" | "requests";
type SourceFilter = "all" | "table" | "room";

interface ServiceRequest {
  session_id: string;
  table_number: string;
  customer_name: string | null;
  service_type: string;
  message: string | null;
  requested_at: string;
}

interface BillRequest {
  session_id: string;
  table_number: string;
  customer_name: string | null;
  message?: string | null;
  requested_at: string;
}

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
  const [billRequests, setBillRequests] = useState<Map<string, BillRequest>>(new Map());
  const [serviceRequests, setServiceRequests] = useState<Map<string, ServiceRequest>>(new Map());
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
        const [pendingRes, completedRes, billsRes] = await Promise.all([
          api.get<KitchenOrderListResponse>("/orders/pending"),
          api.get<KitchenOrderListResponse>("/orders/completed"),
          api.get<{ requests: BillRequest[] }>("/table-sessions/bill-requests"),
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

        const nextBills = new Map<string, BillRequest>();
        for (const req of billsRes.requests) {
          nextBills.set(req.session_id, req);
        }

        setPendingOrders(nextPending);
        setReadyOrders(nextReady);
        setBillRequests(nextBills);

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

  const handleBillRequested = useCallback(
    (event: BillRequestedEvent) => {
      const { table_number, customer_name, session_id, requested_at } = event.data;
      showAlert(
        `Table ${table_number} (${customer_name || "Guest"}) is requesting the bill!`,
        true
      );
      
      setBillRequests((prev) => {
        const next = new Map(prev);
        next.set(session_id, {
          session_id,
          table_number,
          customer_name,
          requested_at,
        });
        return next;
      });
    },
    [showAlert]
  );

  const handleServiceRequested = useCallback(
    (event: ServiceRequestedEvent) => {
      const { table_number, customer_name, session_id, service_type, message, requested_at } = event.data;
      const config = SERVICE_CONFIG[service_type];
      showAlert(
        `Table ${table_number} (${customer_name || "Guest"}) is requesting ${config?.label || service_type}!`,
        true
      );
      
      setServiceRequests((prev) => {
        const next = new Map(prev);
        // Use composite key to allow multiple requests per session
        const key = `${session_id}:${service_type}`;
        next.set(key, {
          session_id,
          table_number,
          customer_name,
          service_type,
          message,
          requested_at,
        });
        return next;
      });
    },
    [showAlert]
  );

  const { isConnected, connectionError } = useKitchenSocket({
    restaurantId,
    onNewOrder: handleNewOrder,
    onStatusUpdate: handleStatusUpdate,
    onBillRequested: handleBillRequested,
    onServiceRequested: handleServiceRequested,
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
          {(billRequests.size > 0 || serviceRequests.size > 0) && (
            <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-700 animate-pulse">
              Active Requests: {billRequests.size + serviceRequests.size}
            </span>
          )}
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
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "requests"
                ? "bg-rose-600 text-white shadow-md"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Service Requests ({billRequests.size + serviceRequests.size})
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
      ) : activeTab === "requests" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {billRequests.size === 0 && serviceRequests.size === 0 ? (
            <div className="col-span-full rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No active service or bill requests.
            </div>
          ) : (
            <>
              {/* Combine and sort all requests by time */}
              {[
                ...Array.from(billRequests.values()).map(r => ({ ...r, type: 'BILL', message: null })),
                ...Array.from(serviceRequests.values()).map(r => ({ ...r, type: r.service_type }))
              ]
                .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())
                .map((req) => {
                  const config = SERVICE_CONFIG[req.type] || { label: req.type, icon: Bell, color: "bg-slate-500", textColor: "text-slate-500" };
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={`${req.session_id}:${req.type}`}
                      className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                    >
                      <div className={`px-5 py-4 flex items-center justify-between text-white ${config.color}`}>
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 backdrop-blur-md">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
                              {config.label}
                            </span>
                            <p className="text-xl font-black leading-tight">Table {req.table_number}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-bold opacity-80">
                            {new Date(req.requested_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <div className="flex h-2 w-2 rounded-full bg-white animate-pulse" />
                        </div>
                      </div>
                      
                      <div className="p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 grid place-items-center">
                            <User className="h-5 w-5 text-slate-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Guest Name</p>
                            <p className="truncate text-sm font-bold text-slate-900">{req.customer_name || "Guest"}</p>
                          </div>
                        </div>

                        {req.message && (
                          <div className="mb-5 rounded-2xl bg-slate-50 p-4 border border-slate-100 relative">
                            <div className="absolute -top-2 left-4 px-2 bg-white rounded-full border border-slate-100">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Note</span>
                            </div>
                            <p className="text-xs font-medium text-slate-700 leading-relaxed italic pt-1">
                              "{req.message}"
                            </p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (req.type === 'BILL') {
                              setBillRequests((prev) => {
                                const next = new Map(prev);
                                next.delete(req.session_id);
                                return next;
                              });
                            } else {
                              setServiceRequests((prev) => {
                                const next = new Map(prev);
                                next.delete(`${req.session_id}:${req.type}`);
                                return next;
                              });
                            }
                            showAlert(`Acknowledged ${config.label} for Table ${req.table_number}`);
                          }}
                          className={`w-full group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl py-3 text-sm font-black transition-all active:scale-[0.98] ${
                            req.type === 'BILL' ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          <Check className="h-4 w-4 transition-transform group-hover:scale-110" />
                          <span>Acknowledge Request</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </>
          )}
        </div>
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
