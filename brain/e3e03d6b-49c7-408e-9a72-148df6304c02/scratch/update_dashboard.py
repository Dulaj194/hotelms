import sys

filepath = 'd:/in_project/hotelms/frontend/src/pages/admin/CashierBillingDashboard.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# Replacement 1: Imports
old_imports = '''import { useCallback, useEffect, useState } from "react";

import BillingFolioDrawer from "@/features/billing/BillingFolioDrawer";
import {
  acceptCashierFolio,
  getBillingFolioDetail,
  getBillingQueueSummary,
  listBillingFolios,
  recordBillPrint,
  sendFolioToAccountant,
  rejectCashierFolio,
} from "@/features/billing/api";
import {
  formatBillingCurrency,
  formatBillingDate,
  getBillContextLabel,
  getHandoffClass,
  getHandoffLabel,
  getReviewClass,
  getReviewLabel,
  printBillingInvoice,
  summarizeBillReview,
} from "@/features/billing/helpers";
import { useBillingRealtime } from "@/features/billing/useBillingRealtime";
import { ApiError } from "@/lib/api";
import { getUser, normalizeRole } from "@/lib/auth";
import type {
  BillDetailResponse,
  BillRecord,
  BillingQueueSummaryResponse,
} from "@/types/billing";

type CashierView = "pending" | "ready";'''

new_imports = '''import { useCallback, useEffect, useState } from "react";

import BillingFolioDrawer from "@/features/billing/BillingFolioDrawer";
import {
  acceptCashierFolio,
  getBillingFolioDetail,
  getBillingQueueSummary,
  getBillingReconciliation,
  listBillingFolios,
  recordBillPrint,
  sendFolioToAccountant,
  rejectCashierFolio,
} from "@/features/billing/api";
import {
  formatBillingCurrency,
  formatBillingDate,
  getBillContextLabel,
  getHandoffClass,
  getHandoffLabel,
  getReviewClass,
  getReviewLabel,
  printBillingInvoice,
  summarizeBillReview,
} from "@/features/billing/helpers";
import { useBillingRealtime } from "@/features/billing/useBillingRealtime";
import { ApiError } from "@/lib/api";
import { getUser, normalizeRole } from "@/lib/auth";
import type {
  BillDetailResponse,
  BillRecord,
  BillingQueueSummaryResponse,
  BillingReconciliationResponse,
} from "@/types/billing";

type CashierView = "pending" | "ready";
type DashboardTab = "queue" | "shift_summary";'''
content = content.replace(old_imports, new_imports)

# Replacement 2: QueueCard
old_queuecard_amount = '''        <div className="space-y-2 text-left sm:text-right">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getHandoffClass(
              bill.handoff_status,
            )}`}
          >
            {getHandoffLabel(bill.handoff_status)}
          </span>
          <p className="text-lg font-bold text-slate-900">{formatBillingCurrency(bill.total_amount)}</p>
        </div>'''
new_queuecard_amount = '''        <div className="space-y-2 text-left sm:text-right">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getHandoffClass(
              bill.handoff_status,
            )}`}
          >
            {getHandoffLabel(bill.handoff_status)}
          </span>
          <p className="text-lg font-bold text-slate-900">{formatBillingCurrency(bill.total_amount)}</p>
          {bill.payment_method && (
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {bill.payment_method.replace("_", " ")}
            </p>
          )}
        </div>'''
content = content.replace(old_queuecard_amount, new_queuecard_amount)


# Replacement 3: Main State
old_state = '''  const [view, setView] = useState<CashierView>("pending");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<BillingQueueSummaryResponse | null>(null);
  const [folios, setFolios] = useState<BillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyBillId, setBusyBillId] = useState<number | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BillDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [printingBillId, setPrintingBillId] = useState<number | null>(null);

  const loadSummary = useCallback(async () => {'''
new_state = '''  const [tab, setTab] = useState<DashboardTab>("queue");
  const [view, setView] = useState<CashierView>("pending");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<BillingQueueSummaryResponse | null>(null);
  const [folios, setFolios] = useState<BillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  
  const [reconciliation, setReconciliation] = useState<BillingReconciliationResponse | null>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyBillId, setBusyBillId] = useState<number | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BillDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [printingBillId, setPrintingBillId] = useState<number | null>(null);

  const [rejectingBillId, setRejectingBillId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const loadSummary = useCallback(async () => {'''
content = content.replace(old_state, new_state)

