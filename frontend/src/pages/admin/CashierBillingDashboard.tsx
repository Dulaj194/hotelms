import { useCallback, useEffect, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
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

type CashierView = "pending" | "ready";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "amber" | "emerald" | "sky";
}) {
  const toneClass = {
    slate: "from-slate-900 to-slate-700 text-white",
    amber: "from-amber-500 to-amber-600 text-white",
    emerald: "from-emerald-500 to-emerald-600 text-white",
    sky: "from-sky-500 to-sky-600 text-white",
  }[tone];

  return (
    <div className={`rounded-3xl bg-gradient-to-br p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}

function QueueCard({
  bill,
  busy,
  onOpen,
  onPrint,
  onAccept,
  onReject,
  onSendToAccountant,
}: {
  bill: BillRecord;
  busy: boolean;
  onOpen: () => void;
  onPrint: () => void;
  onAccept: () => void;
  onReject: () => void;
  onSendToAccountant: () => void;
}) {
  const readyForAccountant =
    bill.handoff_status === "sent_to_cashier" && bill.cashier_status === "accepted";
  const pendingCashier =
    bill.handoff_status === "sent_to_cashier" && bill.cashier_status === "pending";

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
          <p className="text-slate-500">Cashier review</p>
          <span
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getReviewClass(
              bill.cashier_status,
            )}`}
          >
            {getReviewLabel(bill.cashier_status)}
          </span>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="text-slate-500">Print audit</p>
          <p className="mt-2 font-semibold text-slate-900">
            {bill.printed_count} print(s)
          </p>
          <p className="text-xs text-slate-500">{formatBillingDate(bill.last_printed_at)}</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500">{summarizeBillReview(bill)}</p>

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
        {pendingCashier && (
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
        {readyForAccountant && (
          <button
            type="button"
            onClick={onSendToAccountant}
            disabled={busy}
            className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send to Accountant
          </button>
        )}
      </div>
    </article>
  );
}

export default function CashierBillingDashboard() {
  const user = getUser();
  const role = normalizeRole(user?.role);
  const restaurantId = user?.restaurant_id ?? null;

  const [view, setView] = useState<CashierView>("pending");
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

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      setSummary(await getBillingQueueSummary());
    } catch (loadError) {
      setActionError((current) => current ?? getErrorMessage(loadError, "Failed to load queue summary."));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadFolios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listBillingFolios({
        context_type: "room",
        handoff_status: "sent_to_cashier",
        cashier_status: view === "pending" ? "pending" : "accepted",
        limit: 100,
        search: search.trim() || undefined,
      });
      setFolios(response.items);
    } catch (loadError) {
      setFolios([]);
      setError(getErrorMessage(loadError, "Failed to load cashier queue."));
    } finally {
      setLoading(false);
    }
  }, [search, view]);

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
  );

  const handlePrint = useCallback(
    async (billId: number) => {
      setPrintingBillId(billId);
      setActionError(null);
      try {
        await recordBillPrint(billId);
        const nextDetail =
          detail?.bill?.id === billId ? await getBillingFolioDetail(billId) : await getBillingFolioDetail(billId);
        setDetail(nextDetail);
        printBillingInvoice(nextDetail);
        await Promise.all([loadSummary(), loadFolios()]);
      } catch (printError) {
        setActionError(getErrorMessage(printError, "Failed to print invoice."));
      } finally {
        setPrintingBillId(null);
      }
    },
    [detail, loadFolios, loadSummary],
  );

  const drawerActions =
    detail?.bill?.handoff_status === "sent_to_cashier" && detail.bill.cashier_status === "pending" ? (
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
    ) : detail?.bill?.handoff_status === "sent_to_cashier" &&
        detail.bill.cashier_status === "accepted" ? (
      <button
        type="button"
        onClick={() => void handleAction(detail.bill!.id, "send_to_accountant")}
        className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
      >
        Send to Accountant
      </button>
    ) : null;

  return (
    <DashboardLayout>
      <div className="app-page-stack mx-auto max-w-7xl">
        <div className="rounded-[32px] bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
                Cashier Dashboard
              </p>
              <h1 className="app-page-title">Room folio review and transfer queue</h1>
              <p className="app-body-text text-white/85">
                Review settled folios, record invoice prints, and push approved guest bills to the accountant queue with live updates.
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
              <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]">
                {connected ? "Realtime connected" : "Realtime reconnecting"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]">
                Role {role}
              </span>
              <button
                type="button"
                onClick={() => {
                  void loadSummary();
                  void loadFolios();
                }}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Refresh
              </button>
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

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Cashier Queue</h2>
              <p className="text-sm text-slate-500">
                Pending folios need cashier review. Accepted folios are ready for accountant handoff.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap xl:w-auto">
              <div className="flex w-full rounded-full bg-slate-100 p-1 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setView("pending")}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold sm:flex-none ${
                    view === "pending"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Pending Review
                </button>
                <button
                  type="button"
                  onClick={() => setView("ready")}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold sm:flex-none ${
                    view === "ready"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Ready for Accountant
                </button>
              </div>
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
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading queue summary...
          </div>
        )}

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
                onReject={() => void handleAction(bill.id, "reject")}
                onSendToAccountant={() => void handleAction(bill.id, "send_to_accountant")}
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
