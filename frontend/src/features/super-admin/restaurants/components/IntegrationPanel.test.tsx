import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IntegrationPanel } from "@/features/super-admin/restaurants/components/IntegrationPanel";

describe("IntegrationPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders webhook secret controls and retry history", () => {
    const onRetryDelivery = vi.fn();

    render(
      <IntegrationPanel
        selected={{
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
            api_key: {
              has_key: true,
              is_active: true,
              masked_key: "hmsrk_demo...1234",
              rotated_at: "2026-04-01T06:00:00Z",
            },
            settings: {
              public_ordering_enabled: true,
              webhook_url: "https://example.com/webhooks/orders",
              webhook_secret_header_name: "X-HotelMS-Webhook-Secret",
              webhook_status: "degraded",
              webhook_last_checked_at: "2026-04-01T07:00:00Z",
              webhook_last_error: "Webhook returned HTTP 500.",
            },
            webhook_secret: {
              has_secret: true,
              header_name: "X-HotelMS-Webhook-Secret",
              masked_value: "****9ab4",
              rotated_at: "2026-04-01T06:10:00Z",
            },
          },
          is_active: true,
          registration_status: "APPROVED",
          registration_reviewed_by_id: null,
          registration_review_notes: null,
          registration_reviewed_at: null,
          created_at: "2026-04-01T00:00:00Z",
          updated_at: "2026-04-01T00:00:00Z",
        }}
        form={{
          public_ordering_enabled: true,
          webhook_url: "https://example.com/webhooks/orders",
          webhook_secret_header_name: "X-HotelMS-Webhook-Secret",
        }}
        opsLoading={false}
        ops={{
          secret: {
            has_secret: true,
            header_name: "X-HotelMS-Webhook-Secret",
            masked_value: "****9ab4",
            rotated_at: "2026-04-01T06:10:00Z",
          },
          last_delivery: {
            id: 2,
            event_type: "hotelms.integration.ping",
            request_url: "https://example.com/webhooks/orders",
            delivery_status: "success",
            attempt_number: 1,
            is_retry: false,
            retried_from_delivery_id: null,
            http_status_code: 200,
            error_message: null,
            response_excerpt: "ok",
            response_time_ms: 120,
            triggered_by: {
              user_id: 2,
              full_name: "Security Lead",
              email: "security.lead@example.com",
            },
            created_at: "2026-04-01T08:00:00Z",
          },
          recent_deliveries: [
            {
              id: 3,
              event_type: "hotelms.integration.ping",
              request_url: "https://example.com/webhooks/orders",
              delivery_status: "failed",
              attempt_number: 2,
              is_retry: true,
              retried_from_delivery_id: 1,
              http_status_code: 500,
              error_message: "Webhook returned HTTP 500.",
              response_excerpt: "server error",
              response_time_ms: 90,
              triggered_by: {
                user_id: 2,
                full_name: "Security Lead",
                email: "security.lead@example.com",
              },
              created_at: "2026-04-01T09:00:00Z",
            },
          ],
          failure_trend: [
            { date: "2026-03-27", failed_count: 0 },
            { date: "2026-03-28", failed_count: 1 },
            { date: "2026-03-29", failed_count: 2 },
            { date: "2026-03-30", failed_count: 0 },
            { date: "2026-03-31", failed_count: 1 },
            { date: "2026-04-01", failed_count: 3 },
            { date: "2026-04-02", failed_count: 1 },
          ],
        }}
        savingIntegration={false}
        refreshingWebhook={false}
        sendingTestDelivery={false}
        retryingDeliveryId={null}
        apiKeyAction={null}
        webhookSecretAction={null}
        message={null}
        revealedApiKey={null}
        revealedWebhookSecret={null}
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        onRefreshWebhook={vi.fn()}
        onGenerateApiKey={vi.fn()}
        onRotateApiKey={vi.fn()}
        onRevokeApiKey={vi.fn()}
        onGenerateWebhookSecret={vi.fn()}
        onRotateWebhookSecret={vi.fn()}
        onRevokeWebhookSecret={vi.fn()}
        onSendTestDelivery={vi.fn()}
        onRetryDelivery={onRetryDelivery}
      />,
    );

    expect(screen.getByText("Webhook Secret Header")).toBeTruthy();
    expect(screen.getByText("Recent Deliveries")).toBeTruthy();
    expect(screen.getByText("Failure Trend")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetryDelivery).toHaveBeenCalledWith(3);
  });
});
