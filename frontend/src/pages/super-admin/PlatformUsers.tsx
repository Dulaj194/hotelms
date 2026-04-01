import { useEffect, useMemo, useState } from "react";

import ActionDialog from "@/components/shared/ActionDialog";
import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import {
  PlatformUserFormCard,
  PlatformUserFormFields,
} from "@/features/super-admin/platform-users/components/PlatformUserFormCard";
import { PlatformUserMetricCard } from "@/features/super-admin/platform-users/components/PlatformUserMetricCard";
import { PlatformUsersTable } from "@/features/super-admin/platform-users/components/PlatformUsersTable";
import {
  buildPlatformUserCreatePayload,
  buildPlatformUserUpdatePayload,
  EMPTY_PLATFORM_USER_FORM,
  mapPlatformUserToFormState,
  type PlatformUserFormState,
} from "@/features/super-admin/platform-users/formState";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/pages/super-admin/utils";
import type {
  GenericMessageResponse,
  PlatformUserListItemResponse,
  PlatformUserListResponse,
  StaffStatusResponse,
} from "@/types/user";

type PageMessage = {
  type: "ok" | "err";
  text: string;
} | null;

export default function PlatformUsersPage() {
  const [items, setItems] = useState<PlatformUserListResponse["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<PageMessage>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<PlatformUserFormState>(EMPTY_PLATFORM_USER_FORM);
  const [createBusy, setCreateBusy] = useState(false);

  const [editingUser, setEditingUser] = useState<PlatformUserListItemResponse | null>(null);
  const [editForm, setEditForm] = useState<PlatformUserFormState>(EMPTY_PLATFORM_USER_FORM);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<PlatformUserListResponse>("/users/platform");
      setItems(response.items);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load platform users."));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateBusy(true);
    setPageMessage(null);
    try {
      const created = await api.post<PlatformUserListItemResponse>(
        "/users/platform",
        buildPlatformUserCreatePayload(createForm),
      );
      setItems((current) => [created, ...current]);
      setShowCreateForm(false);
      setCreateForm(EMPTY_PLATFORM_USER_FORM);
      setPageMessage({ type: "ok", text: `Platform user ${created.full_name} created.` });
    } catch (createError) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(createError, "Failed to create platform user."),
      });
    } finally {
      setCreateBusy(false);
    }
  }

  function openEditDialog(user: PlatformUserListItemResponse) {
    setEditError(null);
    setEditingUser(user);
    setEditForm(mapPlatformUserToFormState(user));
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const updated = await api.patch<PlatformUserListItemResponse>(
        `/users/platform/${editingUser.id}`,
        buildPlatformUserUpdatePayload(editForm),
      );
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditingUser(null);
      setPageMessage({ type: "ok", text: `Platform user ${updated.full_name} updated.` });
    } catch (saveError) {
      setEditError(getApiErrorMessage(saveError, "Failed to update platform user."));
    } finally {
      setEditBusy(false);
    }
  }

  async function handleToggleStatus(userId: number, isActive: boolean) {
    setStatusBusyId(userId);
    setPageMessage(null);
    try {
      const action = isActive ? "disable" : "enable";
      const result = await api.patch<StaffStatusResponse>(
        `/users/platform/${userId}/${action}`,
        {},
      );
      setItems((current) =>
        current.map((item) => (item.id === userId ? { ...item, is_active: result.is_active } : item)),
      );
      setPageMessage({
        type: "ok",
        text: result.message,
      });
    } catch (statusError) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(statusError, "Failed to update platform user status."),
      });
    } finally {
      setStatusBusyId(null);
    }
  }

  async function handleDelete(userId: number) {
    setDeleteBusyId(userId);
    setPageMessage(null);
    try {
      const result = await api.delete<GenericMessageResponse>(`/users/platform/${userId}`);
      setItems((current) => current.filter((item) => item.id !== userId));
      setPageMessage({ type: "ok", text: result.message });
    } catch (deleteError) {
      setPageMessage({
        type: "err",
        text: getApiErrorMessage(deleteError, "Failed to delete platform user."),
      });
    } finally {
      setDeleteBusyId(null);
    }
  }

  const metrics = useMemo(() => {
    const active = items.filter((item) => item.is_active).length;
    const pendingPassword = items.filter((item) => item.must_change_password).length;
    return {
      total: items.length,
      active,
      pendingPassword,
    };
  }, [items]);

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="app-page-title text-slate-900">Platform Users</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Manage super admin accounts, activation state, and password rotation requirements.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadUsers()} className="app-btn-ghost">
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
                {showCreateForm ? "Close Form" : "New Platform User"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <PlatformUserMetricCard
            label="Platform Users"
            value={metrics.total}
            hint="All super admin accounts"
          />
          <PlatformUserMetricCard
            label="Active Accounts"
            value={metrics.active}
            hint="Currently enabled"
          />
          <PlatformUserMetricCard
            label="Password Reset Required"
            value={metrics.pendingPassword}
            hint="Must change password on next login"
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
          <PlatformUserFormCard
            title="Create Platform User"
            description="Provision a new super admin account for platform operations."
            form={createForm}
            submitLabel={createBusy ? "Creating..." : "Create Platform User"}
            busy={createBusy}
            onChange={setCreateForm}
            onSubmit={(event) => void handleCreate(event)}
            onCancel={() => {
              setShowCreateForm(false);
              setCreateForm(EMPTY_PLATFORM_USER_FORM);
            }}
          />
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading platform users...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <PlatformUsersTable
            items={items}
            statusBusyId={statusBusyId}
            deleteBusyId={deleteBusyId}
            onEdit={openEditDialog}
            onToggleStatus={(userId, isActive) => void handleToggleStatus(userId, isActive)}
            onDelete={(userId) => void handleDelete(userId)}
          />
        )}

        {editingUser && (
          <ActionDialog
            title={`Edit ${editingUser.full_name}`}
            description="Update identity fields, login policy, and active state."
            error={editError}
            busy={editBusy}
            onClose={() => {
              if (editBusy) return;
              setEditingUser(null);
              setEditError(null);
            }}
            onConfirm={() => void handleSaveEdit()}
            confirmLabel={editBusy ? "Saving..." : "Save Changes"}
            confirmTone="primary"
            maxWidthClassName="max-w-2xl"
          >
            <PlatformUserFormFields form={editForm} onChange={setEditForm} />
          </ActionDialog>
        )}
      </div>
    </SuperAdminLayout>
  );
}
