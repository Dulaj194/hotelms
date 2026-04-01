import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Billing from "@/pages/admin/Billing";

const { apiGet, apiPost, getUser, normalizeRole } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getUser: vi.fn(),
  normalizeRole: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: apiGet,
    post: apiPost,
  },
  ApiError: class extends Error {
    detail: string;

    constructor(detail: string) {
      super(detail);
      this.detail = detail;
    }
  },
}));

vi.mock("@/lib/auth", () => ({
  getUser,
  normalizeRole,
}));

vi.mock("@/components/shared/DashboardLayout", () => ({
  default: ({ children }: { children: any }) => <div>{children}</div>,
}));

describe("Billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockReturnValue({ role: "owner" });
    normalizeRole.mockReturnValue("owner");

    apiGet.mockImplementation(async (path: string) => {
      if (path === "/billing/room/101/summary") {
        return {
          context_type: "room",
          session_id: "room-session-1",
          table_number: null,
          room_number: "101",
          session_is_active: true,
          is_settled: false,
          order_count: 1,
          subtotal: 24,
          tax_amount: 0,
          discount_amount: 0,
          grand_total: 24,
          orders: [
            {
              id: 1,
              order_number: "RO-1001",
              placed_at: "2026-04-02T12:00:00Z",
              total_amount: 24,
              items: [
                {
                  id: 1,
                  item_name_snapshot: "Club Sandwich",
                  quantity: 2,
                  unit_price_snapshot: 12,
                  line_total: 24,
                },
              ],
            },
          ],
          bill: null,
        };
      }

      if (path === "/billing/room/room-session-1/summary") {
        return {
          context_type: "room",
          session_id: "room-session-1",
          table_number: null,
          room_number: "101",
          session_is_active: false,
          is_settled: true,
          order_count: 1,
          subtotal: 24,
          tax_amount: 0,
          discount_amount: 0,
          grand_total: 24,
          orders: [
            {
              id: 1,
              order_number: "RO-1001",
              placed_at: "2026-04-02T12:00:00Z",
              total_amount: 24,
              items: [
                {
                  id: 1,
                  item_name_snapshot: "Club Sandwich",
                  quantity: 2,
                  unit_price_snapshot: 12,
                  line_total: 24,
                },
              ],
            },
          ],
          bill: {
            id: 5,
            bill_number: "RF-1001",
            context_type: "room",
            table_number: null,
            room_number: "101",
            session_id: "room-session-1",
            total_amount: 24,
            payment_method: "cash",
            settled_at: "2026-04-02T12:10:00Z",
            handoff_status: "none",
          },
        };
      }

      if (path === "/billing/folios?context_type=room&limit=100") {
        return {
          items: [
            {
              id: 5,
              bill_number: "RF-1001",
              context_type: "room",
              table_number: null,
              room_number: "101",
              session_id: "room-session-1",
              total_amount: 24,
              payment_method: "cash",
              settled_at: "2026-04-02T12:10:00Z",
              handoff_status: "none",
            },
          ],
          total: 1,
        };
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    apiPost.mockImplementation(async (path: string) => {
      if (path === "/billing/room/room-session-1/settle") {
        return {
          bill_id: 5,
          bill_number: "RF-1001",
          context_type: "room",
          table_number: null,
          room_number: "101",
          order_count: 1,
          total_amount: 24,
          payment_method: "cash",
          settled_at: "2026-04-02T12:10:00Z",
        };
      }

      if (path === "/billing/folios/5/send-to-cashier") {
        return { message: "ok" };
      }

      throw new Error(`Unexpected path: ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("settles a room folio and sends it to cashier from the queue", async () => {
    render(
      <MemoryRouter>
        <Billing />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Room Folio" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "101" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load Summary" }));

    expect(await screen.findByText("Room 101")).toBeTruthy();
    expect(screen.getByText("Club Sandwich")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Settle $24.00" }));

    expect(await screen.findByText("Settlement Complete")).toBeTruthy();
    expect(screen.getByText("RF-1001")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open Folio Queue" }));

    expect(await screen.findByText("Room Folio Queue")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send to Cashier" }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/billing/folios/5/send-to-cashier", {});
    });
  });
});
