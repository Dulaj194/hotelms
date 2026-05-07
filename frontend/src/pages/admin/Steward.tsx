import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  MoreVertical, 
  Package, 
  PlayCircle, 
  Printer, 
  AlertCircle,
  XCircle,
  CheckCircle,
  ChefHat
} from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import OrderCard from "@/components/shared/OrderCard";
import { useKitchenSocket } from "@/hooks/useKitchenSocket";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { QR_MENU_STAFF_ROLES } from "@/lib/moduleAccess";
import type { 
  NewOrderEvent, 
  OrderStatusUpdatedEvent, 
} from "@/types/realtime";
import type {
  KitchenOrderCard,
  KitchenOrderListResponse,
  OrderStatus
} from "@/types/order";

const STEWARD_ROLES = new Set<string>(QR_MENU_STAFF_ROLES);
const POLL_INTERVAL_MS = 30000; // Polling as fallback only
const SERVED_STORAGE_TTL_MS = 12 * 60 * 60 * 1000;

interface ActivityItem {
  id: string;
  message: string;
  timestamp: string;
  type: 'order' | 'request' | 'system';
  level?: 'info' | 'urgent';
}

function playNotificationTone() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const audioContext = new AudioCtx();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
    oscillator.onended = () => {
      void audioContext.close();
    };
  } catch {
    // Best effort
  }
}

export default function Steward() {
  const user = getUser();
  const role = user?.role ?? "";

  if (!user || !STEWARD_ROLES.has(role)) {
    return null;
  }

  return (
    <DashboardLayout>
      <LiveOperationsDashboard restaurantId={user.restaurant_id} />
    </DashboardLayout>
  );
}

