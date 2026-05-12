import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { 
  Ticket, 
  Search, 
  History, 
  CreditCard, 
  Printer, 
  Wallet, 
  FileText, 
  CheckCircle2, 
  User,
  Coffee,
  Loader2,
  Plus,
  ArrowLeftRight,
  QrCode
} from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import ManualItemAddDrawer from "@/components/admin/ManualItemAddDrawer";
import { getUser, normalizeRole } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type {
  BillContextType,
  BillHandoffStatus,
  BillListResponse,
  BillOrder,
  BillPaymentMethod,
  BillRecord,
  BillSummaryResponse,
  SettleSessionResponse,
} from "@/types/billing";

const METHODS: Array<{ value: BillPaymentMethod; label: string; icon: any }> = [
  { value: "cash", label: "Cash", icon: Wallet },
  { value: "card", label: "Card / POS", icon: CreditCard },
  { value: "manual", label: "Manual", icon: FileText },
];

const TABS = [
  { id: "table", label: "Table Billing", icon: Coffee },
  { id: "room", label: "Room Folio", icon: User },
  { id: "folios", label: "Folio Queue", icon: History },
] as const;

const FILTERS: Array<{ value: "all" | BillHandoffStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "none", label: "Fresh" },
  { value: "sent_to_cashier", label: "Cashier" },
  { value: "sent_to_accountant", label: "Accountant" },
  { value: "completed", label: "Completed" },
];

type Tab = (typeof TABS)[number]["id"];
type Mode = Extract<Tab, "table" | "room">;
type ReceiptState = { summary: BillSummaryResponse; receipt: SettleSessionResponse };

const cur = (value: number) => `${value.toFixed(2)}`;
const dt = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : "Pending";

const contextLabel = (type: BillContextType, table: string | null, room: string | null) =>
  type === "room" ? `Room ${room ?? "-"}` : `Table ${table ?? "-"}`;

const handoffClass = (status: BillHandoffStatus) =>
  ({
    none: "bg-slate-100 text-slate-500",
    sent_to_cashier: "bg-amber-100 text-amber-700",
    sent_to_accountant: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
  })[status];

const handoffLabel = (status: BillHandoffStatus) =>
  ({
    none: "Fresh",
    sent_to_cashier: "With Cashier",
    sent_to_accountant: "With Accountant",
    completed: "Completed",
  })[status];

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function summaryPath(mode: Mode, lookup: string): string {
  const base = mode === "room" ? "/billing/room" : "/billing/session";
  return `${base}/${encodeURIComponent(lookup)}/summary`;
}

function settlePath(mode: Mode, lookup: string): string {
  const base = mode === "room" ? "/billing/room" : "/billing/session";
  return `${base}/${encodeURIComponent(lookup)}/settle`;
}

