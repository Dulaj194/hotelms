import type {
  BillContextType,
  BillDetailResponse,
  BillHandoffStatus,
  BillPaymentMethod,
  BillRecord,
  BillReviewStatus,
  BillSummaryResponse,
  SettleSessionResponse,
} from "@/types/billing";

export const BILLING_DASHBOARD_PATHS = {
  default: "/admin/billing",
  cashier: "/admin/billing/cashier",
  accountant: "/admin/billing/accountant",
} as const;

export const BILLING_METHOD_OPTIONS: Array<{
  value: BillPaymentMethod;
  label: string;
}> = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card / POS" },
  { value: "manual", label: "Manual" },
];

export function getBillingHomePath(role: string | null | undefined): string {
  const normalized = (role ?? "").trim().toLowerCase();
  if (normalized === "cashier") return BILLING_DASHBOARD_PATHS.cashier;
  if (normalized === "accountant") return BILLING_DASHBOARD_PATHS.accountant;
  return BILLING_DASHBOARD_PATHS.default;
}

export function formatBillingCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatBillingDate(value: string | null | undefined): string {
  if (!value) return "Pending";
  return new Date(value).toLocaleString();
}

export function formatShortBillingDate(value: string | null | undefined): string {
  if (!value) return "Pending";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getBillContextLabel(
  type: BillContextType,
  table: string | null,
  room: string | null,
): string {
  return type === "room" ? `Room ${room ?? "-"}` : `Table ${table ?? "-"}`;
}

export function getHandoffLabel(status: BillHandoffStatus): string {
  return {
    none: "Fresh",
    sent_to_cashier: "With Cashier",
    sent_to_accountant: "With Accountant",
    completed: "Completed",
  }[status];
}

export function getHandoffClass(status: BillHandoffStatus): string {
  return {
    none: "bg-slate-100 text-slate-700",
    sent_to_cashier: "bg-amber-100 text-amber-800",
    sent_to_accountant: "bg-sky-100 text-sky-800",
    completed: "bg-emerald-100 text-emerald-800",
  }[status];
}

export function getReviewLabel(status: BillReviewStatus | null | undefined): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    default:
      return "Not Sent";
  }
}

export function getReviewClass(status: BillReviewStatus | null | undefined): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "accepted":
      return "bg-emerald-100 text-emerald-800";
    case "rejected":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function summarizeBillReview(bill: BillRecord): string {
  if (bill.handoff_status === "completed") return "Closed by accountant";
  if (bill.handoff_status === "sent_to_accountant") {
    return `Accountant ${getReviewLabel(bill.accountant_status).toLowerCase()}`;
  }
  if (bill.handoff_status === "sent_to_cashier") {
    return `Cashier ${getReviewLabel(bill.cashier_status).toLowerCase()}`;
  }
  if (bill.cashier_status === "rejected") return "Returned by cashier";
  return "Ready for cashier";
}

export function getActionLabel(actionType: string): string {
  return {
    settled: "Folio settled",
    printed: "Invoice printed",
    sent_to_cashier: "Sent to cashier",
    cashier_accepted: "Cashier accepted",
    cashier_rejected: "Cashier rejected",
    sent_to_accountant: "Sent to accountant",
    accountant_accepted: "Accountant accepted",
    accountant_rejected: "Accountant rejected",
    reopened: "Folio reopened",
  }[actionType] ?? actionType.replace(/_/g, " ");
}

export function printBillingInvoice(
  summary: BillSummaryResponse | BillDetailResponse,
  receipt?: SettleSessionResponse,
): void {
  const billNo = summary.bill?.bill_number ?? receipt?.bill_number ?? "Pending";
  const payment = summary.bill?.payment_method ?? receipt?.payment_method ?? "manual";
  const settledAt = summary.bill?.settled_at ?? receipt?.settled_at ?? "";
  const rows = summary.orders
    .flatMap((order) =>
      order.items.map(
        (item) =>
          `<tr><td>${order.order_number}</td><td>${item.item_name_snapshot}</td><td>${item.quantity}</td><td>${formatBillingCurrency(item.unit_price_snapshot)}</td><td>${formatBillingCurrency(item.line_total)}</td></tr>`,
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
      <p><strong>Context:</strong> ${getBillContextLabel(summary.context_type, summary.table_number, summary.room_number)}<br />
      <strong>Session:</strong> ${summary.session_id}<br />
      <strong>Payment:</strong> ${payment}<br />
      <strong>Settled:</strong> ${settledAt ? formatBillingDate(settledAt) : "Pending"}</p>
      <table><thead><tr><th>Order</th><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${rows || "<tr><td colspan='5'>No items</td></tr>"}</tbody></table>
      <div class="totals">
        <div><span>Subtotal</span><span>${formatBillingCurrency(summary.subtotal)}</span></div>
        <div><span>Tax</span><span>${formatBillingCurrency(summary.tax_amount)}</span></div>
        <div><span>Discount</span><span>${formatBillingCurrency(summary.discount_amount)}</span></div>
        <div class="grand"><span>Grand Total</span><span>${formatBillingCurrency(summary.grand_total)}</span></div>
      </div>
    </div></body></html>`);
  win.document.close();
  win.focus();
}