function LiveOperationsDashboard({ restaurantId }: { restaurantId: number | null }) {
  const servedStorageKey = useMemo(
    () => (restaurantId ? `steward_served_orders_${restaurantId}` : null),
    [restaurantId]
  );

  const [orders, setOrders] = useState<Map<number, KitchenOrderCard>>(new Map());
  const [servedOrderIds, setServedOrderIds] = useState<Set<number>>(new Set());
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [alert, setAlert] = useState<{ message: string; type: 'info' | 'urgent' } | null>(null);

  // Load served order IDs from localStorage
  useEffect(() => {
    if (!servedStorageKey) return;
    try {
      const raw = localStorage.getItem(servedStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const now = Date.now();
        const filtered = Object.entries(parsed)
          .filter(([, ts]) => now - (ts as number) <= SERVED_STORAGE_TTL_MS)
          .map(([id]) => Number(id));
        setServedOrderIds(new Set(filtered));
      }
    } catch { /* ignore */ }
  }, [servedStorageKey]);

  // Persist served order IDs
  useEffect(() => {
    if (!servedStorageKey) return;
    const now = Date.now();
    const payload: Record<string, number> = {};
    servedOrderIds.forEach(id => payload[String(id)] = now);
    localStorage.setItem(servedStorageKey, JSON.stringify(payload));
  }, [servedOrderIds, servedStorageKey]);

  const addActivity = useCallback((message: string, type: ActivityItem['type'], level: ActivityItem['level'] = 'info') => {
    const item: ActivityItem = {
      id: Math.random().toString(36).substr(2, 9),
      message,
      timestamp: new Date().toISOString(),
      type,
      level
    };
    setActivities(prev => [item, ...prev].slice(0, 50));
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!restaurantId) return;
    if (!silent) setLoading(true);
    try {
      const [pending, processing, completed] = await Promise.all([
        api.get<KitchenOrderListResponse>("/orders/pending"),
        api.get<KitchenOrderListResponse>("/orders/processing"),
        api.get<KitchenOrderListResponse>("/orders/completed"),
      ]);

      const map = new Map<number, KitchenOrderCard>();
      [...pending.orders, ...processing.orders, ...completed.orders].forEach(o => map.set(o.id, o));
      setOrders(map);
    } catch (err) {
      console.error("Failed to load operations data", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleNewOrder = useCallback((event: NewOrderEvent) => {
    playNotificationTone();
    const orderNum = event.data.order_number;
    const location = event.data.order_source === 'room' ? `Room ${event.data.room_number}` : `Table ${event.data.table_number}`;
    addActivity(`${location} placed a new order #${orderNum}`, 'order', 'urgent');
    setAlert({ message: `New Order #${orderNum} from ${location}`, type: 'urgent' });
    setTimeout(() => setAlert(null), 8000);
    void loadData(true);
  }, [addActivity, loadData]);

  const handleStatusUpdate = useCallback((event: OrderStatusUpdatedEvent) => {
    const { order_id, status } = event.data;
    const order = orders.get(order_id);
    if (order) {
      if (status === 'completed') {
        playNotificationTone();
        addActivity(`Order #${order.order_number} is READY for service!`, 'order', 'info');
      }
    }
    void loadData(true);
  }, [addActivity, loadData, orders]);

  const { isConnected } = useKitchenSocket({
    restaurantId,
    onNewOrder: handleNewOrder,
    onStatusUpdate: handleStatusUpdate,
    onServiceRequested: (ev) => {
      playNotificationTone();
      addActivity(`${ev.data.location_label} requested ${ev.data.service_type}`, 'request', 'urgent');
    }
  });

  const handleAction = async (orderId: number, status: string) => {
    setActionLoadingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      void loadData(true);
    } catch (err) {
      console.error("Action failed", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const markServed = (orderId: number) => {
    setServedOrderIds(prev => new Set(prev).add(orderId));
  };

  const metrics = useMemo(() => {
    const all = Array.from(orders.values());
    const served = all.filter(o => servedOrderIds.has(o.id)).length;
    return {
      pending: all.filter(o => o.status === 'pending').length,
      preparing: all.filter(o => o.status === 'confirmed' || o.status === 'processing').length,
      ready: all.filter(o => o.status === 'completed' && !servedOrderIds.has(o.id)).length,
      delivered: served,
      rejected: all.filter(o => o.status === 'rejected').length
    };
  }, [orders, servedOrderIds]);

  const columns = useMemo(() => {
    const all = Array.from(orders.values());
    return {
      new: all.filter(o => o.status === 'pending'),
      cooking: all.filter(o => o.status === 'confirmed' || o.status === 'processing'),
      ready: all.filter(o => o.status === 'completed' && !servedOrderIds.has(o.id))
    };
  }, [orders, servedOrderIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
        Loading Operations...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sticky Header with Alert */}
      {alert && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md animate-in fade-in slide-in-from-top-4 duration-300`}>
          <div className={`mx-4 rounded-xl border p-4 shadow-2xl flex items-center gap-3 ${alert.type === 'urgent' ? 'bg-red-600 text-white border-red-500' : 'bg-blue-600 text-white border-blue-500'}`}>
            {alert.type === 'urgent' ? <AlertCircle className="h-6 w-6 animate-bounce" /> : <CheckCircle2 className="h-6 w-6" />}
            <span className="font-bold flex-1">{alert.message}</span>
            <button onClick={() => setAlert(null)} className="p-1 hover:bg-white/20 rounded">
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="New" value={metrics.pending} icon={Package} color="amber" />
        <MetricCard label="Cooking" value={metrics.preparing} icon={ChefHat} color="blue" />
        <MetricCard label="Ready" value={metrics.ready} icon={CheckCircle} color="green" />
        <MetricCard label="Served" value={metrics.delivered} icon={CheckCircle2} color="slate" />
        <MetricCard label="Rejected" value={metrics.rejected} icon={XCircle} color="red" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
          {/* New Orders */}
          <KanbanColumn title="New Orders" count={columns.new.length} color="amber">
            {columns.new.map(order => (
              <OperationCard 
                key={order.id} 
                order={order} 
                onAction={handleAction} 
                loading={actionLoadingId === order.id}
              />
            ))}
          </KanbanColumn>

          {/* Cooking */}
          <KanbanColumn title="Cooking" count={columns.cooking.length} color="blue">
            {columns.cooking.map(order => (
              <OperationCard 
                key={order.id} 
                order={order} 
                onAction={handleAction} 
                loading={actionLoadingId === order.id}
              />
            ))}
          </KanbanColumn>

          {/* Ready */}
          <KanbanColumn title="Ready" count={columns.ready.length} color="green">
            {columns.ready.map(order => (
              <OperationCard 
                key={order.id} 
                order={order} 
                loading={actionLoadingId === order.id}
                onAction={handleAction}
                renderActions={() => (
                  <button 
                    onClick={() => markServed(order.id)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Mark Served
                  </button>
                )}
              />
            ))}
          </KanbanColumn>
        </div>

        {/* Sidebar Activity Feed */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-320px)] sticky top-6">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Activity className="h-4 w-4 text-blue-600" />
                Activity Feed
              </h3>
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {activities.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No recent activities
                </div>
              ) : (
                activities.map(item => (
                  <div key={item.id} className={`flex gap-3 text-sm animate-in fade-in slide-in-from-right-2 duration-300`}>
                    <div className={`mt-0.5 h-8 w-8 rounded-full shrink-0 flex items-center justify-center ${
                      item.type === 'order' ? 'bg-blue-100 text-blue-600' : 
                      item.type === 'request' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.type === 'order' ? <Package className="h-4 w-4" /> : 
                       item.type === 'request' ? <MessageSquare className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className={`font-medium leading-tight ${item.level === 'urgent' ? 'text-slate-900' : 'text-slate-700'}`}>
                        {item.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: string }) {
  const colors: Record<string, string> = {
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    green: "text-green-600 bg-green-50 border-green-100",
    slate: "text-slate-600 bg-slate-50 border-slate-100",
    red: "text-red-600 bg-red-50 border-red-100"
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm flex items-center justify-between bg-white transition-all hover:shadow-md ${colors[color] || colors.slate}`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</p>
        <p className="text-2xl font-black mt-1 tabular-nums">{value}</p>
      </div>
      <div className={`p-2.5 rounded-xl ${colors[color].replace('border-', 'bg-opacity-20 ')}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function KanbanColumn({ title, count, color, children }: { title: string, count: number, color: string, children: React.ReactNode }) {
  const colors: Record<string, string> = {
    amber: "border-amber-500",
    blue: "border-blue-500",
    green: "border-green-500"
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden">
      <div className={`p-4 border-t-4 ${colors[color]} flex items-center justify-between bg-white`}>
        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">{title}</h3>
        <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-xs font-bold text-slate-600">{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 opacity-30 text-slate-400">
            <Package className="h-12 w-12 mb-2 stroke-1" />
            <p className="text-sm font-medium">Empty</p>
          </div>
        ) : children}
      </div>
    </div>
  );
}

function OperationCard({ order, onAction, loading, renderActions }: { 
  order: KitchenOrderCard, 
  onAction: (id: number, status: string) => void, 
  loading: boolean,
  renderActions?: () => React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false);
  const timeInQueue = Math.floor((Date.now() - new Date(order.placed_at).getTime()) / 60000);
  const isUrgent = timeInQueue > 15 && order.status !== 'completed';

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-blue-100 text-blue-700",
    processing: "bg-indigo-100 text-indigo-700",
    completed: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700"
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all overflow-hidden ${isUrgent ? 'border-red-300 ring-2 ring-red-50' : 'border-slate-200'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-slate-900">#{order.order_number}</h4>
              {isUrgent && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-black uppercase animate-pulse">Late</span>}
            </div>
            <p className="text-sm font-bold text-slate-600 mt-0.5">
              {order.order_source === 'room' ? `Room ${order.room_number}` : `Table ${order.table_number}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
             <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColors[order.status]}`}>
              {order.status}
            </span>
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
              <Clock className="h-3 w-3" />
              {timeInQueue} min
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Items ({order.items.length})</span>
            <button 
              onClick={() => setExpanded(!expanded)} 
              className="text-blue-600 font-bold hover:underline"
            >
              {expanded ? 'Hide' : 'Show Details'}
            </button>
          </div>
          
          {(expanded || order.items.length <= 3) && (
            <ul className="space-y-1.5">
              {order.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
                    {item.quantity}
                  </span>
                  <span className="text-slate-800 font-medium">{item.item_name_snapshot}</span>
                </li>
              ))}
            </ul>
          )}

          {!expanded && order.items.length > 3 && (
            <p className="text-xs text-slate-400 italic">+ {order.items.length - 3} more items...</p>
          )}
        </div>

        {order.notes && (
          <div className="mt-3 p-2 bg-amber-50 border border-amber-100 rounded-lg flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium italic">{order.notes}</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
          {renderActions ? renderActions() : (
            <>
              {order.status === 'pending' && (
                <>
                  <button 
                    disabled={loading}
                    onClick={() => onAction(order.id, 'confirmed')}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-lg transition-all active:scale-95"
                  >
                    Accept
                  </button>
                  <button 
                    disabled={loading}
                    onClick={() => onAction(order.id, 'rejected')}
                    className="bg-red-50 hover:bg-red-100 text-red-600 p-2.5 rounded-lg transition-all"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </>
              )}
              {order.status === 'confirmed' && (
                <button 
                  disabled={loading}
                  onClick={() => onAction(order.id, 'processing')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <PlayCircle className="h-5 w-5" />
                  Start Cooking
                </button>
              )}
              {order.status === 'processing' && (
                <button 
                  disabled={loading}
                  onClick={() => onAction(order.id, 'completed')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Ready to Serve
                </button>
              )}
            </>
          )}
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2.5 rounded-lg transition-all">
            <Printer className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