# Replacement 4: Loaders & handleAction
old_loaders = '''  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadFolios();
  }, [loadFolios]);

  const { connected, connectionError } = useBillingRealtime({
    restaurantId,
    onEvent: () => {
      void loadSummary();
      void loadFolios();
      if (selectedBillId) {
        void loadDetail(selectedBillId);
      }
    },
  });

  const handleAction = useCallback(
    async (billId: number, action: "accept" | "reject" | "send_to_accountant") => {
      setBusyBillId(billId);
      setActionError(null);
      try {
        if (action === "accept") {
          await acceptCashierFolio(billId);
        } else if (action === "reject") {
          await rejectCashierFolio(billId);
        } else {
          await sendFolioToAccountant(billId);
        }
        await Promise.all([loadSummary(), loadFolios()]);
        if (selectedBillId === billId) {
          await loadDetail(billId);
        }
      } catch (actionLoadError) {
        setActionError(getErrorMessage(actionLoadError, "Cashier action failed."));
      } finally {
        setBusyBillId(null);
      }
    },
    [loadDetail, loadFolios, loadSummary, selectedBillId],
  );'''

new_loaders = '''  const loadReconciliation = useCallback(async () => {
    setReconciliationLoading(true);
    try {
      setReconciliation(await getBillingReconciliation());
    } catch (loadError) {
      setActionError((current) => current ?? getErrorMessage(loadError, "Failed to load shift summary."));
    } finally {
      setReconciliationLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadReconciliation();
  }, [loadSummary, loadReconciliation]);

  useEffect(() => {
    void loadFolios();
  }, [loadFolios]);

  const { connected, connectionError } = useBillingRealtime({
    restaurantId,
    onEvent: () => {
      void loadSummary();
      void loadFolios();
      void loadReconciliation();
      if (selectedBillId) {
        void loadDetail(selectedBillId);
      }
    },
  });

  const handleAction = useCallback(
    async (billId: number, action: "accept" | "reject" | "send_to_accountant", note?: string) => {
      setBusyBillId(billId);
      setActionError(null);
      try {
        if (action === "accept") {
          await acceptCashierFolio(billId);
        } else if (action === "reject") {
          await rejectCashierFolio(billId, { note });
        } else {
          await sendFolioToAccountant(billId);
        }
        await Promise.all([loadSummary(), loadFolios(), loadReconciliation()]);
        if (selectedBillId === billId) {
          await loadDetail(billId);
        }
      } catch (actionLoadError) {
        setActionError(getErrorMessage(actionLoadError, "Cashier action failed."));
      } finally {
        setBusyBillId(null);
      }
    },
    [loadDetail, loadFolios, loadSummary, loadReconciliation, selectedBillId],
  );

  const handleBatchSendToAccountant = useCallback(async () => {
    const readyFolios = folios.filter(
      (b) => b.handoff_status === "sent_to_cashier" && b.cashier_status === "accepted"
    );
    if (readyFolios.length === 0) return;
    
    setLoading(true);
    setActionError(null);
    try {
      await Promise.all(readyFolios.map(b => sendFolioToAccountant(b.id)));
      await Promise.all([loadSummary(), loadFolios(), loadReconciliation()]);
    } catch (e) {
      setActionError(getErrorMessage(e, "Failed to batch send folios."));
    } finally {
      setLoading(false);
    }
  }, [folios, loadSummary, loadFolios, loadReconciliation]);'''
content = content.replace(old_loaders, new_loaders)

# Replacement 5: Drawer Action reject
old_drawer = '''        <button
          type="button"
          onClick={() => void handleAction(detail.bill!.id, "reject")}
          className="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
        >
          Reject
        </button>'''
new_drawer = '''        <button
          type="button"
          onClick={() => {
             setRejectingBillId(detail.bill!.id);
             setSelectedBillId(null);
          }}
          className="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
        >
          Reject
        </button>'''
content = content.replace(old_drawer, new_drawer)

# Replacing Render
idx = content.find('        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">')
end_idx = content.find('      <BillingFolioDrawer')
render_content = content[idx:end_idx]

