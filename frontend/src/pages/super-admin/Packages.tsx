import { useEffect, useMemo, useState } from "react";

import ActionDialog from "@/components/shared/ActionDialog";
import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { PackageCatalog } from "@/features/super-admin/packages/components/PackageCatalog";
import {
  PackageFormCard,
  PackageFormFields,
} from "@/features/super-admin/packages/components/PackageFormCard";
import { PackageMetricCard } from "@/features/super-admin/packages/components/PackageMetricCard";
import {
  buildPackageCreatePayload,
  buildPackageUpdatePayload,
  EMPTY_PACKAGE_FORM,
  mapPackageToFormState,
  type PackageFormState,
} from "@/features/super-admin/packages/formState";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/pages/super-admin/utils";
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
          <PackageMetricCard
            label="Total Packages"
            value={metrics.total}
            hint="Visible to super admin"
          />
          <PackageMetricCard
            label="Active Packages"
            value={metrics.active}
            hint="Available for assignment"
          />
          <PackageMetricCard
            label="Inactive Packages"
            value={metrics.inactive}
            hint="Retained but hidden"
          />
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
          <PackageCatalog
            items={items}
            deletingId={deletingId}
            onEdit={openEditDialog}
            onDelete={(pkg) => void handleDelete(pkg)}
          />
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
