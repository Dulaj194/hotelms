import { useCallback, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { api, ApiError } from "@/lib/api";
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

const DEFAULT_PAYMENT_METHOD: BillPaymentMethod = "cash";

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.detail || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

function getFetchSummaryErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "Session not found. Use a valid session ID (full or short prefix) or table number.";
  }

  if (error instanceof ApiError && error.status === 422) {
    return error.detail || "Invalid session input.";
  }

  return getErrorMessage(error, "Failed to load bill summary.");
}

function getSessionStatus(summary: BillSummaryResponse): {
  label: string;
  className: string;
} {
  if (summary.is_settled) {
    return {
      label: "Settled",
      className: "bg-green-100 text-green-700",
    };
  }

  if (summary.session_is_active) {
    return {
      label: "Active",
      className: "bg-blue-100 text-blue-700",
    };
  }

  return {
    label: "Expired",
    className: "bg-gray-200 text-gray-600",
  };
}

type AlertBoxProps = {
  tone: "error" | "warning" | "success";
  children: ReactNode;
};

function AlertBox({ tone, children }: AlertBoxProps) {
  const toneClasses = {
    error: "border-red-200 bg-red-50 text-red-700",
    warning: "border-yellow-200 bg-yellow-50 text-yellow-800",
    success: "border-green-200 bg-green-50 text-green-800",
  };

  return (
    <div className={`rounded-lg border p-3 text-sm ${toneClasses[tone]}`}>
      {children}
    </div>
  );
}

type InfoRowProps = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

function InfoRow({ label, value, valueClassName = "" }: InfoRowProps) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className={valueClassName}>{value}</dd>
    </div>
  );
}

function OrderLineItems({ order }: { order: BillOrder }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">
          #{order.order_number}
        </span>
        <span className="text-sm text-gray-500">{formatTime(order.placed_at)}</span>
      </div>

      <div className="space-y-2 md:hidden">
        {order.items.map((item) => (
          <article
            key={item.id}
            className="rounded-md border border-gray-100 bg-gray-50 p-3"
          >
            <p className="text-sm font-medium text-gray-800">
              {item.item_name_snapshot}
            </p>

            <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-gray-600">
              <p>Qty: {item.quantity}</p>
              <p className="text-right">
                Unit: {formatCurrency(item.unit_price_snapshot)}
              </p>
              <p className="col-span-2 text-right font-semibold text-gray-800">
                Total: {formatCurrency(item.line_total)}
              </p>
            </div>
          </article>
        ))}

        <div className="rounded-md border border-gray-200 bg-white p-3 text-right text-sm font-semibold text-gray-800">
          Order total: {formatCurrency(order.total_amount)}
        </div>
      </div>

      <div className="app-table-scroll hidden md:block">
        <table className="w-full min-w-[520px] text-sm">
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
                  {formatCurrency(item.unit_price_snapshot)}
                </td>
                <td className="py-1 text-right font-medium">
                  {formatCurrency(item.line_total)}
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
                {formatCurrency(order.total_amount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

type BillingLookupFormProps = {
  sessionInput: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
};

function BillingLookupForm({
  sessionInput,
  loading,
  onChange,
  onSubmit,
}: BillingLookupFormProps) {
  return (
    <form onSubmit={onSubmit} className="app-form-grid items-end">
      <div className="md:col-span-1">
        <label
          htmlFor="session-id"
          className="app-muted-text mb-1 block font-medium text-gray-700"
        >
          Table Session ID
        </label>
        <input
          id="session-id"
          type="text"
          value={sessionInput}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. session id, short id prefix, or table number"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !sessionInput.trim()}
        className="app-btn-base w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
      >
        {loading ? "Loading..." : "Load Summary"}
      </button>
    </form>
  );
}

type ReceiptCardProps = {
  receipt: SettleSessionResponse;
  onReset: () => void;
};

function ReceiptCard({ receipt, onReset }: ReceiptCardProps) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="app-section-title text-green-800">Payment Received</h2>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm md:grid-cols-2">
        <dt className="text-gray-500">Bill #</dt>
        <dd className="font-mono font-semibold">{receipt.bill_number}</dd>

        <dt className="text-gray-500">Table</dt>
        <dd>{receipt.table_number}</dd>

        <dt className="text-gray-500">Orders settled</dt>
        <dd>{receipt.order_count}</dd>

        <dt className="text-gray-500">Total charged</dt>
        <dd className="font-semibold">{formatCurrency(receipt.total_amount)}</dd>

        <dt className="text-gray-500">Payment method</dt>
        <dd className="capitalize">{receipt.payment_method}</dd>

        <dt className="text-gray-500">Session closed</dt>
        <dd>{receipt.session_closed ? "Yes" : "No"}</dd>

        <dt className="text-gray-500">Settled at</dt>
        <dd>{formatDateTime(receipt.settled_at)}</dd>
      </dl>

      <button
        onClick={onReset}
        className="app-btn-base mt-5 w-full bg-green-700 text-white hover:bg-green-800 sm:w-auto"
      >
        Bill another table
      </button>
    </div>
  );
}

type SessionSummaryHeaderProps = {
  summary: BillSummaryResponse;
};

function SessionSummaryHeader({ summary }: SessionSummaryHeaderProps) {
  const status = getSessionStatus(summary);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">
          Table {summary.table_number}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <p className="font-mono text-xs text-gray-400">{summary.session_id}</p>
    </div>
  );
}

