import { FormField } from "@/features/super-admin/restaurants/components/FormField";
import {
  formatWebhookDeliveryLabel,
  formatWebhookStatusLabel,
  getWebhookDeliveryBadgeClass,
  getWebhookStatusBadgeClass,
} from "@/features/super-admin/restaurants/helpers";
import type {
  InlineMessage,
  IntegrationFormState,
} from "@/features/super-admin/restaurants/types";
import type {
  RestaurantIntegrationOpsResponse,
  RestaurantMeResponse,
} from "@/types/restaurant";

type IntegrationPanelProps = {
  selected: RestaurantMeResponse | null;
  form: IntegrationFormState;
  ops: RestaurantIntegrationOpsResponse | null;
  opsLoading: boolean;
  savingIntegration: boolean;
  refreshingWebhook: boolean;
  sendingTestDelivery: boolean;
  retryingDeliveryId: number | null;
  apiKeyAction: "generate" | "rotate" | "revoke" | null;
  webhookSecretAction: "generate" | "rotate" | "revoke" | null;
  message: InlineMessage;
  revealedApiKey: string | null;
  revealedWebhookSecret: string | null;
  onFormChange: (next: IntegrationFormState) => void;
  onSave: () => void;
  onRefreshWebhook: () => void;
  onGenerateApiKey: () => void;
  onRotateApiKey: () => void;
  onRevokeApiKey: () => void;
  onGenerateWebhookSecret: () => void;
  onRotateWebhookSecret: () => void;
  onRevokeWebhookSecret: () => void;
  onSendTestDelivery: () => void;
  onRetryDelivery: (deliveryId: number) => void;
};

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatResponseTime(value: number | null): string {
  return value === null ? "-" : `${value} ms`;
}

