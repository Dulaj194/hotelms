import { useCallback, useEffect, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import BillingFolioDrawer from "@/features/billing/BillingFolioDrawer";
import {
  acceptAccountantFolio,
  getBillingFolioDetail,
  getBillingQueueSummary,
  getBillingReconciliation,
  listBillingFolios,
  recordBillPrint,
  rejectAccountantFolio,
  reopenBillingFolio,
} from "@/features/billing/api";
import {
  formatBillingCurrency,
  formatBillingDate,
  formatShortBillingDate,
  getBillContextLabel,
  getHandoffClass,
  getHandoffLabel,
  getReviewClass,
  getReviewLabel,
  printBillingInvoice,
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

type AccountantView = "pending" | "completed";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function MetricCard({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: "emerald" | "sky" | "slate" | "rose";
}) {
  const toneClass = {
    emerald: "from-emerald-500 to-emerald-600 text-white",
    sky: "from-sky-500 to-sky-600 text-white",
    slate: "from-slate-900 to-slate-700 text-white",
    rose: "from-rose-500 to-rose-600 text-white",
  }[tone];

  return (
    <div className={`rounded-3xl bg-gradient-to-br p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-white/75">{caption}</p>
    </div>
  );
}

function AccountantQueueCard({
  bill,
  busy,
  showReopen,
  onOpen,
  onPrint,
  onAccept,
  onReject,
  onReopen,
}: {
  bill: BillRecord;
  busy: boolean;
  showReopen: boolean;
  onOpen: () => void;
  onPrint: () => void;
  onAccept: () => void;
  onReject: () => void;
  onReopen: () => void;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {bill.bill_number}
          </p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">
            {getBillContextLabel(bill.context_type, bill.table_number, bill.room_number)}
          </h3>
          <p className="font-mono text-xs text-slate-400">{bill.session_id}</p>
        </div>
        <div className="space-y-2 text-left sm:text-right">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getHandoffClass(
              bill.handoff_status,
            )}`}
          >
            {getHandoffLabel(bill.handoff_status)}
          </span>
          <p className="text-lg font-bold text-slate-900">{formatBillingCurrency(bill.total_amount)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="text-slate-500">Accountant review</p>
          <span
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getReviewClass(
              bill.accountant_status,
            )}`}
          >
            {getReviewLabel(bill.accountant_status)}
          </span>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="text-slate-500">Completed / printed</p>
          <p className="mt-2 font-semibold text-slate-900">
            {formatBillingDate(bill.handoff_completed_at)}
          </p>
          <p className="text-xs text-slate-500">{bill.printed_count} print(s)</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Open Audit
        </button>
        <button
          type="button"
          onClick={onPrint}
          disabled={busy}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Print
        </button>
        {!showReopen && (
          <>
            <button
              type="button"
              onClick={onAccept}
              disabled={busy}
              className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reject
            </button>
          </>
        )}
        {showReopen && (
          <button
            type="button"
            onClick={onReopen}
            disabled={busy}
            className="rounded-2xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reopen
          </button>
        )}
      </div>
    </article>
  );
}

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AccountantBillingDashboard() {
  const user = getUser();
  const role = normalizeRole(user?.role);
  const restaurantId = user?.restaurant_id ?? null;

  const [view, setView] = useState<AccountantView>("pending");
  const [businessDate, setBusinessDate] = useState(todayDateString());
  const [summary, setSummary] = useState<BillingQueueSummaryResponse | null>(null);
  const [reconciliation, setReconciliation] = useState<BillingReconciliationResponse | null>(null);
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

  const loadDashboardMeta = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const [nextSummary, nextReconciliation] = await Promise.all([
        getBillingQueueSummary(),
        getBillingReconciliation(businessDate),
      ]);
      setSummary(nextSummary);
      setReconciliation(nextReconciliation);
    } catch (loadError) {
      setActionError((current) => current ?? getErrorMessage(loadError, "Failed to load accountant dashboard."));
    } finally {
      setSummaryLoading(false);
    }
  }, [businessDate]);

  const loadFolios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listBillingFolios(
        view === "pending"
          ? {
              context_type: "room",
              handoff_status: "sent_to_accountant",
              accountant_status: "pending",
              limit: 100,
            }
          : {
              context_type: "room",
              handoff_status: "completed",
              settled_from: businessDate,
              settled_to: businessDate,
              limit: 100,
            },
      );
      setFolios(response.items);
    } catch (loadError) {
      setFolios([]);
      setError(getErrorMessage(loadError, "Failed to load accountant folios."));
    } finally {
      setLoading(false);
    }
  }, [businessDate, view]);

  const loadDetail = useCallback(async (billId: number) => {
    setSelectedBillId(billId);
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await getBillingFolioDetail(billId));
    } catch (loadError) {
      setDetail(null);
      setDetailError(getErrorMessage(loadError, "Failed to load folio detail."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardMeta();
  }, [loadDashboardMeta]);

  useEffect(() => {
    void loadFolios();
  }, [loadFolios]);

  const { connected, connectionError } = useBillingRealtime({
    restaurantId,
    onEvent: () => {
      void loadDashboardMeta();
      void loadFolios();
      if (selectedBillId) {
        void loadDetail(selectedBillId);
      }
    },
  });

  const handleAction = useCallback(
    async (billId: number, action: "accept" | "reject" | "reopen") => {
      setBusyBillId(billId);
      setActionError(null);
      try {
        if (action === "accept") {
          await acceptAccountantFolio(billId);
        } else if (action === "reject") {
          await rejectAccountantFolio(billId);
        } else {
          await reopenBillingFolio(billId);
        }
        await Promise.all([loadDashboardMeta(), loadFolios()]);
        if (selectedBillId === billId) {
          await loadDetail(billId);
        }
      } catch (actionLoadError) {
        setActionError(getErrorMessage(actionLoadError, "Accountant action failed."));
      } finally {
        setBusyBillId(null);
      }
    },
    [loadDashboardMeta, loadDetail, loadFolios, selectedBillId],
  );

  const handlePrint = useCallback(
    async (billId: number) => {
      setPrintingBillId(billId);
      setActionError(null);
      try {
        await recordBillPrint(billId);
        const nextDetail = await getBillingFolioDetail(billId);
        setDetail(nextDetail);
        printBillingInvoice(nextDetail);
        await Promise.all([loadDashboardMeta(), loadFolios()]);
      } catch (printError) {
        setActionError(getErrorMessage(printError, "Failed to print invoice."));
      } finally {
        setPrintingBillId(null);
      }
    },
    [loadDashboardMeta, loadFolios],
  );

  const drawerActions =
    detail?.bill?.handoff_status === "sent_to_accountant" ? (
      <>
        <button
          type="button"
          onClick={() => void handleAction(detail.bill!.id, "accept")}
          className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => void handleAction(detail.bill!.id, "reject")}
          className="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
        >
          Reject
        </button>
      </>
    ) : detail?.bill?.handoff_status === "completed" ? (
      <button
        type="button"
        onClick={() => void handleAction(detail.bill!.id, "reopen")}
        className="rounded-2xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
      >
        Reopen Folio
      </button>
    ) : null;

  return (
    <DashboardLayout>
      <div className="app-page-stack mx-auto max-w-7xl">
        <div className="rounded-[32px] bg-gradient-to-r from-sky-700 via-cyan-600 to-emerald-600 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
                Accountant Dashboard
              </p>
              <h1 className="app-page-title">Daily reconciliation and final approval</h1>
              <p className="app-body-text text-white/85">
                Approve cashier transfers, reopen exceptions, and monitor same-day billing health from a responsive workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]">
                {connected ? "Realtime connected" : "Realtime reconnecting"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]">
                Role {role}
              </span>
              <input
                type="date"
                value={businessDate}
                onChange={(event) => setBusinessDate(event.target.value)}
                className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white outline-none"
              />
            </div>
          </div>
        </div>

        {connectionError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {connectionError}
          </div>
        )}

        {actionError && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {actionError}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Pending Approvals"
            value={String(summary?.accountant_pending_count ?? 0)}
            caption="Still waiting with accountant"
            tone="sky"
          />
          <MetricCard
            label="Completed Today"
            value={String(reconciliation?.completed_room_folios ?? 0)}
            caption={formatShortBillingDate(reconciliation?.business_date)}
            tone="emerald"
          />
          <MetricCard
            label="Paid Today"
            value={formatBillingCurrency(reconciliation?.total_paid_amount ?? 0)}
            caption={`${reconciliation?.total_paid_bills ?? 0} settled bills`}
            tone="slate"
          />
          <MetricCard
            label="Reopened Today"
            value={String(reconciliation?.reopened_today_count ?? 0)}
            caption="Needs follow-up"
            tone="rose"
          />
        </div>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Approval Queue</h2>
                <p className="text-sm text-slate-500">
                  Pending transfers require accountant confirmation. Completed folios can be reopened when exceptions appear.
                </p>
              </div>
              <div className="flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setView("pending")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    view === "pending"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Pending Approval
                </button>
                <button
                  type="button"
                  onClick={() => setView("completed")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    view === "completed"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Completed
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Daily Breakdown</h2>
            {summaryLoading && !reconciliation ? (
              <p className="mt-4 text-sm text-slate-500">Loading reconciliation...</p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Room revenue</span>
                  <span className="font-semibold text-slate-900">
                    {formatBillingCurrency(reconciliation?.room_paid_amount ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Table revenue</span>
                  <span className="font-semibold text-slate-900">
                    {formatBillingCurrency(reconciliation?.table_paid_amount ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Outstanding cashier</span>
                  <span className="font-semibold text-slate-900">
                    {reconciliation?.outstanding_cashier_folios ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Outstanding accountant</span>
                  <span className="font-semibold text-slate-900">
                    {reconciliation?.outstanding_accountant_folios ?? 0}
                  </span>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Payment methods
                  </p>
                  <div className="mt-3 space-y-2">
                    {reconciliation?.payment_methods.length ? (
                      reconciliation.payment_methods.map((method) => (
                        <div
                          key={method.payment_method}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2"
                        >
                          <span className="capitalize text-slate-600">{method.payment_method}</span>
                          <span className="font-semibold text-slate-900">
                            {formatBillingCurrency(method.total_amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No settled payments for this date.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Loading accountant queue...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        ) : folios.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">No folios in this view</h3>
            <p className="mt-2 text-sm text-slate-500">
              Accountant-ready transfers and completed folios will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {folios.map((bill) => (
              <AccountantQueueCard
                key={bill.id}
                bill={bill}
                busy={busyBillId === bill.id || printingBillId === bill.id}
                showReopen={view === "completed"}
                onOpen={() => void loadDetail(bill.id)}
                onPrint={() => void handlePrint(bill.id)}
                onAccept={() => void handleAction(bill.id, "accept")}
                onReject={() => void handleAction(bill.id, "reject")}
                onReopen={() => void handleAction(bill.id, "reopen")}
              />
            ))}
          </div>
        )}
      </div>

      <BillingFolioDrawer
        open={selectedBillId !== null}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        printing={printingBillId === selectedBillId}
        actions={drawerActions}
        onClose={() => {
          setSelectedBillId(null);
          setDetail(null);
          setDetailError(null);
        }}
        onPrint={() => {
          if (selectedBillId) {
            void handlePrint(selectedBillId);
          }
        }}
      />
    </DashboardLayout>
  );
}
