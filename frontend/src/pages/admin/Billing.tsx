/**
 * Billing page — lets staff look up a table session, review outstanding
 * orders, choose a payment method, and settle the bill.
 *
 * Flow:
 *  1. Enter a session_id → Fetch bill summary
 *  2. Review order breakdown and grand total
 *  3. Select payment method (cash / card / manual)
 *  4. Optionally enter transaction reference and notes
 *  5. Submit settlement
 *  6. Show success receipt with bill number
 */
import { useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";
import type {
  BillOrder,
  BillPaymentMethod,
  BillSummaryResponse,
  SettleSessionResponse,
} from "@/types/billing";

const PAYMENT_METHODS: { value: BillPaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card (POS)" },
  { value: "manual", label: "Manual / Other" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function OrderLineItems({ order }: { order: BillOrder }) {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">
          #{order.order_number}
        </span>
        <span className="text-sm text-gray-500">
          {new Date(order.placed_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="pb-1">Item</th>
            <th className="pb-1 text-center">Qty</th>
            <th className="pb-1 text-right">Unit</th>
            <th className="pb-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-t border-gray-100">
              <td className="py-1 pr-2">{item.item_name_snapshot}</td>
              <td className="py-1 text-center">{item.quantity}</td>
              <td className="py-1 text-right">
                ${item.unit_price_snapshot.toFixed(2)}
              </td>
              <td className="py-1 text-right font-medium">
                ${item.line_total.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300">
            <td colSpan={3} className="pt-2 text-right font-semibold">
              Order total
            </td>
            <td className="pt-2 text-right font-semibold text-gray-800">
              ${order.total_amount.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Billing() {
  // Search state
  const [sessionInput, setSessionInput] = useState("");
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Summary data
  const [summary, setSummary] = useState<BillSummaryResponse | null>(null);

  // Settlement form
  const [paymentMethod, setPaymentMethod] = useState<BillPaymentMethod>("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  // Success state
  const [receipt, setReceipt] = useState<SettleSessionResponse | null>(null);

  // ── Fetch bill summary ────────────────────────────────────────────────────

  async function handleFetchSummary(e: React.FormEvent) {
    e.preventDefault();
    const sid = sessionInput.trim();
    if (!sid) return;

    setFetchLoading(true);
    setFetchError(null);
    setSummary(null);
    setReceipt(null);
    setSettleError(null);

    try {
      const data = await api.get<BillSummaryResponse>(
        `/billing/session/${encodeURIComponent(sid)}/summary`
      );
      setSummary(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setFetchError(
          "Session not found. Use a valid session ID (full or short prefix) or table number."
        );
      } else if (err instanceof ApiError && err.status === 422) {
        setFetchError(err.detail);
      } else {
        setFetchError(
          err instanceof Error ? err.message : "Failed to load bill summary."
        );
      }
    } finally {
      setFetchLoading(false);
    }
  }

  // ── Settle session ────────────────────────────────────────────────────────

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault();
    if (!summary) return;

    setSettleLoading(true);
    setSettleError(null);

    try {
      const result = await api.post<SettleSessionResponse>(
        `/billing/session/${encodeURIComponent(summary.session_id)}/settle`,
        {
          payment_method: paymentMethod,
          ...(transactionRef.trim() && {
            transaction_reference: transactionRef.trim(),
          }),
          ...(notes.trim() && { notes: notes.trim() }),
        }
      );
      setReceipt(result);
      setSummary(null);
    } catch (err) {
      setSettleError(
        err instanceof Error ? err.message : "Settlement failed. Please try again."
      );
    } finally {
      setSettleLoading(false);
    }
  }

  // ── Reset to search again ────────────────────────────────────────────────

  function handleReset() {
    setSessionInput("");
    setSummary(null);
    setReceipt(null);
    setFetchError(null);
    setSettleError(null);
    setTransactionRef("");
    setNotes("");
    setPaymentMethod("cash");
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Billing</h1>

      {/* ── Success receipt ── */}
      {receipt && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-2xl">✓</span>
            <h2 className="text-lg font-semibold text-green-800">
              Payment Received
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Bill #</dt>
            <dd className="font-mono font-semibold">{receipt.bill_number}</dd>

            <dt className="text-gray-500">Table</dt>
            <dd>{receipt.table_number}</dd>

            <dt className="text-gray-500">Orders settled</dt>
            <dd>{receipt.order_count}</dd>

            <dt className="text-gray-500">Total charged</dt>
            <dd className="font-semibold">${receipt.total_amount.toFixed(2)}</dd>

            <dt className="text-gray-500">Payment method</dt>
            <dd className="capitalize">{receipt.payment_method}</dd>

            <dt className="text-gray-500">Session closed</dt>
            <dd>{receipt.session_closed ? "Yes" : "No"}</dd>

            <dt className="text-gray-500">Settled at</dt>
            <dd>{new Date(receipt.settled_at).toLocaleString()}</dd>
          </dl>

          <button
            onClick={handleReset}
            className="mt-5 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            Bill another table
          </button>
        </div>
      )}

      {/* ── Session lookup form ── */}
      {!receipt && (
        <form
          onSubmit={handleFetchSummary}
          className="mb-6 flex items-end gap-3"
        >
          <div className="flex-1">
            <label
              htmlFor="session-id"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Table Session ID
            </label>
            <input
              id="session-id"
              type="text"
              value={sessionInput}
              onChange={(e) => setSessionInput(e.target.value)}
              placeholder="e.g. session id, short id prefix, or table number"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={fetchLoading || !sessionInput.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {fetchLoading ? "Loading…" : "Load Summary"}
          </button>
        </form>
      )}

      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* ── Bill summary + settlement form ── */}
      {summary && !receipt && (
        <>
          {/* Summary header */}
          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                Table {summary.table_number}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  summary.is_settled
                    ? "bg-green-100 text-green-700"
                    : summary.session_is_active
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {summary.is_settled
                  ? "Settled"
                  : summary.session_is_active
                  ? "Active"
                  : "Expired"}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">{summary.session_id}</p>
          </div>

          {/* Already settled notice */}
          {summary.is_settled && (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              This session has already been settled.
            </div>
          )}

          {/* No billable orders notice */}
          {!summary.is_settled && summary.order_count === 0 && (
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
              No completed orders to bill yet. Orders must reach{" "}
              <strong>completed</strong> status in the kitchen before they can
              be settled.
            </div>
          )}

          {/* Order line items */}
          {summary.orders.map((order) => (
            <OrderLineItems key={order.id} order={order} />
          ))}

          {/* Totals */}
          <div className="mb-6 rounded-xl border border-gray-300 bg-white p-4">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Subtotal</dt>
                <dd>${summary.subtotal.toFixed(2)}</dd>
              </div>
              {summary.tax_amount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Tax</dt>
                  <dd>${summary.tax_amount.toFixed(2)}</dd>
                </div>
              )}
              {summary.discount_amount > 0 && (
                <div className="flex justify-between text-green-700">
                  <dt>Discount</dt>
                  <dd>-${summary.discount_amount.toFixed(2)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
                <dt>Grand Total</dt>
                <dd>${summary.grand_total.toFixed(2)}</dd>
              </div>
            </dl>
          </div>

          {/* Settlement form — only shown if not already settled and has billable orders */}
          {!summary.is_settled && summary.order_count > 0 && (
            <form onSubmit={handleSettle} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Payment Method
                </label>
                <div className="flex gap-3">
                  {PAYMENT_METHODS.map((m) => (
                    <label
                      key={m.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                        paymentMethod === m.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        value={m.value}
                        checked={paymentMethod === m.value}
                        onChange={() => setPaymentMethod(m.value)}
                        className="sr-only"
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              {(paymentMethod === "card" || paymentMethod === "manual") && (
                <div>
                  <label
                    htmlFor="txn-ref"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Transaction Reference{" "}
                    <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="txn-ref"
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="POS receipt / reference number"
                    maxLength={255}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="notes"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="Any settlement notes…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {settleError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {settleError}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={settleLoading}
                  className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {settleLoading
                    ? "Processing…"
                    : `Settle $${summary.grand_total.toFixed(2)}`}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Reset button when already settled */}
          {summary.is_settled && (
            <button
              onClick={handleReset}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              ← Look up another session
            </button>
          )}
        </>
      )}
      </div>
    </DashboardLayout>
  );
}