export function IntegrationPanel({
  selected,
  form,
  ops,
  opsLoading,
  savingIntegration,
  refreshingWebhook,
  sendingTestDelivery,
  retryingDeliveryId,
  apiKeyAction,
  webhookSecretAction,
  message,
  revealedApiKey,
  revealedWebhookSecret,
  onFormChange,
  onSave,
  onRefreshWebhook,
  onGenerateApiKey,
  onRotateApiKey,
  onRevokeApiKey,
  onGenerateWebhookSecret,
  onRotateWebhookSecret,
  onRevokeWebhookSecret,
  onSendTestDelivery,
  onRetryDelivery,
}: IntegrationPanelProps) {
  if (!selected) return null;

  const apiKeySummary = selected.integration.api_key;
  const integrationSettings = selected.integration.settings;
  const webhookSecret = ops?.secret ?? selected.integration.webhook_secret;
  const failureTrend = ops?.failure_trend ?? [];
  const maxTrendCount = Math.max(...failureTrend.map((item) => item.failed_count), 1);

  return (
    <div className="rounded-lg border bg-white p-5 space-y-5">
      <div>
        <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
          Integrations
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage API keys, webhook secrets, delivery health, and retry history for{" "}
          <span className="font-medium text-slate-700">{selected.name}</span>.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Restaurant API Key</p>
              <p className="mt-1 text-xs text-slate-500">
                Generate a key for QR/public integrations. Rotating immediately replaces the old key.
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                apiKeySummary.is_active
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {apiKeySummary.is_active ? "Active" : "Not Active"}
            </span>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current Key
              </dt>
              <dd className="mt-1 font-mono text-slate-900">
                {apiKeySummary.masked_key ?? "No key issued"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Last Rotated
              </dt>
              <dd className="mt-1 text-slate-700">{formatDateTime(apiKeySummary.rotated_at)}</dd>
            </div>
          </dl>

          {revealedApiKey && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Copy Now
              </p>
              <p className="mt-1 text-xs text-amber-700">
                This full key is only shown after generation or rotation.
              </p>
              <code className="mt-2 block overflow-x-auto rounded bg-white px-3 py-2 text-xs text-slate-800">
                {revealedApiKey}
              </code>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGenerateApiKey}
              disabled={apiKeyAction !== null}
              className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {apiKeyAction === "generate" ? "Generating..." : apiKeySummary.has_key ? "Regenerate" : "Generate Key"}
            </button>
            <button
              type="button"
              onClick={onRotateApiKey}
              disabled={apiKeyAction !== null || !apiKeySummary.has_key}
              className="rounded-md border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              {apiKeyAction === "rotate" ? "Rotating..." : "Rotate Key"}
            </button>
            <button
              type="button"
              onClick={onRevokeApiKey}
              disabled={apiKeyAction !== null || !apiKeySummary.has_key}
              className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {apiKeyAction === "revoke" ? "Revoking..." : "Revoke Key"}
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Webhook Secret Header</p>
              <p className="mt-1 text-xs text-slate-500">
                Add a shared secret header so external webhook consumers can verify incoming requests.
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                webhookSecret.has_secret
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {webhookSecret.has_secret ? "Configured" : "Not Configured"}
            </span>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Header Name
              </dt>
              <dd className="mt-1 font-mono text-slate-900">
                {(webhookSecret.header_name ?? form.webhook_secret_header_name) || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current Secret
              </dt>
              <dd className="mt-1 font-mono text-slate-900">
                {webhookSecret.masked_value ?? "No secret issued"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Last Rotated
              </dt>
              <dd className="mt-1 text-slate-700">
                {formatDateTime(webhookSecret.rotated_at)}
              </dd>
            </div>
          </dl>

          {revealedWebhookSecret && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Copy Shared Secret
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Save this value in the external integration. It is only shown after generation or rotation.
              </p>
              <code className="mt-2 block overflow-x-auto rounded bg-white px-3 py-2 text-xs text-slate-800">
                {revealedWebhookSecret}
              </code>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGenerateWebhookSecret}
              disabled={webhookSecretAction !== null}
              className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {webhookSecretAction === "generate"
                ? "Generating..."
                : webhookSecret.has_secret
                  ? "Regenerate Secret"
                  : "Generate Secret"}
            </button>
            <button
              type="button"
              onClick={onRotateWebhookSecret}
              disabled={webhookSecretAction !== null || !webhookSecret.has_secret}
              className="rounded-md border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              {webhookSecretAction === "rotate" ? "Rotating..." : "Rotate Secret"}
            </button>
            <button
              type="button"
              onClick={onRevokeWebhookSecret}
              disabled={webhookSecretAction !== null || !webhookSecret.has_secret}
              className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {webhookSecretAction === "revoke" ? "Revoking..." : "Revoke Secret"}
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Webhook Delivery Ops</p>
            <p className="mt-1 text-xs text-slate-500">
              Save endpoint settings, run a health check, and inspect delivery attempts with retry history.
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getWebhookStatusBadgeClass(
              integrationSettings.webhook_status,
            )}`}
          >
            {formatWebhookStatusLabel(integrationSettings.webhook_status)}
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.public_ordering_enabled}
            onChange={(event) =>
              onFormChange({
                ...form,
                public_ordering_enabled: event.target.checked,
              })
            }
          />
          Enable public ordering / integration access
        </label>

        <div className="grid gap-4 lg:grid-cols-2">
          <FormField
            label="Webhook URL"
            value={form.webhook_url}
            placeholder="https://example.com/api/order-events"
            onChange={(value) => onFormChange({ ...form, webhook_url: value })}
          />
          <FormField
            label="Secret Header Name"
            value={form.webhook_secret_header_name}
            placeholder="X-HotelMS-Webhook-Secret"
            onChange={(value) =>
              onFormChange({ ...form, webhook_secret_header_name: value })
            }
          />
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Saved Endpoint
            </dt>
            <dd className="mt-1 break-all text-slate-700">
              {integrationSettings.webhook_url ?? "-"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last Checked
            </dt>
            <dd className="mt-1 text-slate-700">
              {formatDateTime(integrationSettings.webhook_last_checked_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last Delivered Event
            </dt>
            <dd className="mt-1 text-slate-700">
              {ops?.last_delivery?.event_type ?? "No successful delivery yet"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last Delivered At
            </dt>
            <dd className="mt-1 text-slate-700">
              {formatDateTime(ops?.last_delivery?.created_at ?? null)}
            </dd>
          </div>
        </dl>

        {integrationSettings.webhook_last_error && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {integrationSettings.webhook_last_error}
          </p>
        )}

        {message && (
          <p className={`text-xs ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={savingIntegration}
            className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {savingIntegration ? "Saving..." : "Save Integration Settings"}
          </button>
          <button
            type="button"
            onClick={onRefreshWebhook}
            disabled={refreshingWebhook}
            className="rounded-md border border-sky-300 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
          >
            {refreshingWebhook ? "Checking..." : "Refresh Health"}
          </button>
          <button
            type="button"
            onClick={onSendTestDelivery}
            disabled={sendingTestDelivery}
            className="rounded-md border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {sendingTestDelivery ? "Sending..." : "Send Test Delivery"}
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Recent Deliveries</h3>
              {opsLoading && <span className="text-xs text-slate-500">Loading...</span>}
            </div>
            <div className="mt-3 space-y-3">
              {!opsLoading && (!ops || ops.recent_deliveries.length === 0) && (
                <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                  No webhook deliveries recorded yet.
                </div>
              )}
              {ops?.recent_deliveries.map((delivery) => (
                <article key={delivery.id} className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{delivery.event_type}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getWebhookDeliveryBadgeClass(
                            delivery.delivery_status,
                          )}`}
                        >
                          {formatWebhookDeliveryLabel(delivery.delivery_status)}
                        </span>
                        {delivery.is_retry && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            Retry #{delivery.attempt_number}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {delivery.triggered_by.full_name ?? "System"} | {formatDateTime(delivery.created_at)}
                      </p>
                    </div>
                    {delivery.delivery_status === "failed" && (
                      <button
                        type="button"
                        onClick={() => onRetryDelivery(delivery.id)}
                        disabled={retryingDeliveryId === delivery.id}
                        className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      >
                        {retryingDeliveryId === delivery.id ? "Retrying..." : "Retry"}
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                    <p>Status Code: {delivery.http_status_code ?? "-"}</p>
                    <p>Response Time: {formatResponseTime(delivery.response_time_ms)}</p>
                    <p className="md:col-span-2 break-all">Target: {delivery.request_url}</p>
                    {delivery.error_message && (
                      <p className="md:col-span-2 text-red-600">Error: {delivery.error_message}</p>
                    )}
                    {delivery.response_excerpt && (
                      <p className="md:col-span-2 text-slate-600">
                        Response: {delivery.response_excerpt}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Failure Trend</h3>
            <p className="mt-1 text-xs text-slate-500">
              Failed delivery attempts over the last 7 days.
            </p>
            <div className="mt-4 space-y-3">
              {failureTrend.map((item) => (
                <div key={item.date}>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{item.date}</span>
                    <span>{item.failed_count} failed</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-red-500"
                      style={{
                        width: `${item.failed_count === 0 ? 0 : Math.max((item.failed_count / maxTrendCount) * 100, 8)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