new_render_content = '''        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          <button
            type="button"
            onClick={() => setTab("queue")}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
              tab === "queue" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Cashier Queue
          </button>
          <button
            type="button"
            onClick={() => setTab("shift_summary")}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
              tab === "shift_summary" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Shift Reconciliation
          </button>
        </div>

        {tab === "queue" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-4">
              <MetricCard
                label="Pending Review"
                value={summary?.cashier_pending_count ?? 0}
                tone="amber"
              />
              <MetricCard
                label="Ready for Accountant"
                value={summary?.cashier_accepted_count ?? 0}
                tone="sky"
              />
              <MetricCard
                label="Printed Today"
                value={summary?.printed_today_count ?? 0}
                tone="slate"
              />
              <MetricCard
                label="Fresh Folios"
                value={summary?.fresh_count ?? 0}
                tone="emerald"
              />
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm mt-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Queue Management</h2>
                  <p className="text-sm text-slate-500">
                    Pending folios need cashier review. Accepted folios are ready for accountant handoff.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap xl:w-auto">
                  <div className="flex w-full rounded-full bg-slate-100 p-1 sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setView("pending")}
                      className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold sm:flex-none transition-all ${
                        view === "pending"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Pending Review
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("ready")}
                      className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold sm:flex-none transition-all ${
                        view === "ready"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Ready for Accountant
                    </button>
                  </div>
                  {view === "ready" && folios.some(b => b.handoff_status === "sent_to_cashier" && b.cashier_status === "accepted") && (
                    <button
                      type="button"
                      onClick={() => void handleBatchSendToAccountant()}
                      disabled={loading}
                      className="rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition-all"
                    >
                      Batch Send All Ready
                    </button>
                  )}
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search bill, room, session"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 sm:w-72"
                  />
                </div>
              </div>
            </section>

            {summaryLoading && !summary && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm mt-4">
                Loading queue summary...
              </div>
            )}

            <div className="mt-4">
              {loading ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
                  Loading cashier queue...
                </div>
              ) : error ? (
                <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {error}
                </div>
              ) : folios.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">No folios in this queue</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    New cashier items will appear here as soon as billing sends them.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {folios.map((bill) => (
                    <QueueCard
                      key={bill.id}
                      bill={bill}
                      busy={busyBillId === bill.id || printingBillId === bill.id}
                      onOpen={() => void loadDetail(bill.id)}
                      onPrint={() => void handlePrint(bill.id)}
                      onAccept={() => void handleAction(bill.id, "accept")}
                      onReject={() => setRejectingBillId(bill.id)}
                      onSendToAccountant={() => void handleAction(bill.id, "send_to_accountant")}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
               <h2 className="text-xl font-bold text-slate-900">Shift Reconciliation <span className="text-slate-500 font-medium text-lg ml-2">{reconciliation?.business_date ?? ""}</span></h2>
               <button onClick={() => void loadReconciliation()} className="text-sm font-semibold text-sky-600 hover:text-sky-700">Refresh Summary</button>
            </div>
            {reconciliationLoading && !reconciliation ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
                Loading shift summary...
              </div>
            ) : reconciliation ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Total Paid Revenue</p>
                    <p className="mt-2 text-3xl font-bold text-emerald-600">{formatBillingCurrency(reconciliation.total_paid_amount)}</p>
                    <p className="mt-1 text-sm text-slate-500">{reconciliation.total_paid_bills} settled bills today</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-6 shadow-sm border border-slate-200">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Room Charges</p>
                    <p className="mt-2 text-2xl font-bold text-slate-800">{formatBillingCurrency(reconciliation.room_paid_amount)}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-6 shadow-sm border border-slate-200">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Table Charges</p>
                    <p className="mt-2 text-2xl font-bold text-slate-800">{formatBillingCurrency(reconciliation.table_paid_amount)}</p>
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 mt-4">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Payment Methods Breakdown</h3>
                  {reconciliation.payment_methods.length === 0 ? (
                    <p className="text-sm text-slate-500">No payments recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-100 text-slate-500">
                          <tr>
                            <th className="pb-3 font-semibold uppercase tracking-wider">Method</th>
                            <th className="pb-3 font-semibold uppercase tracking-wider text-right">Count</th>
                            <th className="pb-3 font-semibold uppercase tracking-wider text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {reconciliation.payment_methods.map(pm => (
                            <tr key={pm.payment_method}>
                              <td className="py-3 font-medium text-slate-900 uppercase">{pm.payment_method.replace(/_/g, " ")}</td>
                              <td className="py-3 text-slate-600 text-right">{pm.folio_count}</td>
                              <td className="py-3 text-right font-mono font-bold text-slate-900">{formatBillingCurrency(pm.total_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                   <div className="rounded-3xl bg-amber-50 p-6 shadow-sm border border-amber-100">
                     <p className="text-sm font-semibold text-amber-700 uppercase tracking-widest">Outstanding Cashier Review</p>
                     <p className="mt-2 text-2xl font-bold text-amber-900">{reconciliation.outstanding_cashier_folios} folios</p>
                   </div>
                   <div className="rounded-3xl bg-sky-50 p-6 shadow-sm border border-sky-100">
                     <p className="text-sm font-semibold text-sky-700 uppercase tracking-widest">Pending Accountant</p>
                     <p className="mt-2 text-2xl font-bold text-sky-900">{reconciliation.outstanding_accountant_folios} folios</p>
                   </div>
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                Failed to load shift reconciliation.
              </div>
            )}
          </div>
        )}
'''

content = content.replace(render_content, new_render_content)

modal_content = '''      {rejectingBillId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900">Reject Folio</h3>
            <p className="mt-2 text-sm text-slate-500">Please provide a reason for rejecting this folio back to the origin point.</p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-300 p-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              rows={3}
              placeholder="Enter rejection reason..."
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectingBillId(null);
                  setRejectNote("");
                }}
                className="rounded-2xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!rejectNote.trim()) return;
                  void handleAction(rejectingBillId, "reject", rejectNote);
                  setRejectingBillId(null);
                  setRejectNote("");
                }}
                disabled={!rejectNote.trim()}
                className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition-all"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}'''

content = content.replace('''    </>
  );
}''', modal_content)

with open(filepath, 'w') as f:
    f.write(content)
print('Replaced successfully')
