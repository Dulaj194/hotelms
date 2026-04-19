import type { ReactNode } from "react";

import {
  formatBillingCurrency,
  formatBillingDate,
  getActionLabel,
  getBillContextLabel,
  getHandoffClass,
  getHandoffLabel,
  getReviewClass,
  getReviewLabel,
} from "@/features/billing/helpers";
import type { BillDetailResponse } from "@/types/billing";

interface BillingFolioDrawerProps {
  open: boolean;
  detail: BillDetailResponse | null;
  loading: boolean;
  error: string | null;
  printing: boolean;
  actions?: ReactNode;
  onClose: () => void;
  onPrint: () => void;
}

export default function BillingFolioDrawer({
  open,
  detail,
  loading,
  error,
  printing,
  actions,
  onClose,
  onPrint,
}: BillingFolioDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-end bg-slate-950/55 sm:items-stretch sm:p-4">
      <div className="h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:h-full sm:max-w-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Folio Detail
              </p>
              <h2 className="text-xl font-bold text-slate-900">
                {detail
                  ? getBillContextLabel(
                      detail.context_type,
                      detail.table_number,
                      detail.room_number,
                    )
                  : "Loading folio"}
              </h2>
              {detail?.bill && (
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getHandoffClass(
                      detail.bill.handoff_status,
                    )}`}
                  >
                    {getHandoffLabel(detail.bill.handoff_status)}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getReviewClass(
                      detail.bill.cashier_status,
                    )}`}
                  >
                    Cashier {getReviewLabel(detail.bill.cashier_status)}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getReviewClass(
                      detail.bill.accountant_status,
                    )}`}
                  >
                    Accountant {getReviewLabel(detail.bill.accountant_status)}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-6 px-4 py-5 md:px-6">
          {loading && (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Loading folio detail...
            </div>
          )}

          {error && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error && detail && (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Bill
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {detail.bill?.bill_number ?? "Pending"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{detail.session_id}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Amount
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {formatBillingCurrency(detail.grand_total)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Settled {formatBillingDate(detail.bill?.settled_at)}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Print Audit
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {detail.bill?.printed_count ?? 0} prints
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Last {formatBillingDate(detail.bill?.last_printed_at)}
                  </p>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Workflow Actions</h3>
                    <p className="text-sm text-slate-500">
                      Print, review, and reconcile from the same mobile-friendly panel.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onPrint}
                      disabled={printing}
                      className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {printing ? "Printing..." : "Print Invoice"}
                    </button>
                    {actions}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Order Breakdown</h3>
                <div className="mt-4 space-y-3">
                  {detail.orders.map((order) => (
                    <article
                      key={order.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{order.order_number}</p>
                          <p className="text-xs text-slate-500">
                            {formatBillingDate(order.placed_at)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatBillingCurrency(order.total_amount)}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3 text-sm"
                          >
                            <div>
                              <p className="font-medium text-slate-900">{item.item_name_snapshot}</p>
                              <p className="text-xs text-slate-500">
                                {item.quantity} x {formatBillingCurrency(item.unit_price_snapshot)}
                              </p>
                            </div>
                            <p className="font-semibold text-slate-900">
                              {formatBillingCurrency(item.line_total)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">Audit Timeline</h3>
                  <div className="mt-4 space-y-3">
                    {detail.events.length === 0 ? (
                      <p className="text-sm text-slate-500">No audit events recorded yet.</p>
                    ) : (
                      detail.events.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {getActionLabel(event.action_type)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {event.actor.full_name ?? event.actor.role ?? "System"}
                              </p>
                            </div>
                            <p className="text-xs text-slate-500">
                              {formatBillingDate(event.created_at)}
                            </p>
                          </div>
                          {event.note && (
                            <p className="mt-2 text-sm text-slate-600">{event.note}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="text-base font-semibold text-slate-900">Payment Trail</h3>
                    <div className="mt-4 space-y-3">
                      {detail.payments.length === 0 ? (
                        <p className="text-sm text-slate-500">No payments recorded.</p>
                      ) : (
                        detail.payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm"
                          >
                            <p className="font-semibold text-slate-900">
                              {formatBillingCurrency(payment.amount)}
                            </p>
                            <p className="text-slate-500">{payment.payment_method}</p>
                            <p className="text-xs text-slate-500">
                              {formatBillingDate(payment.paid_at)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="text-base font-semibold text-slate-900">Workflow Snapshot</h3>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500">Cashier</dt>
                        <dd className="font-semibold text-slate-900">
                          {getReviewLabel(detail.bill?.cashier_status)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500">Accountant</dt>
                        <dd className="font-semibold text-slate-900">
                          {getReviewLabel(detail.bill?.accountant_status)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500">Reopened</dt>
                        <dd className="font-semibold text-slate-900">
                          {detail.bill?.reopened_count ?? 0}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
