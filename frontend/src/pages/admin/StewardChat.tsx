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
  Clock,
  MapPin,
} from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { useKitchenSocket } from "@/hooks/useKitchenSocket";
import { ApiError, api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { QR_MENU_STAFF_ROLES } from "@/lib/moduleAccess";
import type {
  BillRequestedEvent,
  ServiceRequestedEvent,
  ServiceAcknowledgedEvent,
  BillAcknowledgedEvent,
} from "@/types/realtime";

// --- Constants & Types ---

const STEWARD_ROLES = new Set<string>(QR_MENU_STAFF_ROLES);
const POLL_INTERVAL_MS = 10000; // Increased to 10s as we have sockets

const SERVICE_CONFIG: Record<string, { label: string; icon: any; color: string; textColor: string; lightColor: string }> = {
  WATER: { label: "Water", icon: Droplets, color: "bg-blue-600", textColor: "text-blue-600", lightColor: "bg-blue-50" },
  BILL: { label: "Bill Request", icon: FileText, color: "bg-rose-600", textColor: "text-rose-600", lightColor: "bg-rose-50" },
  STEWARD: { label: "Call Steward", icon: User, color: "bg-amber-600", textColor: "text-amber-600", lightColor: "bg-amber-50" },
  CUTLERY: { label: "Extra Cutlery", icon: Utensils, color: "bg-slate-600", textColor: "text-slate-600", lightColor: "bg-slate-50" },
  NAPKINS: { label: "Napkins / Tissues", icon: Layers, color: "bg-pink-600", textColor: "text-pink-600", lightColor: "bg-pink-50" },
  CLEANING: { label: "Table Cleaning", icon: Sparkles, color: "bg-emerald-600", textColor: "text-emerald-600", lightColor: "bg-emerald-50" },
  ORDER_UPDATE: { label: "Order Help", icon: RotateCcw, color: "bg-cyan-600", textColor: "text-cyan-600", lightColor: "bg-cyan-50" },
  CONDIMENTS: { label: "Sauces / Spices", icon: Salad, color: "bg-orange-600", textColor: "text-orange-600", lightColor: "bg-orange-50" },
  REFRESHMENTS: { label: "Toothpicks", icon: Smile, color: "bg-teal-600", textColor: "text-teal-600", lightColor: "bg-teal-50" },
  WIFI: { label: "Wifi Password", icon: Wifi, color: "bg-indigo-600", textColor: "text-indigo-600", lightColor: "bg-indigo-50" },
  FEEDBACK: { label: "Feedback", icon: Star, color: "bg-purple-600", textColor: "text-purple-600", lightColor: "bg-purple-50" },
};

interface UnifiedRequest {
  id: string | number;
  session_id: string;
  table_number: string;
  customer_name: string | null;
  type: string; // 'BILL' or service type
  message: string | null;
  order_source: string;
  requested_at: string;
}

// --- Utils ---

function playNotificationTone() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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

// --- Components ---

interface RequestCardProps {
  request: UnifiedRequest;
  isProcessing: boolean;
  onAcknowledge: (req: UnifiedRequest) => void;
}

function RequestCard({ request, isProcessing, onAcknowledge }: RequestCardProps) {
  const config = SERVICE_CONFIG[request.type] || {
    label: request.type,
    icon: Bell,
    color: "bg-slate-600",
    textColor: "text-slate-600",
    lightColor: "bg-slate-50",
  };
  const Icon = config.icon;
  const time = new Date(request.requested_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="group overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/50 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/50">
      <div className={`px-8 py-6 flex items-center justify-between text-white ${config.color} transition-colors`}>
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 backdrop-blur-md">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                {config.label}
              </span>
              <span className="h-1 w-1 rounded-full bg-white/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-100">
                {request.order_source === "room" ? "ROOM" : "TABLE"}
              </span>
            </div>
            <p className="text-2xl font-black leading-tight">
              {request.order_source === "room" ? "Room" : "Table"} {request.table_number}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 backdrop-blur-md">
            <Clock className="h-3 w-3" />
            <span className="text-[11px] font-bold">{time}</span>
          </div>
          <div className="flex h-2.5 w-2.5 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        </div>
      </div>

      <div className="p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-50 border border-slate-100 grid place-items-center">
            <User className="h-6 w-6 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Guest Name</p>
            <p className="truncate text-base font-black text-slate-900">{request.customer_name || "Anonymous Guest"}</p>
          </div>
        </div>

        {request.message && (
          <div className={`mb-8 rounded-3xl ${config.lightColor} p-5 border border-white relative`}>
            <div className="absolute -top-3 left-6 px-3 py-0.5 bg-white rounded-full border border-slate-100 shadow-sm">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Message</span>
            </div>
            <p className={`text-sm font-bold ${config.textColor} leading-relaxed italic pt-1`}>
              "{request.message}"
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={isProcessing}
          onClick={() => onAcknowledge(request)}
          className={`w-full group relative flex items-center justify-center gap-3 overflow-hidden rounded-[1.5rem] py-4 text-sm font-black transition-all active:scale-[0.97] disabled:opacity-60 shadow-lg ${
            request.type === 'BILL'
              ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-200'
              : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-300'
          }`}
        >
          {isProcessing ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>
              <Check className="h-5 w-5 transition-transform group-hover:scale-125" />
              <span>Acknowledge Request</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function StewardChatPage() {
  const user = getUser();
  const role = user?.role ?? "";

  if (!user || !STEWARD_ROLES.has(role)) {
    return null;
  }

  return (
    <DashboardLayout>
      <StewardChat restaurantId={user.restaurant_id} />
    </DashboardLayout>
  );
}

function StewardChat({ restaurantId }: { restaurantId: number | null }) {
  const [requests, setRequests] = useState<Map<string, UnifiedRequest>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | number | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"table" | "room">("table");
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Minimum distance for a swipe to be recognized (in pixels)
  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    
    // Only trigger if horizontal swipe is stronger than vertical scroll
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;

    if (isHorizontalSwipe) {
      if (isLeftSwipe && sourceFilter === "table") {
        setSourceFilter("room");
      } else if (isRightSwipe && sourceFilter === "room") {
        setSourceFilter("table");
      }
    }
  };

  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAlert = useCallback((message: string, withSound = false) => {
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    setAlert(message);
    alertTimerRef.current = setTimeout(() => setAlert(null), 8000);
    if (withSound) playNotificationTone();
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!restaurantId) return;
    
    if (silent) setRefreshing(true);
    else setLoading(true);
    
    setError(null);

    try {
      const [billsRes, serviceRes] = await Promise.all([
        api.get<{ requests: any[] }>("/table-sessions/bill-requests"),
        api.get<{ requests: any[] }>("/table-sessions/service-requests"),
      ]);

      const nextRequests = new Map<string, UnifiedRequest>();

      billsRes.requests.forEach(req => {
        nextRequests.set(`BILL:${req.session_id}`, {
          ...req,
          id: req.session_id,
          type: 'BILL',
          message: req.message || null
        });
      });

      serviceRes.requests.forEach(req => {
        nextRequests.set(`SERVICE:${req.id}`, {
          ...req,
          type: req.service_type
        });
      });

      setRequests(nextRequests);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to sync requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  // --- Real-time Handlers ---

  const handleBillRequested = useCallback((event: BillRequestedEvent) => {
    const { table_number, customer_name, session_id, requested_at, order_source } = event.data;
    const label = order_source === "room" ? `Room ${table_number}` : `Table ${table_number}`;
    
    showAlert(`${label} (${customer_name || "Guest"}) is requesting the bill!`, true);
    
    setRequests(prev => {
      const next = new Map(prev);
      next.set(`BILL:${session_id}`, {
        id: session_id,
        session_id,
        table_number,
        customer_name,
        type: 'BILL',
        message: null,
        order_source,
        requested_at
      });
      return next;
    });
  }, [showAlert]);

  const handleServiceRequested = useCallback((event: ServiceRequestedEvent) => {
    const { request_id, table_number, customer_name, session_id, service_type, message, requested_at, order_source } = event.data;
    const config = SERVICE_CONFIG[service_type];
    const label = order_source === "room" ? `Room ${table_number}` : `Table ${table_number}`;
    
    showAlert(`${label} (${customer_name || "Guest"}) is requesting ${config?.label || service_type}!`, true);

    setRequests(prev => {
      const next = new Map(prev);
      next.set(`SERVICE:${request_id}`, {
        id: request_id || 0,
        session_id,
        table_number,
        customer_name,
        type: service_type,
        message,
        order_source,
        requested_at
      });
      return next;
    });
  }, [showAlert]);

  const handleServiceAcknowledged = useCallback((event: ServiceAcknowledgedEvent) => {
    setRequests(prev => {
      const next = new Map(prev);
      next.delete(`SERVICE:${event.data.request_id}`);
      return next;
    });
  }, []);

  const handleBillAcknowledged = useCallback((event: BillAcknowledgedEvent) => {
    setRequests(prev => {
      const next = new Map(prev);
      next.delete(`BILL:${event.data.session_id}`);
      return next;
    });
  }, []);

  const { isConnected } = useKitchenSocket({
    restaurantId,
    onBillRequested: handleBillRequested,
    onServiceRequested: handleServiceRequested,
    onServiceAcknowledged: handleServiceAcknowledged,
    onBillAcknowledged: handleBillAcknowledged,
  });

  const handleAcknowledge = useCallback(async (req: UnifiedRequest) => {
    setActionId(req.id);
    try {
      const endpoint = req.type === 'BILL' 
        ? `/table-sessions/bill-requests/${req.id}/acknowledge`
        : `/table-sessions/service-requests/${req.id}/acknowledge`;
      
      await api.patch(endpoint, {});
      
      setRequests(prev => {
        const next = new Map(prev);
        next.delete(req.type === 'BILL' ? `BILL:${req.id}` : `SERVICE:${req.id}`);
        return next;
      });
      
      showAlert(`Acknowledged request for ${req.order_source === 'room' ? 'Room' : 'Table'} ${req.table_number}`);
    } catch (err) {
      showAlert(err instanceof ApiError ? err.detail : "Failed to acknowledge request");
    } finally {
      setActionId(null);
    }
  }, [showAlert]);

  const tableRequests = useMemo(() => 
    Array.from(requests.values())
      .filter(r => r.order_source === "table")
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()),
    [requests]
  );

  const roomRequests = useMemo(() => 
    Array.from(requests.values())
      .filter(r => r.order_source === "room")
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()),
    [requests]
  );

  const counts = {
    table: tableRequests.length,
    room: roomRequests.length,
  };

  return (
    <div 
      className="max-w-[1600px] mx-auto space-y-10 pb-20 touch-pan-y overflow-x-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header Section */}
      <div className="rounded-[3rem] border border-slate-100 bg-white/80 backdrop-blur-xl p-8 shadow-2xl shadow-slate-200/50">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-slate-900 text-white shadow-2xl shadow-slate-400 ring-4 ring-white">
                <Bell className="h-10 w-10" />
              </div>
              {isConnected && (
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 border-4 border-white animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900">Service Stream</h1>
              <div className="mt-2 flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-rose-500"}`} />
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
                  {isConnected ? "Live Connection Established" : "Attempting Reconnection..."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex p-1.5 bg-slate-100 rounded-[2rem] shadow-inner overflow-hidden min-w-[320px]">
              {/* Sliding Background Pill */}
              <div 
                className="absolute top-1.5 bottom-1.5 rounded-[1.5rem] bg-white shadow-xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
                style={{
                  left: sourceFilter === "table" ? "6px" : "calc(50% + 3px)",
                  width: "calc(50% - 9px)",
                }}
              />

              {(["table", "room"] as const).map((source) => (
                <button
                  key={source}
                  onClick={() => setSourceFilter(source)}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-3 py-3.5 text-[11px] font-black uppercase tracking-widest transition-colors duration-500 ${
                    sourceFilter === source ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <MapPin className={`h-3.5 w-3.5 transition-colors duration-500 ${
                    sourceFilter === source ? "text-slate-900" : "text-slate-400"
                  }`} />
                  <span>{source}s</span>
                  {counts[source] > 0 && (
                    <span className={`flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-[10px] font-black transition-all duration-500 ${
                      sourceFilter === source ? "bg-slate-900 text-white scale-110" : "bg-slate-200 text-slate-500"
                    }`}>
                      {counts[source]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={loading || refreshing}
              className="group flex h-14 w-14 items-center justify-center rounded-[1.75rem] bg-white border-2 border-slate-100 text-slate-900 transition-all hover:border-slate-900 hover:shadow-lg active:scale-90 disabled:opacity-50"
              title="Manual Refresh"
            >
              <RotateCcw className={`h-6 w-6 ${refreshing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-700"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-in slide-in-from-top-4 duration-500">
          <div className="rounded-[2rem] bg-slate-900 text-white p-5 shadow-2xl flex items-center gap-4 border border-white/10 backdrop-blur-md">
            <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold tracking-wide flex-1">{alert}</p>
            <button onClick={() => setAlert(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Check className="h-4 w-4 opacity-50" />
            </button>
          </div>
        </div>
      )}

      {/* Sync Error Banner */}
      {error && (
        <div className="rounded-[2.5rem] bg-rose-50 border border-rose-100 p-6 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-200">
            <RotateCcw className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1">Sync Issue Detected</p>
            <p className="text-sm font-bold text-rose-900">{error}</p>
          </div>
          <button 
            onClick={() => void loadData()}
            className="px-6 py-2 bg-white rounded-xl border border-rose-200 text-xs font-black uppercase tracking-widest text-rose-600 hover:bg-rose-100 transition-colors"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Main Content Area with Sliding Transition */}
      <div className="relative overflow-hidden -mx-4 px-4 sm:-mx-0 sm:px-0">
        <div 
          className={`flex transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            sourceFilter === "room" ? "-translate-x-1/2" : "translate-x-0"
          }`}
          style={{ width: "200%" }}
        >
          {/* Tables Slide */}
          <div className="w-1/2 pr-4 sm:pr-0">
            {loading ? (
              <div className="py-40 flex flex-col items-center justify-center space-y-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Tables...</p>
              </div>
            ) : tableRequests.length === 0 ? (
              <div className="py-40 flex flex-col items-center justify-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100 shadow-sm mx-4 sm:mx-0">
                <div className="h-24 w-24 rounded-[2.5rem] bg-slate-50 flex items-center justify-center mb-8">
                  <Bell className="h-10 w-10 text-slate-200" />
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tight">Table floor is quiet</p>
                <p className="text-sm text-slate-400 mt-2 font-medium px-6 text-center">New table requests will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3 p-1">
                {tableRequests.map((req) => (
                  <RequestCard
                    key={`${req.type}:${req.id}`}
                    request={req}
                    isProcessing={actionId === req.id}
                    onAcknowledge={handleAcknowledge}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Rooms Slide */}
          <div className="w-1/2 pl-4 sm:pl-0">
            {loading ? (
              <div className="py-40 flex flex-col items-center justify-center space-y-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Rooms...</p>
              </div>
            ) : roomRequests.length === 0 ? (
              <div className="py-40 flex flex-col items-center justify-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100 shadow-sm mx-4 sm:mx-0">
                <div className="h-24 w-24 rounded-[2.5rem] bg-slate-50 flex items-center justify-center mb-8">
                  <Bell className="h-10 w-10 text-slate-200" />
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tight">Room service is quiet</p>
                <p className="text-sm text-slate-400 mt-2 font-medium px-6 text-center">New room requests will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3 p-1">
                {roomRequests.map((req) => (
                  <RequestCard
                    key={`${req.type}:${req.id}`}
                    request={req}
                    isProcessing={actionId === req.id}
                    onAcknowledge={handleAcknowledge}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
