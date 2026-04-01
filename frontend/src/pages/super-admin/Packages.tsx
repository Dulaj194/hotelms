import { useEffect, useMemo, useState } from "react";

import ActionDialog from "@/components/shared/ActionDialog";
import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import {
  buildPackageCreatePayload,
  buildPackageUpdatePayload,
  EMPTY_PACKAGE_FORM,
  mapPackageToFormState,
  type PackageFormState,
} from "@/features/super-admin/packages/formState";
import { api } from "@/lib/api";
import { badgeClassName, formatDate, getApiErrorMessage } from "@/pages/super-admin/utils";
import type {
  PackageAdminListResponse,
  PackageDeleteResponse,
  PackageDetailResponse,
  PackagePrivilegeCatalogResponse,
} from "@/types/subscription";

type PageMessage = {
  type: "ok" | "err";
  text: string;
} | null;

export default function PackagesPage() {
  const [items, setItems] = useState<PackageDetailResponse[]>([]);
  const [privilegeOptions, setPrivilegeOptions] = useState<
    PackagePrivilegeCatalogResponse["items"]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<PageMessage>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createForm, setCreateForm] = useState<PackageFormState>(EMPTY_PACKAGE_FORM);

  const [editingPackage, setEditingPackage] = useState<PackageDetailResponse | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PackageFormState>(EMPTY_PACKAGE_FORM);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    void loadPackages();
  }, []);

  async function loadPackages() {
    setLoading(true);
    setError(null);
    try {
      const [packages, privilegeCatalog] = await Promise.all([
        api.get<PackageAdminListResponse>("/packages/admin"),
        api.get<PackagePrivilegeCatalogResponse>("/packages/admin/privileges"),
      ]);
      setItems(packages.items);
      setPrivilegeOptions(privilegeCatalog.items);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load packages."));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateBusy(true);
    setPageMessage(null);
    try {
      const created = await api.post<PackageDetailResponse>(
        "/packages/admin",
        buildPackageCreatePayload(createForm),
      );
      setItems((current) => [created, ...current]);
      setCreateForm(EMPTY_PACKAGE_FORM);
      setShowCreateForm(false);
      setPageMessage({ type: "ok", text: `Package ${created.name} created.` });
    } catch (createError) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(createError, "Failed to create package."),
      });
    } finally {
      setCreateBusy(false);
    }
  }

  function openEditDialog(pkg: PackageDetailResponse) {
    setEditingPackage(pkg);
    setEditError(null);
    setEditForm(mapPackageToFormState(pkg));
  }

  async function handleEditSave() {
    if (!editingPackage) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const updated = await api.patch<PackageDetailResponse>(
        `/packages/admin/${editingPackage.id}`,
        buildPackageUpdatePayload(editForm),
      );
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setPageMessage({ type: "ok", text: `Package ${updated.name} updated.` });
      setEditingPackage(null);
    } catch (saveError) {
      setEditError(getApiErrorMessage(saveError, "Failed to update package."));
    } finally {
      setEditBusy(false);
    }
  }

  async function handleDelete(pkg: PackageDetailResponse) {
    setDeletingId(pkg.id);
    setPageMessage(null);
    try {
      const result = await api.delete<PackageDeleteResponse>(`/packages/admin/${pkg.id}`);
      setItems((current) => current.filter((item) => item.id !== pkg.id));
      setPageMessage({ type: "ok", text: result.message });
    } catch (deleteError) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(deleteError, "Failed to delete package."),
      });
    } finally {
      setDeletingId(null);
    }
  }

  const metrics = useMemo(() => {
    const active = items.filter((item) => item.is_active).length;
    const inactive = items.filter((item) => !item.is_active).length;
    return { total: items.length, active, inactive };
  }, [items]);

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="app-page-title text-slate-900">Packages</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Manage subscription plans, pricing, billing cadence, and privilege bundles.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadPackages()} className="app-btn-ghost">
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
                {showCreateForm ? "Close Form" : "New Package"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Total Packages" value={metrics.total} hint="Visible to super admin" />
          <MetricCard label="Active Packages" value={metrics.active} hint="Available for assignment" />
          <MetricCard label="Inactive Packages" value={metrics.inactive} hint="Retained but hidden" />
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
          <PackageFormCard
            title="Create Package"
            description="Add a new plan and attach the feature privileges it unlocks."
            form={createForm}
            privilegeOptions={privilegeOptions}
            submitLabel={createBusy ? "Creating..." : "Create Package"}
            busy={createBusy}
            onChange={setCreateForm}
            onSubmit={(event) => void handleCreate(event)}
            onCancel={() => {
              setShowCreateForm(false);
              setCreateForm(EMPTY_PACKAGE_FORM);
            }}
          />
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading packages...
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
                <h2 className="app-section-title text-slate-900">Package Catalog</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review privilege bundles before assigning subscriptions to hotels.
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-500">{items.length} packages</span>
            </div>

            {items.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No packages created yet.
              </div>
            ) : (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {items.map((pkg) => (
                  <article key={pkg.id} className="rounded-xl border border-slate-200 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">{pkg.name}</h3>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                              pkg.is_active ? "green" : "slate",
                            )}`}
                          >
                            {pkg.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                          {pkg.code}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">${pkg.price}</p>
                        <p className="text-xs text-slate-500">{pkg.billing_period_days} day billing cycle</p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-slate-600">{pkg.description || "No description provided."}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {pkg.privileges.map((privilege) => (
                        <span
                          key={privilege}
                          className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                        >
                          {privilege}
                        </span>
                      ))}
                      {pkg.privileges.length === 0 && (
                        <span className="text-xs text-slate-400">No privileges attached</span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <span>Created {formatDate(pkg.created_at)}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditDialog(pkg)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(pkg)}
                          disabled={deletingId === pkg.id}
                          className="rounded-md border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === pkg.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {editingPackage && (
          <ActionDialog
            title={`Edit ${editingPackage.name}`}
            description="Update package pricing, active status, and attached privileges."
            error={editError}
            busy={editBusy}
            onClose={() => {
              if (editBusy) return;
              setEditingPackage(null);
              setEditError(null);
            }}
            onConfirm={() => void handleEditSave()}
            confirmLabel={editBusy ? "Saving..." : "Save Changes"}
            confirmTone="primary"
            maxWidthClassName="max-w-3xl"
          >
            <PackageFormFields
              form={editForm}
              privilegeOptions={privilegeOptions}
              onChange={setEditForm}
              disableCode={false}
            />
          </ActionDialog>
        )}
      </div>
    </SuperAdminLayout>
  );
}

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

function PackageFormCard({
  title,
  description,
  form,
  privilegeOptions,
  submitLabel,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: string;
  form: PackageFormState;
  privilegeOptions: PackagePrivilegeCatalogResponse["items"];
  submitLabel: string;
  busy: boolean;
  onChange: (next: PackageFormState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="app-section-title text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="mt-5">
        <PackageFormFields form={form} privilegeOptions={privilegeOptions} onChange={onChange} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="app-btn-base bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="app-btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

function PackageFormFields({
  form,
  privilegeOptions,
  onChange,
  disableCode = false,
}: {
  form: PackageFormState;
  privilegeOptions: PackagePrivilegeCatalogResponse["items"];
  onChange: (next: PackageFormState) => void;
  disableCode?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LabeledInput
        label="Package Name"
        value={form.name}
        onChange={(value) => onChange({ ...form, name: value })}
      />
      <LabeledInput
        label="Package Code"
        value={form.code}
        onChange={(value) => onChange({ ...form, code: value })}
        disabled={disableCode}
      />
      <LabeledInput
        label="Price"
        type="number"
        value={form.price}
        onChange={(value) => onChange({ ...form, price: value })}
      />
      <LabeledInput
        label="Billing Days"
        type="number"
        value={form.billing_period_days}
        onChange={(value) => onChange({ ...form, billing_period_days: value })}
      />
      <label className="space-y-2 md:col-span-2">
        <span className="block text-sm font-medium text-slate-700">Description</span>
        <textarea
          rows={3}
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </label>
      <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => onChange({ ...form, is_active: event.target.checked })}
        />
        Package is active
      </label>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
        <p className="text-sm font-medium text-slate-700">Privileges</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {privilegeOptions.map((option) => {
            const checked = form.privileges.includes(option.code);
            return (
              <label
                key={option.code}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const nextPrivileges = event.target.checked
                        ? [...form.privileges, option.code]
                        : form.privileges.filter((value) => value !== option.code);
                      onChange({ ...form, privileges: nextPrivileges });
                    }}
                  />
                  <div>
                    <p className="font-semibold text-slate-900">{option.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{option.description}</p>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}
