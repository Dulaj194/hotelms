import { FormField } from "@/features/super-admin/restaurants/components/FormField";
import {
  formatWebhookStatusLabel,
  getWebhookStatusBadgeClass,
} from "@/features/super-admin/restaurants/helpers";
import type {
  InlineMessage,
  IntegrationFormState,
} from "@/features/super-admin/restaurants/types";
import type { RestaurantMeResponse } from "@/types/restaurant";

type IntegrationPanelProps = {
  selected: RestaurantMeResponse | null;
  form: IntegrationFormState;
  savingIntegration: boolean;
  refreshingWebhook: boolean;
  apiKeyAction: "generate" | "rotate" | "revoke" | null;
  message: InlineMessage;
  revealedApiKey: string | null;
  onFormChange: (next: IntegrationFormState) => void;
  onSave: () => void;
  onRefreshWebhook: () => void;
  onGenerateApiKey: () => void;
  onRotateApiKey: () => void;
  onRevokeApiKey: () => void;
};

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function IntegrationPanel({
  selected,
  form,
  savingIntegration,
  refreshingWebhook,
  apiKeyAction,
  message,
  revealedApiKey,
  onFormChange,
  onSave,
  onRefreshWebhook,
  onGenerateApiKey,
  onRotateApiKey,
  onRevokeApiKey,
}: IntegrationPanelProps) {
  if (!selected) return null;

  const apiKeySummary = selected.integration.api_key;
  const integrationSettings = selected.integration.settings;

  return (
    <div className="rounded-lg border bg-white p-5 space-y-5">
      <div>
        <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
          Integrations
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage API keys, public ordering access, and webhook monitoring for{" "}
          <span className="font-medium text-slate-700">{selected.name}</span>.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
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

        <section className="rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Webhook Health</p>
              <p className="mt-1 text-xs text-slate-500">
                Save endpoint settings and run a health check when the integration is ready.
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

          <FormField
            label="Webhook URL"
            value={form.webhook_url}
            placeholder="https://example.com/api/order-events"
            onChange={(value) => onFormChange({ ...form, webhook_url: value })}
          />

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
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
          </div>
        </section>
      </div>
    </div>
  );
}
