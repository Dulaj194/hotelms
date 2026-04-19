import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
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

const METHODS: Array<{ value: BillPaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card / POS" },
  { value: "manual", label: "Manual" },
];
const TABS = [
  { id: "table", label: "Table Billing" },
  { id: "room", label: "Room Folio" },
  { id: "folios", label: "Folio Queue" },
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

const cur = (value: number) => `$${value.toFixed(2)}`;
const dt = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "Pending";
const contextLabel = (type: BillContextType, table: string | null, room: string | null) =>
  type === "room" ? `Room ${room ?? "-"}` : `Table ${table ?? "-"}`;
const handoffLabel = (status: BillHandoffStatus) =>
  ({
    none: "Fresh",
    sent_to_cashier: "With Cashier",
    sent_to_accountant: "With Accountant",
    completed: "Completed",
  })[status];
const handoffClass = (status: BillHandoffStatus) =>
  ({
    none: "bg-slate-100 text-slate-700",
    sent_to_cashier: "bg-amber-100 text-amber-800",
    sent_to_accountant: "bg-sky-100 text-sky-800",
    completed: "bg-emerald-100 text-emerald-800",
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
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-sky-200 bg-sky-50 text-sky-800";
  return <div className={`rounded-2xl border p-3 text-sm ${cls}`}>{children}</div>;
}

function OrderCard({ order }: { order: BillOrder }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">#{order.order_number}</p>
          <p className="text-xs text-slate-500">
            {new Date(order.placed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
          {cur(order.total_amount)}
        </span>
      </div>
      <div className="space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <div>
              <p className="font-medium text-slate-800">{item.item_name_snapshot}</p>
              <p className="text-xs text-slate-500">
                {item.quantity} x {cur(item.unit_price_snapshot)}
              </p>
            </div>
            <span className="font-semibold text-slate-900">{cur(item.line_total)}</span>
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
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{bill.bill_number}</p>
          <h3 className="text-xl font-bold text-slate-900">
            {contextLabel(bill.context_type, bill.table_number, bill.room_number)}
          </h3>
          <p className="font-mono text-xs text-slate-400">{bill.session_id}</p>
        </div>
        <div className="text-right">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${handoffClass(bill.handoff_status)}`}>
            {handoffLabel(bill.handoff_status)}
          </span>
          <p className="mt-2 text-lg font-bold text-slate-900">{cur(bill.total_amount)}</p>
        </div>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p><span className="text-slate-500">Payment:</span> {bill.payment_method ?? "manual"}</p>
        <p><span className="text-slate-500">Settled:</span> {dt(bill.settled_at)}</p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={onOpen} className="app-btn-compact rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">Open</button>
        <button type="button" onClick={onPrint} className="app-btn-compact rounded-xl bg-slate-900 text-white hover:bg-slate-800">Print</button>
        {canCashier && <button type="button" disabled={busy} onClick={() => onAction("cashier")} className="app-btn-compact rounded-xl bg-amber-500 text-white hover:bg-amber-600">Send to Cashier</button>}
        {canAccountant && <button type="button" disabled={busy} onClick={() => onAction("accountant")} className="app-btn-compact rounded-xl bg-sky-600 text-white hover:bg-sky-700">Send to Accountant</button>}
        {canComplete && <button type="button" disabled={busy} onClick={() => onAction("complete")} className="app-btn-compact rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">Complete</button>}
      </div>
    </article>
  );
}

export default function Billing() {
  const role = normalizeRole(getUser()?.role);
  const [tab, setTab] = useState<Tab>("table");
  const [tableLookup, setTableLookup] = useState("");
  const [roomLookup, setRoomLookup] = useState("");
  const [summary, setSummary] = useState<BillSummaryResponse | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [method, setMethod] = useState<BillPaymentMethod>("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<"all" | BillHandoffStatus>("all");
  const [folios, setFolios] = useState<BillRecord[]>([]);
  const [folioLoading, setFolioLoading] = useState(false);
  const [folioError, setFolioError] = useState<string | null>(null);
  const [folioActionError, setFolioActionError] = useState<string | null>(null);
  const [folioActionId, setFolioActionId] = useState<number | null>(null);

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
    } catch (error) {
      setSummary(null);
      setFetchError(errorText(error, `Failed to load ${nextMode} summary.`));
    } finally {
      setFetching(false);
    }
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
      const payload = {
        payment_method: method,
        ...(transactionRef.trim() ? { transaction_reference: transactionRef.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      const done = await api.post<SettleSessionResponse>(settlePath(mode, summary.session_id), payload);
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
      <div className="app-page-stack mx-auto max-w-7xl">
        <div className="rounded-[28px] bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-800 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Billing Workspace</p>
              <h1 className="app-page-title">Table and Room Billing Settlement</h1>
              <p className="app-body-text text-slate-300">
                Handle table number billing, room number folios, invoice printing, and cashier to accountant handoff in one responsive view.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {["owner", "admin", "cashier"].includes(role) && (
                  <Link
                    to="/admin/billing/cashier"
                    className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Cashier Dashboard
                  </Link>
                )}
                {["owner", "admin", "accountant"].includes(role) && (
                  <Link
                    to="/admin/billing/accountant"
                    className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Accountant Dashboard
                  </Link>
                )}
              </div>
            </div>
            <div className="w-full overflow-x-auto pb-1 lg:w-auto">
              <div className="flex min-w-max gap-2">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      if (item.id === "folios") resetState();
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === item.id ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/15"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {tab !== "folios" && (
          <>
            <form onSubmit={onLookup} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="app-section-title text-slate-900">{mode === "room" ? "Room billing lookup" : "Table billing lookup"}</h2>
                <p className="app-muted-text text-slate-500">
                  Search by room/table number first. You can also paste a full session ID or a short session prefix if needed.
                </p>
              </div>
              <div className="app-form-grid items-end">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {mode === "room" ? "Room Number / Session ID" : "Table Number / Session ID"}
                  </label>
                  <input
                    type="text"
                    value={lookup}
                    onChange={(event) => (mode === "room" ? setRoomLookup(event.target.value) : setTableLookup(event.target.value))}
                    placeholder={mode === "room" ? "e.g. 101 or room session id" : "e.g. 4 or table session id"}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <button type="submit" disabled={fetching || !lookup.trim()} className="app-btn-base w-full rounded-2xl bg-slate-900 text-white hover:bg-slate-800 sm:w-auto">
                  {fetching ? "Loading..." : "Load Summary"}
                </button>
              </div>
            </form>

            {fetchError && <Alert tone="error">{fetchError}</Alert>}

            {receipt && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <h2 className="app-section-title text-emerald-900">Settlement Complete</h2>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <p><span className="text-emerald-800">Bill:</span> {receipt.receipt.bill_number}</p>
                  <p><span className="text-emerald-800">Context:</span> {contextLabel(receipt.receipt.context_type, receipt.receipt.table_number, receipt.receipt.room_number)}</p>
                  <p><span className="text-emerald-800">Orders:</span> {receipt.receipt.order_count}</p>
                  <p><span className="text-emerald-800">Total:</span> {cur(receipt.receipt.total_amount)}</p>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() =>
                      void api
                        .post(`/billing/folios/${receipt.receipt.bill_id}/print`, {})
                        .catch(() => null)
                        .then(() => printInvoice(receipt.summary, receipt.receipt))
                    }
                    className="app-btn-base rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                  >
                    Print Invoice
                  </button>
                  {receipt.receipt.context_type === "room" && <button type="button" onClick={() => setTab("folios")} className="app-btn-base rounded-2xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">Open Folio Queue</button>}
                  <button type="button" onClick={resetState} className="app-btn-base rounded-2xl border border-emerald-300 bg-transparent text-emerald-900 hover:bg-emerald-100">Start Another Lookup</button>
                </div>
              </div>
            )}

            {summary && !receipt && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">{summary.context_type === "room" ? "Room Folio" : "Table Billing"}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${summary.is_settled ? "bg-emerald-100 text-emerald-700" : summary.session_is_active ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-700"}`}>
                        {summary.is_settled ? "Settled" : summary.session_is_active ? "Active" : "Closed"}
                      </span>
                      {summary.bill && summary.context_type === "room" && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${handoffClass(summary.bill.handoff_status)}`}>{handoffLabel(summary.bill.handoff_status)}</span>}
                    </div>
                    <h3 className="mt-3 text-2xl font-bold">{contextLabel(summary.context_type, summary.table_number, summary.room_number)}</h3>
                    <p className="font-mono text-xs text-slate-300">{summary.session_id}</p>
                  </div>

                  {summary.is_settled && <Alert tone="info">This record is already settled. You can reprint the invoice or move to another lookup.</Alert>}
                  {!summary.is_settled && summary.order_count === 0 && <Alert tone="warning">No completed orders are ready for settlement yet.</Alert>}

                  <div className="space-y-4">
                    {summary.orders.map((order) => <OrderCard key={order.id} order={order} />)}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{cur(summary.subtotal)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Tax</span><span>{cur(summary.tax_amount)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>{cur(summary.discount_amount)}</span></div>
                      <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900"><span>Grand Total</span><span>{cur(summary.grand_total)}</span></div>
                    </div>
                  </div>

                  {canSettle ? (
                    <form onSubmit={onSettle} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h2 className="text-lg font-semibold text-slate-900">Settlement</h2>
                      <div className="mt-4 space-y-4">
                        <div className="app-form-grid">
                          {METHODS.map((item) => (
                            <label key={item.value} className={`flex cursor-pointer items-center rounded-2xl border px-4 py-3 text-sm font-medium ${method === item.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                              <input type="radio" className="sr-only" checked={method === item.value} onChange={() => setMethod(item.value)} />
                              {item.label}
                            </label>
                          ))}
                        </div>
                        {(method === "card" || method === "manual") && (
                          <input
                            type="text"
                            value={transactionRef}
                            onChange={(event) => setTransactionRef(event.target.value)}
                            placeholder="Transaction reference"
                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                          />
                        )}
                        <textarea
                          rows={3}
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder="Settlement notes"
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                        />
                        {settleError && <Alert tone="error">{settleError}</Alert>}
                        <div className="app-form-actions">
                          <button type="submit" disabled={settling} className="app-btn-base w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto">{settling ? "Processing..." : `Settle ${cur(summary.grand_total)}`}</button>
                          <button type="button" onClick={resetState} className="app-btn-base w-full rounded-2xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 sm:w-auto">Reset</button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3">
                        {summary.is_settled && summary.bill && (
                          <button
                            type="button"
                            onClick={() =>
                              void api
                                .post(`/billing/folios/${summary.bill!.id}/print`, {})
                                .catch(() => null)
                                .then(() => printInvoice(summary))
                            }
                            className="app-btn-base rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                          >
                            Print Invoice
                          </button>
                        )}
                        {summary.is_settled && summary.context_type === "room" && <button type="button" onClick={() => setTab("folios")} className="app-btn-base rounded-2xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">Open Folio Queue</button>}
                        <button type="button" onClick={resetState} className="app-btn-base rounded-2xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">Start Another Lookup</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "folios" && (
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="app-section-title text-slate-900">Room Folio Queue</h2>
                  <p className="app-muted-text text-slate-500">Review settled room invoices, print again, and move them through cashier and accountant checkpoints.</p>
                </div>
                <div className="w-full overflow-x-auto pb-1 lg:w-auto">
                  <div className="flex min-w-max gap-2">
                    {FILTERS.map((item) => (
                      <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === item.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        {item.label}
                      </button>
                    ))}
                    <button type="button" onClick={() => void loadFolios()} className="app-btn-base rounded-2xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">Refresh</button>
                  </div>
                </div>
              </div>
            </div>

            {folioError && <Alert tone="error">{folioError}</Alert>}
            {folioActionError && <Alert tone="error">{folioActionError}</Alert>}

            {folioLoading ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">Loading folio queue...</div>
            ) : folios.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">No room folios found</h3>
                <p className="mt-2 text-sm text-slate-500">Settled room bills will appear here for printing and handoff review.</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
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
