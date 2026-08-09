import { 
  KeyRound, 
  Shield, 
  Webhook, 
  Activity, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  Save,
  CheckCircle2,
  XCircle
} from "lucide-react";

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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-0">
      
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          <Webhook className="h-5 w-5 text-slate-400" />
          Integrations & Webhooks
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage API keys, webhook secrets, delivery health, and retry history for{" "}
          <span className="font-medium text-slate-700">{selected.name}</span>.
        </p>
      </div>

      <div className="p-5 space-y-6">
        
        {/* API & Secrets Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* Restaurant API Key Card */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                <KeyRound className="h-4 w-4 text-slate-400" />
                Restaurant API Key
              </h3>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${
                apiKeySummary.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'
              }`}>
                {apiKeySummary.is_active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {apiKeySummary.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
              <p className="text-xs text-slate-500 mb-4">
                Used for authenticating external QR or public integrations.
              </p>
              
              <div className="space-y-4 flex-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Current Key</p>
                  <code className="block rounded bg-slate-50 px-3 py-2 text-sm font-mono text-slate-800 border border-slate-200">
                    {apiKeySummary.masked_key ?? "No key issued"}
                  </code>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Last Rotated</p>
                  <p className="text-sm text-slate-700">{formatDateTime(apiKeySummary.rotated_at)}</p>
                </div>
              </div>

              {revealedApiKey && (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Key Revealed
                  </p>
                  <code className="mt-2 block rounded bg-white px-3 py-2 text-xs font-mono text-slate-800 border border-amber-200 break-all select-all">
                    {revealedApiKey}
                  </code>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onGenerateApiKey}
                  disabled={apiKeyAction !== null}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  {apiKeyAction === "generate" ? "Generating..." : apiKeySummary.has_key ? "Regenerate Key" : "Generate Key"}
                </button>
                <button
                  type="button"
                  onClick={onRotateApiKey}
                  disabled={apiKeyAction !== null || !apiKeySummary.has_key}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {apiKeyAction === "rotate" ? "Rotating..." : "Rotate"}
                </button>
                <button
                  type="button"
                  onClick={onRevokeApiKey}
                  disabled={apiKeyAction !== null || !apiKeySummary.has_key}
                  className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 ml-auto"
                >
                  {apiKeyAction === "revoke" ? "Revoking..." : "Revoke"}
                </button>
              </div>
            </div>
          </div>

          {/* Webhook Secret Card */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-slate-400" />
                Webhook Secret Header
              </h3>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${
                webhookSecret.has_secret ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'
              }`}>
                {webhookSecret.has_secret ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {webhookSecret.has_secret ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
              <p className="text-xs text-slate-500 mb-4">
                Used to sign outgoing webhooks so external consumers can verify the sender.
              </p>
              
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div className="col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Current Secret</p>
                  <code className="block rounded bg-slate-50 px-3 py-2 text-sm font-mono text-slate-800 border border-slate-200">
                    {webhookSecret.masked_value ?? "No secret issued"}
                  </code>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Header Name</p>
                  <p className="text-sm font-mono text-slate-700 bg-slate-50 border border-slate-100 rounded px-2 py-1 truncate">
                    {(webhookSecret.header_name ?? form.webhook_secret_header_name) || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Last Rotated</p>
                  <p className="text-sm text-slate-700 py-1">{formatDateTime(webhookSecret.rotated_at)}</p>
                </div>
              </div>

              {revealedWebhookSecret && (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Secret Revealed
                  </p>
                  <code className="mt-2 block rounded bg-white px-3 py-2 text-xs font-mono text-slate-800 border border-amber-200 break-all select-all">
                    {revealedWebhookSecret}
                  </code>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onGenerateWebhookSecret}
                  disabled={webhookSecretAction !== null}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  {webhookSecretAction === "generate" ? "Generating..." : webhookSecret.has_secret ? "Regenerate Secret" : "Generate Secret"}
                </button>
                <button
                  type="button"
                  onClick={onRotateWebhookSecret}
                  disabled={webhookSecretAction !== null || !webhookSecret.has_secret}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {webhookSecretAction === "rotate" ? "Rotating..." : "Rotate"}
                </button>
                <button
                  type="button"
                  onClick={onRevokeWebhookSecret}
                  disabled={webhookSecretAction !== null || !webhookSecret.has_secret}
                  className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 ml-auto"
                >
                  {webhookSecretAction === "revoke" ? "Revoking..." : "Revoke"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Webhook Delivery Ops Section */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-slate-400" />
              Webhook Delivery Configuration
            </h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${getWebhookStatusBadgeClass(integrationSettings.webhook_status)}`}>
              {formatWebhookStatusLabel(integrationSettings.webhook_status)}
            </span>
          </div>
          
          <div className="p-5">
            <div className="flex flex-col lg:flex-row gap-8">
              
              {/* Left Column: Settings Form */}
              <div className="flex-1 space-y-5">
                <div className="flex items-center">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={form.public_ordering_enabled}
                      onChange={(event) =>
                        onFormChange({
                          ...form,
                          public_ordering_enabled: event.target.checked,
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300"></div>
                    <span className="ml-3 text-sm font-medium text-slate-700">Enable public ordering / integration access</span>
                  </label>
                </div>
                
                <div className="space-y-4">
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

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={savingIntegration}
                    className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {savingIntegration ? "Saving..." : "Save Settings"}
                  </button>
                  <button
                    type="button"
                    onClick={onRefreshWebhook}
                    disabled={refreshingWebhook}
                    className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshingWebhook ? 'animate-spin' : ''}`} />
                    {refreshingWebhook ? "Checking..." : "Refresh Health"}
                  </button>
                  <button
                    type="button"
                    onClick={onSendTestDelivery}
                    disabled={sendingTestDelivery}
                    className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {sendingTestDelivery ? "Sending..." : "Test Delivery"}
                  </button>
                </div>

                {message && (
                  <div className={`mt-3 rounded-md p-3 text-sm flex items-start gap-2 ${message.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                    {message.type === "ok" ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                    <p>{message.text}</p>
                  </div>
                )}
                {integrationSettings.webhook_last_error && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p><strong>Last Error:</strong> {integrationSettings.webhook_last_error}</p>
                  </div>
                )}
              </div>

              {/* Right Column: Health Stats */}
              <div className="lg:w-72 flex-shrink-0">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Status</h4>
                  
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Saved Endpoint</dt>
                    <dd className="text-sm font-medium text-slate-900 break-all">{integrationSettings.webhook_url ?? "Not Configured"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Last Checked</dt>
                    <dd className="text-sm font-medium text-slate-900">{formatDateTime(integrationSettings.webhook_last_checked_at)}</dd>
                  </div>
                  <div className="pt-3 border-t border-slate-200">
                    <dt className="text-xs text-slate-500 mb-1">Last Delivered Event</dt>
                    <dd className="text-sm font-medium text-slate-900">{ops?.last_delivery?.event_type ?? "No successful delivery yet"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Last Delivered At</dt>
                    <dd className="text-sm font-medium text-slate-900">{formatDateTime(ops?.last_delivery?.created_at ?? null)}</dd>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>

        {/* Logs and Trends */}
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          
          {/* Recent Deliveries */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-full">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Recent Webhook Deliveries</h3>
              {opsLoading && <span className="text-xs text-slate-500 animate-pulse">Loading...</span>}
            </div>
            <div className="p-0 overflow-y-auto max-h-[400px]">
              {!opsLoading && (!ops || ops.recent_deliveries.length === 0) && (
                <div className="p-8 text-center text-sm text-slate-500">
                  <Activity className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  No webhook deliveries recorded yet.
                </div>
              )}
              
              {ops?.recent_deliveries.map((delivery, index) => (
                <div key={delivery.id} className={`p-4 ${index !== ops.recent_deliveries.length - 1 ? 'border-b border-slate-100' : ''} hover:bg-slate-50/50 transition-colors`}>
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getWebhookDeliveryBadgeClass(delivery.delivery_status)}`}>
                        {formatWebhookDeliveryLabel(delivery.delivery_status)}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{delivery.event_type}</span>
                      {delivery.is_retry && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider border border-slate-200">
                          Retry #{delivery.attempt_number}
                        </span>
                      )}
                    </div>
                    {delivery.delivery_status === "failed" && (
                      <button
                        type="button"
                        onClick={() => onRetryDelivery(delivery.id)}
                        disabled={retryingDeliveryId === delivery.id}
                        className="rounded bg-white border border-amber-300 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 shadow-sm"
                      >
                        {retryingDeliveryId === delivery.id ? "Retrying..." : "Retry Event"}
                      </button>
                    )}
                  </div>
                  
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mb-2">
                    <span>{formatDateTime(delivery.created_at)}</span>
                    <span>&bull;</span>
                    <span>Triggered by: {delivery.triggered_by.full_name ?? "System"}</span>
                    <span>&bull;</span>
                    <span className="font-mono">HTTP {delivery.http_status_code ?? "ERR"}</span>
                    <span>&bull;</span>
                    <span>{formatResponseTime(delivery.response_time_ms)}</span>
                  </div>
                  
                  <div className="text-xs font-mono text-slate-600 bg-slate-100 p-2 rounded break-all mt-2">
                    <span className="text-slate-400 font-sans text-[10px] uppercase tracking-wider block mb-1">Target URL</span>
                    {delivery.request_url}
                  </div>
                  
                  {delivery.error_message && (
                    <div className="mt-2 text-xs text-red-700 bg-red-50 p-2 rounded border border-red-100">
                      <strong>Error:</strong> {delivery.error_message}
                    </div>
                  )}
                  {delivery.response_excerpt && (
                    <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                      <strong>Response:</strong> {delivery.response_excerpt}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Failure Trend */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Failure Trend (Last 7 Days)</h3>
            </div>
            <div className="p-5 flex-1">
              {failureTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-500">
                  No data available.
                </div>
              ) : (
                <div className="space-y-4">
                  {failureTrend.map((item) => (
                    <div key={item.date} className="group">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium">{item.date}</span>
                        <span className={`font-semibold ${item.failed_count > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {item.failed_count} failed
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.failed_count > 0 ? 'bg-red-500' : 'bg-emerald-400'}`}
                          style={{
                            width: `${item.failed_count === 0 ? 100 : Math.max((item.failed_count / maxTrendCount) * 100, 10)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
