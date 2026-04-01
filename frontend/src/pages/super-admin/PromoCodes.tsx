import { useEffect, useMemo, useState } from "react";

import ActionDialog from "@/components/shared/ActionDialog";
import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { api } from "@/lib/api";
import type {
  PromoCodeCreateRequest,
  PromoCodeListResponse,
  PromoCodeResponse,
  PromoCodeUpdateRequest,
} from "@/types/promo";

import {
  badgeClassName,
  formatDate,
  getApiErrorMessage,
  getPromoLifecycle,
} from "@/pages/super-admin/utils";

type MessageState = {
  type: "ok" | "err";
  text: string;
} | null;

type PromoFormState = {
  code: string;
  discount_percent: string;
  valid_from: string;
  valid_until: string;
  usage_limit: string;
  is_active: boolean;
};

const EMPTY_FORM: PromoFormState = {
  code: "",
  discount_percent: "",
  valid_from: "",
  valid_until: "",
  usage_limit: "",
  is_active: true,
};

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

function buildCreatePayload(form: PromoFormState): PromoCodeCreateRequest {
  return {
    code: form.code.trim().toUpperCase(),
    discount_percent: Number(form.discount_percent),
    valid_from: form.valid_from,
    valid_until: form.valid_until,
    usage_limit: form.usage_limit.trim() ? Number(form.usage_limit) : null,
    is_active: form.is_active,
  };
}

function buildUpdatePayload(form: PromoFormState): PromoCodeUpdateRequest {
  return {
    discount_percent: Number(form.discount_percent),
    valid_from: form.valid_from || null,
    valid_until: form.valid_until || null,
    usage_limit: form.usage_limit.trim() ? Number(form.usage_limit) : null,
    is_active: form.is_active,
  };
}

function mapPromoToFormState(promo: PromoCodeResponse): PromoFormState {
  return {
    code: promo.code,
    discount_percent: String(promo.discount_percent),
    valid_from: promo.valid_from,
    valid_until: promo.valid_until,
    usage_limit: promo.usage_limit !== null ? String(promo.usage_limit) : "",
    is_active: promo.is_active,
  };
}

