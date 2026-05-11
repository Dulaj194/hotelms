import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Monitor, 
  Clock, 
  Flame, 
  CheckCircle2, 
  AlertCircle,
  Play,
  Package
} from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { useKitchenSocket } from "@/hooks/useKitchenSocket";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { QR_MENU_STAFF_ROLES } from "@/lib/moduleAccess";
import type { OrderStatusUpdatedEvent } from "@/types/realtime";
import type {
  KitchenOrderCard,
  KitchenOrderListResponse,
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

  const groupedColumns = useMemo(() => {
    const all = Array.from(orders.values()).sort((a, b) => 
      new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()
    );

    const groupOrders = (ordersToGroup: KitchenOrderCard[]) => {
      const groups = new Map<string, KitchenOrderCard[]>();
      ordersToGroup.forEach(order => {
        const key = order.order_source === 'room' ? `room-${order.room_number}` : `table-${order.table_number}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(order);
      });
      return Array.from(groups.values());
    };

    return {
      toDo: groupOrders(all.filter(o => o.status === 'pending' || o.status === 'confirmed')),
      doing: groupOrders(all.filter(o => o.status === 'processing'))
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
              {groupedColumns.toDo.length} Tables
            </span>
          </div>
          <div className="flex-1 p-4 grid grid-cols-1 xl:grid-cols-2 gap-4 auto-rows-start overflow-y-auto no-scrollbar">
            {groupedColumns.toDo.map((group, idx) => (
              <TableGroupedKitchenCard 
                key={`todo-${idx}`} 
                orders={group} 
                currentTime={currentTime} 
                onAction={handleAction}
                loadingId={actionLoadingId}
              />
            ))}
            {groupedColumns.toDo.length === 0 && (
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
              {groupedColumns.doing.length} Tables
            </span>
          </div>
          <div className="flex-1 p-4 grid grid-cols-1 xl:grid-cols-2 gap-4 auto-rows-start overflow-y-auto no-scrollbar">
             {groupedColumns.doing.map((group, idx) => (
              <TableGroupedKitchenCard 
                key={`doing-${idx}`} 
                orders={group} 
                currentTime={currentTime} 
                onAction={handleAction}
                loadingId={actionLoadingId}
              />
            ))}
            {groupedColumns.doing.length === 0 && (
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

function TableGroupedKitchenCard({ 
  orders, 
  currentTime, 
  onAction, 
  loadingId 
}: { 
  orders: KitchenOrderCard[], 
  currentTime: number, 
  onAction: (id: number, status: string) => void, 
  loadingId: number | null 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const firstOrder = orders[0];
  const totalOrders = orders.length;
  
  const oldestOrderTime = Math.floor((currentTime - new Date(firstOrder.placed_at).getTime()) / 60000);
  const isUrgent = oldestOrderTime >= 15;
  const isCritical = oldestOrderTime >= 25;

  return (
    <div className={`flex flex-col transition-all duration-300 ${isExpanded ? 'col-span-full space-y-4' : ''}`}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`cursor-pointer bg-white rounded-[2rem] border-4 shadow-lg p-5 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-95 ${
          isCritical ? 'border-rose-500 bg-rose-50' : 
          isUrgent ? 'border-amber-500 bg-amber-50' : 'border-slate-200'
        } ${isExpanded ? 'ring-4 ring-blue-500/20 border-blue-500' : ''}`}
      >
        <div className="flex items-center gap-5">
          <div className={`h-16 w-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl ${
            isCritical ? 'bg-rose-600 text-white' : 
            isUrgent ? 'bg-amber-600 text-white' : 'bg-slate-900 text-white'
          }`}>
            {firstOrder.order_source === 'room' ? 'R' : firstOrder.table_number}
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              {firstOrder.order_source === 'room' ? `Room ${firstOrder.room_number}` : `Table ${firstOrder.table_number}`}
            </h3>
            <div className="flex items-center gap-2 mt-1">
               <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                 isUrgent || isCritical ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-500'
               }`}>
                 {totalOrders} Order{totalOrders > 1 ? 's' : ''}
               </span>
               <div className="flex items-center gap-1 text-xs font-black tabular-nums text-slate-400">
                 <Clock className="h-3 w-3" />
                 {oldestOrderTime}m
               </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {totalOrders > 1 && (
             <div className="flex -space-x-3">
               {orders.slice(0, 3).map((o) => (
                 <div key={o.id} className="h-8 w-8 rounded-full bg-blue-600 text-white border-2 border-white flex items-center justify-center text-[10px] font-black shadow-lg">
                   #{o.order_number.slice(-2)}
                 </div>
               ))}
             </div>
           )}
           <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
             <Package className={`h-6 w-6 ${isExpanded ? 'text-blue-500' : 'text-slate-300'}`} />
           </div>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in zoom-in-95 duration-300">
          {orders.map(order => (
            <KitchenCard 
              key={order.id} 
              order={order} 
              currentTime={currentTime} 
              onAction={onAction}
              loading={loadingId === order.id}
            />
          ))}
          <div 
            onClick={() => setIsExpanded(false)}
            className="flex flex-col items-center justify-center border-4 border-dashed border-slate-200 rounded-[2rem] p-8 text-slate-400 hover:text-slate-600 hover:border-slate-400 cursor-pointer transition-all"
          >
            <Clock className="h-8 w-8 mb-2" />
            <span className="font-black uppercase tracking-widest text-xs">Collapse View</span>
          </div>
        </div>
      )}
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
    <div className={`bg-white rounded-3xl border-2 shadow-sm flex flex-col transition-all h-full ${
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
            #{order.order_number.slice(-3)}
          </div>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${
              isUrgent || isCritical ? 'text-white/80' : 'text-slate-400'
            }`}>
              at {new Date(order.placed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-sm font-black leading-tight uppercase">
               Order #{order.order_number}
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
              <div>
                <p className="text-base font-bold text-slate-800 leading-tight">
                  {item.item_name_snapshot}
                </p>
                {item.notes && (
                  <p className="mt-1 text-[11px] font-medium text-orange-600 italic">
                    Instr: {item.notes}
                  </p>
                )}
              </div>
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