function printInvoice(summary: BillSummaryResponse, receipt?: SettleSessionResponse) {
  const billNo = summary.bill?.bill_number ?? receipt?.bill_number ?? "Pending";
  const payment = summary.bill?.payment_method ?? receipt?.payment_method ?? "manual";
  const settledAt = summary.bill?.settled_at ?? receipt?.settled_at ?? "";
  const rows = summary.orders
    .flatMap((order) =>
      order.items.map(
        (item) =>
          `<tr><td>${order.order_number}</td><td>${item.item_name_snapshot}</td><td>${item.quantity}</td><td>${cur(item.unit_price_snapshot)}</td><td>${cur(item.line_total)}</td></tr>`,
      ),
    )
    .join("");
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) throw new Error("Please allow popups to print the invoice.");
  win.document.write(`
    <html><head><title>${billNo}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}
      .box{max-width:840px;margin:0 auto}
      .top{display:flex;justify-content:space-between;gap:12px;margin-bottom:18px}
      .totals{max-width:280px;margin:18px 0 0 auto}
      .totals div{display:flex;justify-content:space-between;padding:6px 0}
      .grand{border-top:2px solid #cbd5e1;font-weight:700;font-size:18px}
      @media print{button{display:none} body{padding:0}}
    </style></head><body>
    <div class="box">
      <button onclick="window.print()">Print Invoice</button>
      <div class="top">
        <div><div style="font-size:12px;color:#0f766e;font-weight:700;letter-spacing:.14em;text-transform:uppercase">HotelMS</div><h1 style="margin:8px 0 0">Service Invoice</h1></div>
        <div style="text-align:right"><div style="font-size:12px;color:#64748b">Bill Number</div><div style="font-size:22px;font-weight:800">${billNo}</div></div>
      </div>
      <p><strong>Context:</strong> ${contextLabel(summary.context_type, summary.table_number, summary.room_number)}<br />
      <strong>Session:</strong> ${summary.session_id}<br />
      <strong>Payment:</strong> ${payment}<br />
      <strong>Settled:</strong> ${settledAt ? dt(settledAt) : "Pending"}</p>
      <table><thead><tr><th>Order</th><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${rows || "<tr><td colspan='5'>No items</td></tr>"}</tbody></table>
      <div class="totals">
        <div><span>Subtotal</span><span>${cur(summary.subtotal)}</span></div>
        <div><span>Tax</span><span>${cur(summary.tax_amount)}</span></div>
        <div><span>Discount</span><span>${cur(summary.discount_amount)}</span></div>
        <div class="grand"><span>Grand Total</span><span>${cur(summary.grand_total)}</span></div>
      </div>
    </div></body></html>`);
  win.document.close();
  win.focus();
}