export default function PromoCodesPage() {
  const [items, setItems] = useState<PromoCodeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<MessageState>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<PromoFormState>(EMPTY_FORM);
  const [createBusy, setCreateBusy] = useState(false);

  const [editingPromo, setEditingPromo] = useState<PromoCodeResponse | null>(null);
  const [editForm, setEditForm] = useState<PromoFormState>(EMPTY_FORM);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    void loadPromos();
  }, []);

  async function loadPromos() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<PromoCodeListResponse>("/promo-codes");
      setItems(response.items);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load promo codes."));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreateBusy(true);
    setPageMessage(null);
    try {
      const created = await api.post<PromoCodeResponse>("/promo-codes", buildCreatePayload(createForm));
      setItems((current) => [created, ...current]);
      setCreateForm(EMPTY_FORM);
      setShowCreateForm(false);
      setPageMessage({ type: "ok", text: `Promo code ${created.code} created.` });
    } catch (createError) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(createError, "Failed to create promo code."),
      });
    } finally {
      setCreateBusy(false);
    }
  }

  function openEditDialog(item: PromoCodeResponse) {
    setEditError(null);
    setEditingPromo(item);
    setEditForm(mapPromoToFormState(item));
  }

  async function handleEditSave() {
    if (!editingPromo) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const updated = await api.patch<PromoCodeResponse>(
        `/promo-codes/${editingPromo.id}`,
        buildUpdatePayload(editForm),
      );
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setPageMessage({ type: "ok", text: `Promo code ${updated.code} updated.` });
      setEditingPromo(null);
    } catch (saveError) {
      setEditError(getApiErrorMessage(saveError, "Failed to update promo code."));
    } finally {
      setEditBusy(false);
    }
  }

  const metrics = useMemo(() => {
    const active = items.filter((item) => getPromoLifecycle(item).label === "Active").length;
    const scheduled = items.filter((item) => getPromoLifecycle(item).label === "Scheduled").length;
    const exhausted = items.filter((item) => getPromoLifecycle(item).label === "Exhausted").length;
    return {
      total: items.length,
      active,
      scheduled,
      exhausted,
    };
  }, [items]);

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="app-page-title text-slate-900">Promo Codes</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Manage platform-wide discount campaigns for hotel onboarding and subscription
                promotions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadPromos()} className="app-btn-ghost">
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  setPageMessage(null);
                  setShowCreateForm((current) => !current);
                }}
                className="app-btn-base bg-slate-900 text-white hover:bg-slate-800"
              >
                {showCreateForm ? "Close Form" : "New Promo Code"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Promos" value={metrics.total} hint="All campaigns" />
          <MetricCard label="Active Now" value={metrics.active} hint="Currently valid" />
          <MetricCard label="Scheduled" value={metrics.scheduled} hint="Upcoming launches" />
          <MetricCard label="Exhausted" value={metrics.exhausted} hint="Usage cap reached" />
        </div>

        {pageMessage && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              pageMessage.type === "ok"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {pageMessage.text}
          </div>
        )}

        {showCreateForm && (
          <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="app-section-title text-slate-900">Create Promo Code</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Codes are global and can be consumed by approved hotel tenants.
                </p>
              </div>
            </div>

            <div className="app-form-grid mt-5">
              <PromoInput
                label="Code"
                value={createForm.code}
                onChange={(value) => setCreateForm((current) => ({ ...current, code: value }))}
                placeholder="WELCOME30"
                required
              />
              <PromoInput
                label="Discount %"
                value={createForm.discount_percent}
                onChange={(value) =>
                  setCreateForm((current) => ({ ...current, discount_percent: value }))
                }
                placeholder="25"
                required
                type="number"
              />
              <PromoInput
                label="Valid From"
                value={createForm.valid_from}
                onChange={(value) => setCreateForm((current) => ({ ...current, valid_from: value }))}
                required
                type="date"
              />
              <PromoInput
                label="Valid Until"
                value={createForm.valid_until}
                onChange={(value) =>
                  setCreateForm((current) => ({ ...current, valid_until: value }))
                }
                required
                type="date"
              />
              <PromoInput
                label="Usage Limit"
                value={createForm.usage_limit}
                onChange={(value) =>
                  setCreateForm((current) => ({ ...current, usage_limit: value }))
                }
                placeholder="Leave blank for unlimited"
                type="number"
              />
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={createForm.is_active}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, is_active: event.target.checked }))
                  }
                />
                Promo is active immediately
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={createBusy}
                className="app-btn-base bg-blue-600 text-white hover:bg-blue-700"
              >
                {createBusy ? "Creating..." : "Create Promo"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateForm(EMPTY_FORM);
                }}
                className="app-btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading promo codes...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="app-section-title text-slate-900">Promo Inventory</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review usage windows, activity status, and utilization.
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-500">{items.length} codes</span>
            </div>

            {items.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No promo codes created yet.
              </div>
            ) : (
              <div className="app-table-scroll mt-5">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Code</th>
                      <th className="px-3 py-3">Discount</th>
                      <th className="px-3 py-3">Window</th>
                      <th className="px-3 py-3">Usage</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item) => {
                      const lifecycle = getPromoLifecycle(item);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-900">{item.code}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Created {formatDate(item.created_at)}
                            </p>
                          </td>
                          <td className="px-3 py-3 font-medium text-slate-900">
                            {item.discount_percent}%
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {formatDate(item.valid_from)} - {formatDate(item.valid_until)}
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {item.used_count}
                            {item.usage_limit !== null ? ` / ${item.usage_limit}` : " / unlimited"}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                                lifecycle.tone,
                              )}`}
                            >
                              {lifecycle.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openEditDialog(item)}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {editingPromo && (
          <ActionDialog
            title={`Edit ${editingPromo.code}`}
            description="Update lifecycle dates, active state, and usage limits."
            error={editError}
            busy={editBusy}
            onClose={() => {
              if (editBusy) return;
              setEditingPromo(null);
              setEditError(null);
            }}
            onConfirm={() => void handleEditSave()}
            confirmLabel={editBusy ? "Saving..." : "Save Changes"}
            confirmTone="primary"
            maxWidthClassName="max-w-2xl"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <PromoInput
                label="Code"
                value={editForm.code}
                onChange={() => {}}
                disabled
              />
              <PromoInput
                label="Discount %"
                value={editForm.discount_percent}
                onChange={(value) => setEditForm((current) => ({ ...current, discount_percent: value }))}
                type="number"
              />
              <PromoInput
                label="Valid From"
                value={editForm.valid_from}
                onChange={(value) => setEditForm((current) => ({ ...current, valid_from: value }))}
                type="date"
              />
              <PromoInput
                label="Valid Until"
                value={editForm.valid_until}
                onChange={(value) => setEditForm((current) => ({ ...current, valid_until: value }))}
                type="date"
              />
              <PromoInput
                label="Usage Limit"
                value={editForm.usage_limit}
                onChange={(value) => setEditForm((current) => ({ ...current, usage_limit: value }))}
                placeholder="Leave blank for unlimited"
                type="number"
              />
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, is_active: event.target.checked }))
                  }
                />
                Promo is active
              </label>
            </div>
          </ActionDialog>
        )}
      </div>
    </SuperAdminLayout>
  );
}

function PromoInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}
