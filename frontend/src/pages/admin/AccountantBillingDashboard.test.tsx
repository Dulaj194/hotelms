import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AccountantBillingDashboard from "@/pages/admin/AccountantBillingDashboard";

const {
  getBillingQueueSummary,
  getBillingReconciliation,
  listBillingFolios,
  getBillingFolioDetail,
  recordBillPrint,
  acceptAccountantFolio,
  rejectAccountantFolio,
  reopenBillingFolio,
  getUser,
  normalizeRole,
  useBillingRealtime,
} = vi.hoisted(() => ({
  getBillingQueueSummary: vi.fn(),
  getBillingReconciliation: vi.fn(),
  listBillingFolios: vi.fn(),
  getBillingFolioDetail: vi.fn(),
  recordBillPrint: vi.fn(),
  acceptAccountantFolio: vi.fn(),
  rejectAccountantFolio: vi.fn(),
  reopenBillingFolio: vi.fn(),
  getUser: vi.fn(),
  normalizeRole: vi.fn(),
  useBillingRealtime: vi.fn(),
}));

vi.mock("@/features/billing/api", () => ({
  getBillingQueueSummary,
  getBillingReconciliation,
  listBillingFolios,
  getBillingFolioDetail,
  recordBillPrint,
  acceptAccountantFolio,
  rejectAccountantFolio,
  reopenBillingFolio,
}));

vi.mock("@/lib/auth", () => ({
  getUser,
  normalizeRole,
}));

vi.mock("@/features/billing/useBillingRealtime", () => ({
  useBillingRealtime,
}));

vi.mock("@/components/shared/DashboardLayout", () => ({
  default: ({ children }: { children: any }) => <div>{children}</div>,
}));

describe("AccountantBillingDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockReturnValue({ role: "accountant", restaurant_id: 1 });
    normalizeRole.mockReturnValue("accountant");
    useBillingRealtime.mockReturnValue({ connected: true, connectionError: null });
    getBillingQueueSummary.mockResolvedValue({
      fresh_count: 0,
      cashier_pending_count: 0,
      cashier_accepted_count: 1,
      accountant_pending_count: 2,
      completed_count: 3,
      printed_today_count: 1,
      rejected_today_count: 0,
      reopened_today_count: 0,
      room_folio_total: 6,
    });
    getBillingReconciliation.mockResolvedValue({
      business_date: "2026-04-02",
      total_paid_bills: 5,
      total_paid_amount: 480,
      room_paid_amount: 320,
      table_paid_amount: 160,
      completed_room_folios: 3,
      outstanding_cashier_folios: 1,
      outstanding_accountant_folios: 2,
      printed_today_count: 1,
      reopened_today_count: 0,
      payment_methods: [
        {
          payment_method: "cash",
          folio_count: 3,
          total_amount: 320,
        },
      ],
      recent_completed: [],
    });
    listBillingFolios.mockResolvedValue({
      items: [
        {
          id: 14,
          bill_number: "RF-3001",
          context_type: "room",
          session_id: "room-3001",
          table_number: null,
          room_id: 14,
          room_number: "301",
          total_amount: 145,
          payment_method: "card",
          payment_status: "paid",
          transaction_reference: "POS-9",
          notes: null,
          handoff_status: "sent_to_accountant",
          sent_to_cashier_at: "2026-04-02T11:00:00Z",
          sent_to_accountant_at: "2026-04-02T11:20:00Z",
          handoff_completed_at: null,
          settled_at: "2026-04-02T10:55:00Z",
          created_at: "2026-04-02T10:55:00Z",
          cashier_status: "accepted",
          accountant_status: "pending",
          printed_count: 1,
          last_printed_at: "2026-04-02T11:05:00Z",
          reopened_count: 0,
        },
      ],
      total: 1,
    });
    getBillingFolioDetail.mockResolvedValue(null);
    recordBillPrint.mockResolvedValue({});
    acceptAccountantFolio.mockResolvedValue({});
    rejectAccountantFolio.mockResolvedValue({});
    reopenBillingFolio.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it("loads accountant queue and accepts a folio", async () => {
    render(
      <MemoryRouter>
        <AccountantBillingDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Room 301")).toBeTruthy();
    expect(screen.getByText("Daily Breakdown")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(acceptAccountantFolio).toHaveBeenCalledWith(14);
    });
  });
});
