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
  Bell
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

const STEWARD_ROLES = new Set<string>(QR_MENU_STAFF_ROLES);
const POLL_INTERVAL_MS = 6000;

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

interface ServiceRequest {
  id: number;
  session_id: string;
  table_number: string;
  customer_name: string | null;
  service_type: string;
  message: string | null;
  order_source: string;
  requested_at: string;
}

interface BillRequest {
  session_id: string;
  table_number: string;
  customer_name: string | null;
  message?: string | null;
  order_source: string;
  requested_at: string;
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

interface StewardChatProps {
  restaurantId: number | null;
}

function StewardChat({ restaurantId }: StewardChatProps) {
  const canAccessChat = Boolean(restaurantId);

  const [billRequests, setBillRequests] = useState<Map<string, BillRequest>>(new Map());
  const [serviceRequests, setServiceRequests] = useState<Map<string, ServiceRequest>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "table" | "room">("all");

  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAlert = useCallback((message: string, withSound = false) => {
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    setAlert(message);
    alertTimerRef.current = setTimeout(() => setAlert(null), 8000);
    if (withSound) playNotificationTone();
  }, []);

  const loadData = useCallback(
    async (silent = false) => {
      if (!restaurantId || !canAccessChat) {
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
        const [billsRes, serviceRes] = await Promise.all([
          api.get<{ requests: BillRequest[] }>("/table-sessions/bill-requests"),
          api.get<{ requests: ServiceRequest[] }>("/table-sessions/service-requests"),
        ]);

        const nextBills = new Map<string, BillRequest>();
        for (const req of billsRes.requests) {
          nextBills.set(req.session_id, req);
        }

        const nextService = new Map<string, ServiceRequest>();
        for (const req of serviceRes.requests) {
          const key = String(req.id || `${req.session_id}:${req.service_type}`);
          nextService.set(key, req);
        }

        setBillRequests(nextBills);
        setServiceRequests(nextService);
      } catch (err) {
        if (err instanceof ApiError) {
          setLoadError(err.detail || "Failed to load service requests.");
        } else {
          setLoadError("Failed to load service requests.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canAccessChat, restaurantId]
  );

  const filteredBillRequests = useMemo(() => {
    const list = Array.from(billRequests.values());
    if (sourceFilter === "all") return list;
    return list.filter((r) => r.order_source === sourceFilter);
  }, [billRequests, sourceFilter]);

  const filteredServiceRequests = useMemo(() => {
    const list = Array.from(serviceRequests.values());
    if (sourceFilter === "all") return list;
    return list.filter((r) => r.order_source === sourceFilter);
  }, [serviceRequests, sourceFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!canAccessChat) return;
    const interval = setInterval(() => {
      void loadData(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [canAccessChat, loadData]);

    (event: BillRequestedEvent) => {
      const { table_number, customer_name, session_id, requested_at, order_source } = event.data;
      const sourceLabel = order_source === "room" ? `Room ${table_number}` : `Table ${table_number}`;
      showAlert(
        `${sourceLabel} (${customer_name || "Guest"}) is requesting the bill!`,
        true
      );
      
      setBillRequests((prev) => {
        const next = new Map(prev);
        next.set(session_id, {
          session_id,
          table_number,
          customer_name,
          order_source,
          requested_at,
        });
        return next;
      });
    },
    [showAlert]
  );

    (event: ServiceRequestedEvent) => {
      const { request_id, table_number, customer_name, session_id, service_type, message, requested_at, order_source } = event.data;
      const config = SERVICE_CONFIG[service_type];
      const sourceLabel = order_source === "room" ? `Room ${table_number}` : `Table ${table_number}`;
      showAlert(
        `${sourceLabel} (${customer_name || "Guest"}) is requesting ${config?.label || service_type}!`,
        true
      );
      
      setServiceRequests((prev) => {
        const next = new Map(prev);
        const key = String(request_id || `${session_id}:${service_type}`);
        next.set(key, {
          id: request_id || 0,
          session_id,
          table_number,
          customer_name,
          service_type,
          message,
          order_source,
          requested_at,
        });
        return next;
      });
    },
    [showAlert]
  );
  
  const handleServiceAcknowledged = useCallback(
    (event: ServiceAcknowledgedEvent) => {
      const { request_id } = event.data;
      setServiceRequests((prev) => {
        const next = new Map(prev);
        next.delete(String(request_id));
        return next;
      });
    },
    []
  );

  const handleBillAcknowledged = useCallback(
    (event: BillAcknowledgedEvent) => {
      const { session_id } = event.data;
      setBillRequests((prev) => {
        const next = new Map(prev);
        next.delete(session_id);
        return next;
      });
    },
    []
  );

  const { isConnected, connectionError } = useKitchenSocket({
    restaurantId,
    onBillRequested: handleBillRequested,
    onServiceRequested: handleServiceRequested,
    onServiceAcknowledged: handleServiceAcknowledged,
    onBillAcknowledged: handleBillAcknowledged,
  });

  const handleAcknowledgeRequest = useCallback(
    async (req: any) => {
      const isBill = req.type === 'BILL' || !('service_type' in req);
      const requestId = isBill ? req.session_id : req.id;

      if (!requestId) return;

      setActionLoadingId(requestId); 
      setActionError(null);

      try {
        const endpoint = isBill 
          ? `/table-sessions/bill-requests/${requestId}/acknowledge`
          : `/table-sessions/service-requests/${requestId}/acknowledge`;

        await api.patch(endpoint, {});

        if (isBill) {
          setBillRequests((prev) => {
            const next = new Map(prev);
            next.delete(req.session_id);
            return next;
          });
        } else {
          setServiceRequests((prev) => {
            const next = new Map(prev);
            next.delete(String(requestId));
            return next;
          });
        }

        showAlert(`Acknowledged ${isBill ? 'bill' : 'service'} request for Table ${req.table_number}`);
      } catch (err) {
        if (err instanceof ApiError) {
          setActionError(err.detail || "Failed to acknowledge request.");
        } else {
          setActionError("Failed to acknowledge request.");
        }
      } finally {
        setActionLoadingId(null);
      }
    },
    [showAlert]
  );

  const sortedRequests = useMemo(() => {
    const list = [
      ...Array.from(billRequests.values()).map(r => ({ ...r, type: 'BILL' as const, message: null })),
      ...Array.from(serviceRequests.values()).map(r => ({ ...r, type: r.service_type }))
    ];
    
    const filtered = sourceFilter === "all" 
      ? list 
      : list.filter(r => r.order_source === sourceFilter);

    return filtered.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
  }, [billRequests, serviceRequests, sourceFilter]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-slate-900 text-white shadow-xl shadow-slate-200">
              <Bell className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Service Requests</h1>
              <div className="mt-1 flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {isConnected ? "Real-time stream active" : "Reconnecting..."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex p-1.5 gap-1.5 bg-slate-100 rounded-3xl w-fit">
              {(["all", "table", "room"] as const).map((source) => (
                <button
                  key={source}
                  onClick={() => setSourceFilter(source)}
                  className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                    sourceFilter === source
                      ? "bg-white text-slate-900 shadow-lg scale-[1.03]"
                      : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  {source === "all" ? "All" : `${source}s`}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={loading || refreshing}
              className="group flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-100 bg-white text-slate-900 transition-all hover:border-slate-900 active:scale-95 disabled:opacity-50"
              title="Refresh requests"
            >
              <RotateCcw className={`h-5 w-5 ${refreshing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
            </button>
          </div>
        </div>
      </div>

      {alert && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800 animate-in fade-in slide-in-from-top-2">
          {alert}
        </div>
      )}

      {connectionError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {connectionError}
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{loadError}</div>
      )}

      {actionError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-20 text-center text-sm text-slate-500">
            Loading requests...
          </div>
        ) : sortedRequests.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="h-20 w-20 rounded-full bg-rose-50 flex items-center justify-center mb-6">
              <span className="text-4xl opacity-50">🔔</span>
            </div>
            <p className="text-lg font-black text-slate-900 tracking-tight">No active requests</p>
            <p className="text-sm text-slate-400 mt-1 font-medium">Guest service and bill requests will appear here</p>
          </div>
        ) : (
          sortedRequests.map((req) => {
            const config = SERVICE_CONFIG[req.type] || { label: req.type, icon: Bell, color: "bg-slate-500", textColor: "text-slate-500" };
            const Icon = config.icon;
            const requestId = req.type === 'BILL' ? req.session_id : (req as any).id;
            
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
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                          {config.label}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-white/40" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-100">
                          {req.order_source === "room" ? "ROOM" : "TABLE"}
                        </span>
                      </div>
                      <p className="text-xl font-black leading-tight">
                        {req.order_source === "room" ? "Room" : "Table"} {req.table_number}
                      </p>
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
                    disabled={actionLoadingId === requestId}
                    onClick={() => void handleAcknowledgeRequest(req)}
                    className={`w-full group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 text-sm font-black transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg ${
                      req.type === 'BILL' 
                        ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-200' 
                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'
                    }`}
                  >
                    {actionLoadingId === requestId ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Check className="h-4 w-4 transition-transform group-hover:scale-110" />
                    )}
                    <span>Acknowledge Request</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