function Alert({ tone, children }: { tone: "error" | "info" | "warning"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-blue-200 bg-blue-50 text-blue-800";
  return <div className={`rounded-2xl border p-4 text-sm font-medium ${cls}`}>{children}</div>;
}

function OrderCard({ order, onReject, isSettled }: { order: BillOrder, onReject?: () => void, isSettled: boolean }) {
  return (
    <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">
             #{order.order_number}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Order Reference</p>
            <p className="text-xs font-bold text-slate-500">{new Date(order.placed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
           {!isSettled && onReject && (
              <button 
                onClick={onReject}
                className="h-8 px-4 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-200 shrink-0"
                title="Reject this order due to dispute"
              >
                Void Order
              </button>
           )}
           <div className="text-right shrink-0">
              <p className="text-lg font-black text-slate-900 tabular-nums">{cur(order.total_amount)}</p>
           </div>
        </div>
      </div>
      <div className="space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-2xl border border-white">
            <div className="flex items-center gap-3">
              <span className="h-8 w-8 bg-white border border-slate-100 text-slate-500 rounded-lg flex items-center justify-center text-xs font-black shrink-0">{item.quantity}×</span>
              <p className="text-base font-bold text-slate-700 capitalize break-words">{item.item_name_snapshot}</p>
            </div>
            <span className="text-base font-black text-slate-900 tabular-nums text-right shrink-0">{cur(item.line_total)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function FolioCard({
  bill,
  role,
  busy,
  onOpen,
  onPrint,
  onAction,
}: {
  bill: BillRecord;
  role: string;
  busy: boolean;
  onOpen: () => void;
  onPrint: () => void;
  onAction: (action: "cashier" | "accountant" | "complete") => void;
}) {
  const canCashier = ["owner", "admin", "steward"].includes(role) && bill.handoff_status === "none";
  const canAccountant = ["owner", "admin", "cashier"].includes(role) && bill.handoff_status === "sent_to_cashier";
  const canComplete = ["owner", "admin", "accountant"].includes(role) && bill.handoff_status === "sent_to_accountant";
  
  return (
    <article className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm hover:shadow-lg transition-all group">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xl shadow-slate-200">
             <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {contextLabel(bill.context_type, bill.table_number, bill.room_number)}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${handoffClass(bill.handoff_status)}`}>
                {handoffLabel(bill.handoff_status)}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{bill.bill_number}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Folio Amount</p>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{cur(bill.total_amount)}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-slate-50 rounded-2xl">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Payment Method</p>
          <p className="text-xs font-bold text-slate-700 capitalize">{bill.payment_method ?? "manual"}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-2xl">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Settled At</p>
          <p className="text-xs font-bold text-slate-700">{dt(bill.settled_at)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={onOpen} className="flex-1 min-w-[100px] py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95">Open</button>
        <button onClick={onPrint} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all">
          <Printer className="h-4 w-4" />
        </button>
        {canCashier && (
          <button disabled={busy} onClick={() => onAction("cashier")} className="px-6 py-3 bg-amber-100 text-amber-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-200 transition-all disabled:opacity-50">
            To Cashier
          </button>
        )}
        {canAccountant && (
          <button disabled={busy} onClick={() => onAction("accountant")} className="px-6 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all disabled:opacity-50">
            To Accountant
          </button>
        )}
        {canComplete && (
          <button disabled={busy} onClick={() => onAction("complete")} className="px-6 py-3 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-200 transition-all disabled:opacity-50">
            Complete
          </button>
        )}
      </div>
    </article>
  );
}

export default function Billing() {
  const role = normalizeRole(getUser()?.role);
  const [tab, setTab] = useState<Tab>("table");
  const [tableLookup, setTableLookup] = useState("");
  const [roomLookup, setRoomLookup] = useState("");
  const [recentLookups, setRecentLookups] = useState<{mode: string, raw: string, label: string}[]>([]);
  const [summary, setSummary] = useState<BillSummaryResponse | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [method, setMethod] = useState<BillPaymentMethod>("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");
  const [isPresenting, setIsPresenting] = useState(false);
  const [presentSuccess, setPresentSuccess] = useState(false);
  const [filter, setFilter] = useState<"all" | BillHandoffStatus>("all");
  const [folios, setFolios] = useState<BillRecord[]>([]);
  const [folioLoading, setFolioLoading] = useState(false);
  const [folioError, setFolioError] = useState<string | null>(null);
  const [folioActionError, setFolioActionError] = useState<string | null>(null);
  const [folioActionId, setFolioActionId] = useState<number | null>(null);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);

  const mode: Mode = tab === "room" ? "room" : "table";
  const lookup = mode === "room" ? roomLookup : tableLookup;
  const canSettle = useMemo(() => Boolean(summary && !summary.is_settled && summary.order_count > 0), [summary]);

  const resetState = useCallback(() => {
    setSummary(null);
    setReceipt(null);
    setFetchError(null);
    setSettleError(null);
    setMethod("cash");
    setTransactionRef("");
    setNotes("");
  }, []);

  const loadSummary = useCallback(async (nextMode: Mode, raw: string) => {
    const candidate = raw.trim();
    if (!candidate) return;
    setFetching(true);
    setFetchError(null);
    setSettleError(null);
    setReceipt(null);
    try {
      setSummary(await api.get<BillSummaryResponse>(summaryPath(nextMode, candidate)));
      // Save to recent lookups
      setRecentLookups(prev => {
        const newEntry = { mode: nextMode, raw: candidate, label: nextMode === "room" ? `R-${candidate}` : `T-${candidate}` };
        const filtered = prev.filter(item => !(item.mode === nextMode && item.raw === candidate));
        const updated = [newEntry, ...filtered].slice(0, 5);
        localStorage.setItem("hotelms_recent_lookups", JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      setSummary(null);
      setFetchError(errorText(error, `Failed to load ${nextMode} summary.`));
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("hotelms_recent_lookups");
      if (stored) setRecentLookups(JSON.parse(stored));
    } catch (e) {}
  }, []);

  const loadFolios = useCallback(async () => {
    setFolioLoading(true);
    setFolioError(null);
    try {
      const params = new URLSearchParams({ context_type: "room", limit: "100" });
      if (filter !== "all") params.set("handoff_status", filter);
      const data = await api.get<BillListResponse>(`/billing/folios?${params.toString()}`);
      setFolios(data.items);
    } catch (error) {
      setFolios([]);
      setFolioError(errorText(error, "Failed to load folio queue."));
    } finally {
      setFolioLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (tab === "folios") void loadFolios();
  }, [loadFolios, tab]);

  const onLookup = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    await loadSummary(mode, lookup);
  }, [loadSummary, lookup, mode]);

  const onSettle = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!summary) return;
    setSettling(true);
    setSettleError(null);
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const payload = {
        payment_method: method,
        ...(transactionRef.trim() ? { transaction_reference: transactionRef.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      const done = await api.post<SettleSessionResponse>(
        settlePath(mode, summary.session_id),
        payload,
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      let refreshed = summary;
      try {
        refreshed = await api.get<BillSummaryResponse>(summaryPath(mode, summary.session_id));
      } catch {
        refreshed = summary;
      }
      setReceipt({ summary: refreshed, receipt: done });
      setSummary(null);
      if (mode === "room") void loadFolios();
    } catch (error) {
      setSettleError(errorText(error, "Settlement failed. Please try again."));
    } finally {
      setSettling(false);
    }
  }, [loadFolios, method, mode, notes, summary, transactionRef]);

  const onRejectOrder = useCallback(async (orderId: number) => {
    if (!summary || !window.confirm("Are you sure you want to REJECT and VOID this order from the bill? This cannot be undone.")) return;
    try {
      await api.patch(`/orders/${orderId}/status`, { status: "rejected" });
      // Refresh summary
      await loadSummary(mode, summary.session_id);
    } catch (error) {
      setSettleError(errorText(error, "Failed to reject order."));
    }
  }, [loadSummary, mode, summary]);

  const onChangeTable = useCallback(async () => {
    if (!summary || mode !== "table") return;
    const newTable = window.prompt("Enter the new Table Number:", summary.table_number || "");
    if (!newTable || newTable === summary.table_number) return;
    
    try {
      await api.patch(`/table-sessions/${summary.session_id}/change-table`, { new_table_number: newTable });
      // Refresh summary
      await loadSummary(mode, summary.session_id);
    } catch (error) {
      setSettleError(errorText(error, "Failed to move table."));
    }
  }, [loadSummary, mode, summary]);

  const onPresentBill = useCallback(async () => {
    if (!summary || mode !== "table") return;
    setIsPresenting(true);
    setPresentSuccess(false);
    try {
      await api.patch(`/table-sessions/bill-requests/${summary.session_id}/present`, {});
      setPresentSuccess(true);
      // Small timeout to reset the success state
      setTimeout(() => setPresentSuccess(false), 3000);
    } catch (err) {
      setSettleError("Failed to present bill to guest.");
    } finally {
      setIsPresenting(false);
    }
  }, [mode, summary]);

  const onFolioAction = useCallback(async (billId: number, action: "cashier" | "accountant" | "complete") => {
    const path =
      action === "cashier"
        ? `/billing/folios/${billId}/send-to-cashier`
        : action === "accountant"
          ? `/billing/folios/${billId}/send-to-accountant`
          : `/billing/folios/${billId}/complete`;
    setFolioActionId(billId);
    setFolioActionError(null);
    try {
      await api.post(path, {});
      await loadFolios();
    } catch (error) {
      setFolioActionError(errorText(error, "Folio handoff update failed."));
    } finally {
      setFolioActionId(null);
    }
  }, [loadFolios]);

  return (
    <DashboardLayout>
      <div className="space-y-4 pb-20">
        {/* Workspace Header */}
        <div className="rounded-[3rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Ticket className="h-64 w-64" />
          </div>
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-1 w-12 bg-emerald-500 rounded-full" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Financial Hub</p>
              </div>
              <h1 className="text-4xl lg:text-5xl font-black tracking-tight mb-4">Billing Workspace</h1>
              <p className="text-slate-400 font-medium leading-relaxed">
                Streamline guest checkouts, handle room folios, and manage financial handoffs between staff roles.
              </p>
            </div>
            <div className="flex bg-white/5 backdrop-blur-md p-1.5 rounded-[2rem] border border-white/10 min-w-[320px]">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setTab(item.id);
                    if (item.id === "folios") resetState();
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                    tab === item.id ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {tab !== "folios" && (
          <div className="flex flex-col xl:flex-row gap-8 items-start">
            {/* Lookup Section */}
            <div className={`w-full xl:w-[320px] shrink-0 space-y-6 ${(summary || receipt) ? 'hidden xl:block' : 'block'}`}>
              <form onSubmit={onLookup} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                <div className="mb-6">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Lookup Session</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Enter {mode} number</p>
                </div>
                <div className="relative group mb-4">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                   <input
                    type="text"
                    value={lookup}
                    autoFocus
                    onChange={(e) => mode === "room" ? setRoomLookup(e.target.value) : setTableLookup(e.target.value)}
                    placeholder={mode === "room" ? "e.g. 101 or Room Session ID" : "e.g. 4 or Table Session ID"}
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 outline-none ring-2 ring-transparent focus:ring-slate-200 focus:bg-white transition-all"
                  />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors" title="Scan QR Code">
                    <QrCode className="h-4 w-4" />
                  </button>
                </div>                <button 
                  disabled={fetching || !lookup.trim()}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:bg-slate-800 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {fetching ? "Syncing..." : (lookup.trim() ? "Load Summary" : "Enter a number to continue")}
                </button>
                
                {recentLookups.filter(r => r.mode === mode).length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Recent Sessions</p>
                     <div className="flex flex-wrap gap-2">
                        {recentLookups.filter(r => r.mode === mode).map((recent, idx) => (
                           <button 
                             key={idx}
                             type="button" 
                             onClick={() => {
                               if (mode === "room") setRoomLookup(recent.raw);
                               else setTableLookup(recent.raw);
                               void loadSummary(mode as Mode, recent.raw);
                             }} 
                             className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition-colors border border-slate-100 shadow-sm"
                           >
                             {recent.label}
                           </button>
                        ))}
                     </div>
                  </div>
                )}
              </form>

              {fetchError && <Alert tone="error">{fetchError}</Alert>}

              {receipt && (
                <div className="bg-emerald-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-emerald-200 animate-in zoom-in-95 duration-500">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
                       <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                       <h3 className="text-xl font-black tracking-tight leading-none">Settled Successfully</h3>
                       <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mt-1">Transaction Ref: {receipt.receipt.bill_number}</p>
                    </div>
                  </div>
                  <div className="space-y-4 mb-8">
                     <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-emerald-100 text-xs font-bold">Orders</span><span className="font-black tabular-nums">{receipt.receipt.order_count}</span></div>
                     <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-emerald-100 text-xs font-bold">Total Settled</span><span className="font-black tabular-nums">{cur(receipt.receipt.total_amount)}</span></div>
                  </div>
                  <div className="space-y-3">
                    <button 
                      onClick={() => void api.post(`/billing/folios/${receipt.receipt.bill_id}/print`, {}).catch(() => null).then(() => printInvoice(receipt.summary, receipt.receipt))}
                      className="w-full py-4 bg-white text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-800/20 hover:bg-emerald-50 transition-all"
                    >
                      Print Receipt
                    </button>
                    <button onClick={resetState} className="w-full py-4 bg-white/10 text-white border border-white/20 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all">
                      New Lookup
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Details Section */}
            <div className={`flex-1 space-y-8 w-full min-w-0 ${(!summary && !receipt) ? 'hidden xl:block' : 'block'}`}>
              {summary && !receipt && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_360px] gap-8 animate-in slide-in-from-right-8 duration-700">
                  <div className="space-y-6 min-w-0">
                     <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                           <div className="flex items-center gap-5">
                              <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                 {mode === 'room' ? <User className="h-6 w-6" /> : <Coffee className="h-6 w-6" />}
                              </div>
                              <div className="min-w-0">
                                 <h3 className="text-2xl font-black text-slate-900 tracking-tight">{contextLabel(summary.context_type, summary.table_number, summary.room_number)}</h3>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">{summary.session_id}</p>
                              </div>
                           </div>
                           <span className={`self-start sm:self-auto px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0 border ${summary.is_settled ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                              {summary.is_settled ? 'Settled' : 'Unpaid Session'}
                           </span>
                        </div>
                        
                        {!summary.is_settled && (
                           <div className="flex flex-wrap items-center gap-3">
                              {mode === 'table' && (
                                 <button 
                                   onClick={onChangeTable}
                                   className="h-11 px-5 bg-white border-2 border-slate-200 text-slate-700 shadow-sm rounded-xl text-xs font-bold hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all flex items-center gap-2.5"
                                 >
                                   <ArrowLeftRight className="h-4 w-4" />
                                   Move Table
                                 </button>
                              )}
                              <button 
                                onClick={() => setIsAddDrawerOpen(true)}
                                className="h-11 px-5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg shadow-slate-900/20 border-2 border-slate-900 hover:bg-slate-800 transition-all flex items-center gap-2.5"
                              >
                                <Plus className="h-4 w-4" />
                                Add Item
                              </button>
                           </div>
                        )}
                     </div>

                     <div className="space-y-4">
                        {summary.orders.map((order) => (
                          <OrderCard 
                            key={order.id} 
                            order={order} 
                            isSettled={summary.is_settled}
                            onReject={() => onRejectOrder(order.id)}
                          />
                        ))}
                        {summary.orders.length === 0 && (
                          <div className="py-16 px-6 sm:p-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 text-center">
                             <Coffee className="h-12 w-12 text-slate-100 mx-auto mb-4" />
                             <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No orders found for this session</p>
                          </div>
                        )}
                     </div>
                  </div>

                  {/* Payment Panel */}
                  <div className="space-y-6 sticky top-8">
                     <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                        <div className="space-y-4 mb-8">
                           <div className="flex justify-between text-slate-400 text-xs font-bold"><span>Subtotal</span><span className="tabular-nums">{cur(summary.subtotal)}</span></div>
                           <div className="flex justify-between text-slate-400 text-xs font-bold"><span>Tax & Service</span><span className="tabular-nums">{cur(summary.tax_amount)}</span></div>
                           <div className="flex justify-between text-rose-400 text-xs font-bold"><span>Discount</span><span className="tabular-nums">-{cur(summary.discount_amount)}</span></div>
                           <div className="h-px bg-slate-800 my-2" />
                           <div className="flex justify-between items-center pt-2">
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Due</p>
                                 <p className="text-4xl lg:text-5xl font-black tabular-nums text-emerald-400">{cur(summary.grand_total)}</p>
                              </div>
                              {mode === "table" && (
                                <div className="text-right">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Guest Status</p>
                                  {summary.session_status === "BILL_CONFIRMED" ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Confirmed
                                    </span>
                                  ) : summary.session_status === "BILL_PRESENTED" ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Waiting...
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-500 text-[9px] font-black uppercase tracking-widest">
                                      Not Sent
                                    </span>
                                  )}
                                </div>
                              )}
                           </div>
                        </div>

                        {canSettle ? (
                          <form onSubmit={onSettle} className="space-y-6">
                            <div className="space-y-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 px-1">Payment Method</p>
                              <div className="grid grid-cols-1 gap-2">
                                {METHODS.map((m) => (
                                  <button
                                    key={m.value}
                                    type="button"
                                    onClick={() => setMethod(m.value)}
                                    className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${
                                      method === m.value ? 'bg-white border-white text-slate-900 shadow-xl' : 'bg-slate-800 border-slate-700 text-slate-400'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                       <m.icon className="h-4 w-4" />
                                       <span className="text-sm font-bold">{m.label}</span>
                                    </div>
                                    {method === m.value && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <textarea
                              rows={2}
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Notes / Internal remarks..."
                              className="w-full px-5 py-4 bg-slate-800 border-none rounded-2xl text-sm font-medium text-white placeholder-slate-600 outline-none focus:bg-slate-700 transition-all"
                            />

                            {settleError && <Alert tone="error">{settleError}</Alert>}

                            {mode === "table" && (
                              <button
                                type="button"
                                onClick={onPresentBill}
                                disabled={isPresenting || settling}
                                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${
                                  presentSuccess 
                                    ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                                    : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                                }`}
                              >
                                {isPresenting ? "Presenting..." : presentSuccess ? "Bill Sent to Guest" : "Present Bill to Guest"}
                              </button>
                            )}

                            <button
                              disabled={settling}
                              className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/40 hover:bg-emerald-400 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                              {settling ? "Processing..." : `Settle Payment`}
                            </button>
                          </form>
                        ) : (
                          <div className="space-y-3">
                             {summary.is_settled && summary.bill && (
                                <button 
                                  onClick={() => void api.post(`/billing/folios/${summary.bill!.id}/print`, {}).catch(() => null).then(() => printInvoice(summary))}
                                  className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-50 transition-all"
                                >
                                  Reprint Invoice
                                </button>
                             )}
                             <button onClick={resetState} className="w-full py-4 bg-white/10 text-white border border-white/20 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all">
                                New Lookup
                             </button>
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              )}

              <ManualItemAddDrawer 
                isOpen={isAddDrawerOpen}
                onClose={() => setIsAddDrawerOpen(false)}
                sessionId={summary?.session_id ?? ""}
                onSuccess={() => {
                  if (summary) void loadSummary(mode, summary.session_id);
                }}
              />

              {!summary && !receipt && (
                 <div className="py-40 flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-100 shadow-sm opacity-60">
                    <div className="h-24 w-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-8">
                       <Ticket className="h-10 w-10 text-slate-200" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 tracking-tight text-center px-6">Search for a table or room to begin billing</p>
                    <p className="text-sm text-slate-400 mt-2 font-medium text-center">Use the lookup panel to load a session or scan a QR code</p>
                 </div>
              )}
            </div>
          </div>
        )}

        {tab === "folios" && (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Folio Filters */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex p-1 bg-slate-50 rounded-2xl">
                 {FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFilter(f.value)}
                      className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        filter === f.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {f.label}
                    </button>
                 ))}
              </div>
              <button 
                onClick={() => void loadFolios()}
                disabled={folioLoading}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
              >
                {folioLoading ? "Syncing..." : "Refresh Queue"}
              </button>
            </div>

            {folioError && <Alert tone="error">{folioError}</Alert>}
            {folioActionError && <Alert tone="error">{folioActionError}</Alert>}

            {folios.length === 0 && !folioLoading ? (
              <div className="py-40 flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                <div className="h-24 w-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8">
                   <History className="h-10 w-10 text-slate-200" />
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tight">Folio queue is empty</p>
                <p className="text-sm text-slate-400 mt-2 font-medium px-6 text-center">Settled room invoices will appear here for processing</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {folios.map((bill) => (
                  <FolioCard
                    key={bill.id}
                    bill={bill}
                    role={role}
                    busy={folioActionId === bill.id}
                    onOpen={() => {
                      setTab("room");
                      setRoomLookup(bill.session_id);
                      void loadSummary("room", bill.session_id);
                    }}
                    onPrint={() =>
                      void api
                        .post(`/billing/folios/${bill.id}/print`, {})
                        .catch(() => null)
                        .then(() => api.get<BillSummaryResponse>(summaryPath("room", bill.session_id)))
                        .then((data) => printInvoice(data))
                        .catch((error) =>
                          setFolioActionError(errorText(error, "Failed to load folio for printing."))
                        )
                    }
                    onAction={(action) => void onFolioAction(bill.id, action)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
