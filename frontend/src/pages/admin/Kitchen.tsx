import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { 
  Monitor, 
  Clock, 
  Flame, 
  CheckCircle2, 
  ChevronRight, 
  AlertCircle,
  Play,
  Package
} from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { useKitchenSocket } from "@/hooks/useKitchenSocket";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { QR_MENU_STAFF_ROLES } from "@/lib/moduleAccess";
import type { NewOrderEvent, OrderStatusUpdatedEvent } from "@/types/realtime";
import type {
  KitchenOrderCard,
  KitchenOrderListResponse,
  OrderStatus,
} from "@/types/order";

const KITCHEN_ROLES = new Set<string>(QR_MENU_STAFF_ROLES);

export default function Kitchen() {
  const user = getUser();
  const role = user?.role ?? "";

  if (!user || !KITCHEN_ROLES.has(role)) {
    return null;
  }

  return (
    <DashboardLayout>
      <KitchenQueue restaurantId={user.restaurant_id} />
    </DashboardLayout>
  );
}

function KitchenQueue({ restaurantId }: { restaurantId: number | null }) {
  const [orders, setOrders] = useState<Map<number, KitchenOrderCard>>(new Map());
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second for timers
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = useCallback(async (silent = false) => {
    if (!restaurantId) return;
    if (!silent) setLoading(true);
    try {
      const [pendingRes, processingRes] = await Promise.all([
        api.get<KitchenOrderListResponse>("/orders/pending"),
        api.get<KitchenOrderListResponse>("/orders/processing"),
      ]);

      const map = new Map<number, KitchenOrderCard>();
      // Only show orders that are either pending (need confirmation/start) or confirmed/processing
      [...pendingRes.orders, ...processingRes.orders].forEach(o => map.set(o.id, o));
      setOrders(map);
    } catch (err) {
      console.error("Failed to load KDS orders", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleStatusUpdate = useCallback((event: OrderStatusUpdatedEvent) => {
    const { order_id, status } = event.data;
    if (['completed', 'rejected', 'paid'].includes(status)) {
      setOrders(prev => {
        const next = new Map(prev);
        next.delete(order_id);
        return next;
      });
    } else {
      void loadOrders(true);
    }
  }, [loadOrders]);

  const { isConnected } = useKitchenSocket({
    restaurantId,
    onNewOrder: () => void loadOrders(true),
    onStatusUpdate: handleStatusUpdate,
  });

  const handleAction = async (orderId: number, status: string) => {
    setActionLoadingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      void loadOrders(true);
    } catch (err) {
      console.error("KDS Action failed", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const columns = useMemo(() => {
    const all = Array.from(orders.values()).sort((a, b) => 
      new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()
    );
    return {
      toDo: all.filter(o => o.status === 'pending' || o.status === 'confirmed'),
      doing: all.filter(o => o.status === 'processing')
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 font-bold uppercase tracking-widest animate-pulse">
        Initializing Kitchen Monitor...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header Info */}
      <div className="flex items-center justify-between bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl">
            <Monitor className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Kitchen Queue</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                {isConnected ? 'Real-time Feed Active' : 'Connecting...'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Orders</p>
            <p className="text-2xl font-black tabular-nums">{orders.size}</p>
          </div>
          <div className="w-px h-10 bg-slate-800" />
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Time</p>
            <p className="text-2xl font-black tabular-nums">
              {new Date(currentTime).toLocaleTimeString([], { hour12: false })}
            </p>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[600px]">
        {/* TO DO COLUMN */}
        <div className="flex flex-col bg-slate-100/50 rounded-[2.5rem] border border-slate-200 overflow-hidden">
          <div className="p-5 bg-white border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-500" />
              Incoming / To Cook
            </h2>
            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-black">
              {columns.toDo.length}
            </span>
          </div>
          <div className="flex-1 p-4 grid grid-cols-1 xl:grid-cols-2 gap-4 auto-rows-start overflow-y-auto no-scrollbar">
            {columns.toDo.map(order => (
              <KitchenCard 
                key={order.id} 
                order={order} 
                currentTime={currentTime} 
                onAction={handleAction}
                loading={actionLoadingId === order.id}
              />
            ))}
            {columns.toDo.length === 0 && (
              <div className="col-span-full h-full flex flex-col items-center justify-center opacity-20 py-20">
                <Flame className="h-16 w-16 mb-4" />
                <p className="font-black uppercase tracking-widest">Kitchen Clear</p>
              </div>
            )}
          </div>
        </div>

        {/* IN PROGRESS COLUMN */}
        <div className="flex flex-col bg-blue-50/50 rounded-[2.5rem] border border-blue-100 overflow-hidden">
          <div className="p-5 bg-white border-b border-blue-100 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
              <Flame className="h-5 w-5 text-blue-500 animate-pulse" />
              On The Fire
            </h2>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-black">
              {columns.doing.length}
            </span>
          </div>
          <div className="flex-1 p-4 grid grid-cols-1 xl:grid-cols-2 gap-4 auto-rows-start overflow-y-auto no-scrollbar">
             {columns.doing.map(order => (
              <KitchenCard 
                key={order.id} 
                order={order} 
                currentTime={currentTime} 
                onAction={handleAction}
                loading={actionLoadingId === order.id}
              />
            ))}
            {columns.doing.length === 0 && (
              <div className="col-span-full h-full flex flex-col items-center justify-center opacity-20 py-20">
                <Flame className="h-16 w-16 mb-4" />
                <p className="font-black uppercase tracking-widest">Nothing Cooking</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KitchenCard({ order, currentTime, onAction, loading }: { 
  order: KitchenOrderCard, 
  currentTime: number,
  onAction: (id: number, status: string) => void,
  loading: boolean
}) {
  const timeInQueue = Math.floor((currentTime - new Date(order.placed_at).getTime()) / 1000);
  const minutes = Math.floor(timeInQueue / 60);
  const seconds = timeInQueue % 60;
  
  const isUrgent = minutes >= 15;
  const isCritical = minutes >= 25;

  return (
    <div className={`bg-white rounded-3xl border-2 shadow-sm flex flex-col transition-all ${
      isCritical ? 'border-rose-500 ring-4 ring-rose-50 animate-pulse' : 
      isUrgent ? 'border-amber-500 shadow-amber-100' : 'border-slate-100'
    }`}>
      {/* Card Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        isCritical ? 'bg-rose-500 text-white border-rose-600' : 
        isUrgent ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-50 border-slate-100'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-lg ${
            isUrgent || isCritical ? 'bg-white/20' : 'bg-white text-slate-900 border border-slate-200'
          }`}>
            #{order.order_number}
          </div>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${
              isUrgent || isCritical ? 'text-white/80' : 'text-slate-400'
            }`}>
              {order.order_source === 'room' ? 'Room Service' : 'Restaurant'}
            </p>
            <p className="text-sm font-black leading-tight">
               {order.order_source === 'room' ? `ROOM ${order.room_number}` : `TABLE ${order.table_number}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 font-black tabular-nums">
            <Clock className="h-4 w-4" />
            <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      {/* Item List */}
      <div className="flex-1 p-4">
        <ul className="space-y-2">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <div className="h-6 min-w-[24px] bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs font-black">
                {item.quantity}
              </div>
              <p className="text-base font-bold text-slate-800 leading-tight">
                {item.item_name_snapshot}
              </p>
            </li>
          ))}
        </ul>
        
        {order.notes && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-amber-800 italic">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-50 bg-slate-50/30">
        {order.status === 'pending' || order.status === 'confirmed' ? (
          <button 
            disabled={loading}
            onClick={() => onAction(order.id, 'processing')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-100"
          >
            <Play className="h-5 w-5 fill-current" />
            START COOKING
          </button>
        ) : (
          <button 
            disabled={loading}
            onClick={() => onAction(order.id, 'completed')}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-100"
          >
            <CheckCircle2 className="h-5 w-5" />
            MARK READY
          </button>
        )}
      </div>
    </div>
  );
}
