import { useEffect, useMemo, useState } from "react";

import ActionDialog from "@/components/shared/ActionDialog";
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
  PlatformUserDetailResponse,
  PlatformUserListResponse,
  StaffStatusResponse,
  PasswordResetResponse,
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

  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [resetConfirmUser, setResetConfirmUser] = useState<PlatformUserListItemResponse | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

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
      const created = await api.post<PlatformUserDetailResponse>(
        "/users/platform",
        buildPlatformUserCreatePayload(createForm),
      );
      setItems((current) => [created, ...current]);
      setShowCreateForm(false);
      setCreateForm(EMPTY_PLATFORM_USER_FORM);
      setPageMessage({ type: "ok", text: `Platform user ${created.full_name} created.` });
      if (created.temporary_password) {
        setGeneratedPassword(created.temporary_password);
      }
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

  async function handleResetPassword() {
    if (!resetConfirmUser) return;
    setResetBusy(true);
    setResetError(null);
    try {
      const response = await api.post<PasswordResetResponse>(`/users/platform/${resetConfirmUser.id}/reset-password`, {});
      setGeneratedPassword(response.new_password);
      setResetConfirmUser(null);
      setPageMessage({ type: "ok", text: "Password reset successfully." });
      setItems((current) =>
        current.map((item) =>
          item.id === resetConfirmUser.id ? { ...item, must_change_password: true } : item
        )
      );
    } catch (err) {
      setResetError(getApiErrorMessage(err, "Failed to reset password."));
    } finally {
      setResetBusy(false);
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
    <>
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
            onResetPassword={setResetConfirmUser}
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

        {resetConfirmUser && (
          <ActionDialog
            title="Reset Password"
            description={`Reset password for "${resetConfirmUser.full_name}"? A new random password will be generated and they will be forced to change it on next login.`}
            error={resetError}
            busy={resetBusy}
            onClose={() => {
              if (resetBusy) return;
              setResetConfirmUser(null);
              setResetError(null);
            }}
            onConfirm={() => void handleResetPassword()}
            confirmLabel={resetBusy ? "Resetting..." : "Reset Password"}
            confirmTone="warning"
          />
        )}

        {generatedPassword && (
          <div className="app-modal-shell z-[60]">
            <div className="app-modal-panel max-w-sm space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Password Generated</h2>
              <p className="text-sm text-gray-600">
                Please share this temporary password with the user. They will be required to change it on their first login.
              </p>
              <div className="bg-gray-100 p-3 rounded-md text-center font-mono text-xl font-bold tracking-wider select-all">
                {generatedPassword}
              </div>
              <button
                onClick={() => setGeneratedPassword(null)}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