type BillTotalsCardProps = {
  summary: BillSummaryResponse;
};

function BillTotalsCard({ summary }: BillTotalsCardProps) {
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4">
      <dl className="space-y-1 text-sm">
        <InfoRow label="Subtotal" value={formatCurrency(summary.subtotal)} />

        {summary.tax_amount > 0 && (
          <InfoRow label="Tax" value={formatCurrency(summary.tax_amount)} />
        )}

        {summary.discount_amount > 0 && (
          <InfoRow
            label="Discount"
            value={`-${formatCurrency(summary.discount_amount)}`}
            valueClassName="text-green-700"
          />
        )}

        <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
          <dt>Grand Total</dt>
          <dd>{formatCurrency(summary.grand_total)}</dd>
        </div>
      </dl>
    </div>
  );
}

type SettlementFormProps = {
  summary: BillSummaryResponse;
  paymentMethod: BillPaymentMethod;
  transactionRef: string;
  notes: string;
  settleLoading: boolean;
  settleError: string | null;
  onPaymentMethodChange: (value: BillPaymentMethod) => void;
  onTransactionRefChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
};

function SettlementForm({
  summary,
  paymentMethod,
  transactionRef,
  notes,
  settleLoading,
  settleError,
  onPaymentMethodChange,
  onTransactionRefChange,
  onNotesChange,
  onSubmit,
  onCancel,
}: SettlementFormProps) {
  const showTransactionReference =
    paymentMethod === "card" || paymentMethod === "manual";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="app-muted-text mb-1 block font-medium text-gray-700">
          Payment Method
        </label>

        <div className="app-form-grid">
          {PAYMENT_METHODS.map((method) => {
            const isSelected = paymentMethod === method.value;

            return (
              <label
                key={method.value}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value={method.value}
                  checked={isSelected}
                  onChange={() => onPaymentMethodChange(method.value)}
                  className="sr-only"
                />
                {method.label}
              </label>
            );
          })}
        </div>
      </div>

      <div className="app-form-grid">
        {showTransactionReference && (
          <div>
            <label
              htmlFor="txn-ref"
              className="app-muted-text mb-1 block font-medium text-gray-700"
            >
              Transaction Reference <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="txn-ref"
              type="text"
              value={transactionRef}
              onChange={(e) => onTransactionRefChange(e.target.value)}
              placeholder="POS receipt / reference number"
              maxLength={255}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        <div className={showTransactionReference ? "" : "md:col-span-2"}>
          <label
            htmlFor="notes"
            className="app-muted-text mb-1 block font-medium text-gray-700"
          >
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Any settlement notes..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {settleError && <AlertBox tone="error">{settleError}</AlertBox>}

      <div className="app-form-actions">
        <button
          type="submit"
          disabled={settleLoading}
          className="app-btn-base w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
        >
          {settleLoading
            ? "Processing..."
            : `Settle ${formatCurrency(summary.grand_total)}`}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="app-btn-base w-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 sm:w-auto"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Billing() {
  const [sessionInput, setSessionInput] = useState("");
  const [summary, setSummary] = useState<BillSummaryResponse | null>(null);
  const [receipt, setReceipt] = useState<SettleSessionResponse | null>(null);

  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] =
    useState<BillPaymentMethod>(DEFAULT_PAYMENT_METHOD);
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");

  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  const canSettle = useMemo(() => {
    return Boolean(summary && !summary.is_settled && summary.order_count > 0);
  }, [summary]);

  const resetBillingState = useCallback(() => {
    setSessionInput("");
    setSummary(null);
    setReceipt(null);
    setFetchError(null);
    setSettleError(null);
    setTransactionRef("");
    setNotes("");
    setPaymentMethod(DEFAULT_PAYMENT_METHOD);
  }, []);

  const clearFetchState = useCallback(() => {
    setFetchError(null);
    setSummary(null);
    setReceipt(null);
    setSettleError(null);
  }, []);

  const handleFetchSummary = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      const sid = sessionInput.trim();
      if (!sid) return;

      setFetchLoading(true);
      clearFetchState();

      try {
        const data = await api.get<BillSummaryResponse>(
          `/billing/session/${encodeURIComponent(sid)}/summary`
        );
        setSummary(data);
      } catch (error) {
        setFetchError(getFetchSummaryErrorMessage(error));
      } finally {
        setFetchLoading(false);
      }
    },
    [sessionInput, clearFetchState]
  );

  const handleSettle = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!summary) return;

      setSettleLoading(true);
      setSettleError(null);

      try {
        const payload = {
          payment_method: paymentMethod,
          ...(transactionRef.trim()
            ? { transaction_reference: transactionRef.trim() }
            : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };

        const result = await api.post<SettleSessionResponse>(
          `/billing/session/${encodeURIComponent(summary.session_id)}/settle`,
          payload
        );

        setReceipt(result);
        setSummary(null);
      } catch (error) {
        setSettleError(
          getErrorMessage(error, "Settlement failed. Please try again.")
        );
      } finally {
        setSettleLoading(false);
      }
    },
    [summary, paymentMethod, transactionRef, notes]
  );

  return (
    <DashboardLayout>
      <div className="app-page-stack mx-auto max-w-4xl">
        <h1 className="app-page-title text-gray-900">Billing</h1>

        {receipt ? (
          <ReceiptCard receipt={receipt} onReset={resetBillingState} />
        ) : (
          <>
            <BillingLookupForm
              sessionInput={sessionInput}
              loading={fetchLoading}
              onChange={setSessionInput}
              onSubmit={handleFetchSummary}
            />

            {fetchError && <AlertBox tone="error">{fetchError}</AlertBox>}

            {summary && (
              <>
                <SessionSummaryHeader summary={summary} />

                {summary.is_settled && (
                  <AlertBox tone="warning">
                    This session has already been settled.
                  </AlertBox>
                )}

                {!summary.is_settled && summary.order_count === 0 && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                    No completed orders to bill yet. Orders must reach{" "}
                    <strong>completed</strong> status in the kitchen before they can
                    be settled.
                  </div>
                )}

                <div className="space-y-4">
                  {summary.orders.map((order) => (
                    <OrderLineItems key={order.id} order={order} />
                  ))}
                </div>

                <BillTotalsCard summary={summary} />

                {canSettle && (
                  <SettlementForm
                    summary={summary}
                    paymentMethod={paymentMethod}
                    transactionRef={transactionRef}
                    notes={notes}
                    settleLoading={settleLoading}
                    settleError={settleError}
                    onPaymentMethodChange={setPaymentMethod}
                    onTransactionRefChange={setTransactionRef}
                    onNotesChange={setNotes}
                    onSubmit={handleSettle}
                    onCancel={resetBillingState}
                  />
                )}

                {summary.is_settled && (
                  <button
                    onClick={resetBillingState}
                    className="app-btn-base w-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 sm:w-auto"
                  >
                    Look up another session
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}