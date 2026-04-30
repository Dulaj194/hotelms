import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CashierBillingDashboard from "@/pages/admin/CashierBillingDashboard";

const {
  getBillingQueueSummary,
  listBillingFolios,
  getBillingFolioDetail,
  recordBillPrint,
  acceptCashierFolio,
  rejectCashierFolio,
  sendFolioToAccountant,
  getUser,
  normalizeRole,
  useBillingRealtime,
} = vi.hoisted(() => ({
  getBillingQueueSummary: vi.fn(),
  listBillingFolios: vi.fn(),
  getBillingFolioDetail: vi.fn(),
  recordBillPrint: vi.fn(),
  acceptCashierFolio: vi.fn(),
  rejectCashierFolio: vi.fn(),
  sendFolioToAccountant: vi.fn(),
  getUser: vi.fn(),
  normalizeRole: vi.fn(),
  useBillingRealtime: vi.fn(),
}));

vi.mock("@/features/billing/api", () => ({
  getBillingQueueSummary,
  listBillingFolios,
  getBillingFolioDetail,
  recordBillPrint,
  acceptCashierFolio,
  rejectCashierFolio,
  sendFolioToAccountant,
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

describe("CashierBillingDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockReturnValue({ role: "cashier", restaurant_id: 1 });
    normalizeRole.mockReturnValue("cashier");
    useBillingRealtime.mockReturnValue({ connected: true, connectionError: null });
    getBillingQueueSummary.mockResolvedValue({
      fresh_count: 1,
      cashier_pending_count: 2,
      cashier_accepted_count: 1,
      accountant_pending_count: 0,
      completed_count: 3,
      printed_today_count: 4,
      rejected_today_count: 0,
      reopened_today_count: 0,
      room_folio_total: 6,
    });
    listBillingFolios.mockResolvedValue({
      items: [
        {
          id: 7,
          bill_number: "RF-2001",
          context_type: "room",
          session_id: "room-2001",
          table_number: null,
          room_id: 10,
          room_number: "201",
          total_amount: 88,
          payment_method: "cash",
          payment_status: "paid",
          transaction_reference: null,
          notes: null,
          handoff_status: "sent_to_cashier",
          sent_to_cashier_at: "2026-04-02T10:00:00Z",
          sent_to_accountant_at: null,
          handoff_completed_at: null,
          settled_at: "2026-04-02T09:50:00Z",
          created_at: "2026-04-02T09:50:00Z",
          cashier_status: "pending",
          accountant_status: "not_sent",
          printed_count: 1,
          last_printed_at: "2026-04-02T10:05:00Z",
          reopened_count: 0,
        },
      ],
      total: 1,
    });
    acceptCashierFolio.mockResolvedValue({});
    rejectCashierFolio.mockResolvedValue({});
    sendFolioToAccountant.mockResolvedValue({});
    getBillingFolioDetail.mockResolvedValue(null);
    recordBillPrint.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it("loads pending cashier folios and accepts one", async () => {
    render(
      <MemoryRouter>
        <CashierBillingDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Room 201")).toBeTruthy();
    expect(screen.getAllByText("Pending Review").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(acceptCashierFolio).toHaveBeenCalledWith(7);
    });
  });
});
