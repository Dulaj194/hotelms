import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SuperAdminOverview from "@/pages/super-admin/Overview";

const { apiGet, getUser } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: apiGet,
  },
}));

vi.mock("@/lib/auth", () => ({
  getUser,
}));

vi.mock("@/components/shared/SuperAdminLayout", () => ({
  default: ({ children }: { children: any }) => <div>{children}</div>,
}));

describe("SuperAdminOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockReturnValue({
      id: 1,
      role: "super_admin",
      super_admin_scopes: ["ops_viewer", "tenant_admin", "billing_admin", "security_admin"],
    });
    apiGet.mockImplementation(async (path: string) => {
      switch (path) {
        case "/restaurants":
          return [
            {
              id: 1,
              name: "Central Hotel",
              email: "central@example.com",
              phone: null,
              address: null,
              country_id: null,
              currency_id: null,
              country: null,
              currency: null,
              billing_email: null,
              opening_time: null,
              closing_time: null,
              logo_url: null,
              feature_flags: {
                steward: true,
                housekeeping: true,
                kds: true,
                reports: true,
                accountant: true,
                cashier: true,
              },
              integration: {
                api_key: { has_key: false, is_active: false, masked_key: null, rotated_at: null },
                settings: {
                  public_ordering_enabled: false,
                  webhook_url: null,
                  webhook_secret_header_name: null,
                  webhook_status: "not_configured",
                  webhook_last_checked_at: null,
                  webhook_last_error: null,
                },
                webhook_secret: {
                  has_secret: false,
                  header_name: null,
                  masked_value: null,
                  rotated_at: null,
                },
              },
              is_active: true,
              registration_status: "APPROVED",
              registration_reviewed_by_id: null,
              registration_review_notes: null,
              registration_reviewed_at: null,
              created_at: "2026-04-01T00:00:00Z",
              updated_at: "2026-04-01T00:00:00Z",
            },
          ];
        case "/restaurants/registrations/pending?limit=200":
          return { items: [], total: 0 };
        case "/settings/requests/pending?limit=200":
          return { items: [], total: 0 };
        case "/promo-codes":
          return { items: [], total: 0 };
        case "/packages":
          return { items: [] };
        case "/payments/admin/oversight":
          return {
            overdue_payment_count: 2,
            failed_stripe_webhook_count: 3,
            active_trial_count: 4,
            expiring_subscription_count: 1,
            today_revenue_total: 860,
            revenue_by_tenant: [
              {
                restaurant_id: 1,
                restaurant_name: "Central Hotel",
                revenue_today: 860,
                paid_bill_count: 9,
              },
            ],
            overdue_payments: [
              {
                bill_id: 10,
                restaurant_id: 1,
                restaurant_name: "Central Hotel",
                table_number: "A-12",
                amount: 120,
                created_at: "2026-04-01T05:00:00Z",
              },
            ],
            failed_stripe_webhooks: [
              {
                audit_log_id: 41,
                restaurant_id: 1,
                restaurant_name: "Central Hotel",
                stripe_event_type: "checkout.session.completed",
                reason: "invalid_signature",
                created_at: "2026-04-01T06:00:00Z",
              },
            ],
            expiring_subscriptions: [],
          };
        default:
          throw new Error(`Unexpected path: ${path}`);
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the commercial oversight widgets for billing admins", async () => {
    render(
      <MemoryRouter>
        <SuperAdminOverview />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Commercial Oversight")).toBeTruthy();
    expect(screen.getAllByText("$860.00")).toHaveLength(2);
    expect(screen.getByText("Failed Stripe Webhooks")).toBeTruthy();
    expect(screen.getAllByText("Central Hotel").length).toBeGreaterThanOrEqual(1);
  });
});
