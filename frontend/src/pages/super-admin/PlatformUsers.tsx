import { useEffect, useMemo, useState } from "react";

import ActionDialog from "@/components/shared/ActionDialog";
import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import {
  buildPlatformUserCreatePayload,
  buildPlatformUserUpdatePayload,
  EMPTY_PLATFORM_USER_FORM,
  mapPlatformUserToFormState,
  type PlatformUserFormState,
} from "@/features/super-admin/platform-users/formState";
import { api } from "@/lib/api";
import { formatDateTime, getApiErrorMessage } from "@/pages/super-admin/utils";
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
          <MetricCard label="Platform Users" value={metrics.total} hint="All super admin accounts" />
          <MetricCard label="Active Accounts" value={metrics.active} hint="Currently enabled" />
          <MetricCard
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
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="app-section-title text-slate-900">Accounts</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Protect platform access by keeping only the required super admin accounts active.
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-500">{items.length} users</span>
            </div>

            {items.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No platform users found.
              </div>
            ) : (
              <div className="app-table-scroll mt-5">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3">User</th>
                      <th className="px-3 py-3">Username</th>
                      <th className="px-3 py-3">Phone</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Password Policy</th>
                      <th className="px-3 py-3">Last Login</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-900">{user.full_name}</p>
                          <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{user.username ?? "-"}</td>
                        <td className="px-3 py-3 text-slate-600">{user.phone ?? "-"}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              user.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {user.must_change_password ? "Reset required" : "Stable"}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{formatDateTime(user.last_login_at)}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditDialog(user)}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleStatus(user.id, user.is_active)}
                              disabled={statusBusyId === user.id}
                              className={`rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                                user.is_active
                                  ? "border-orange-200 text-orange-700 hover:bg-orange-50"
                                  : "border-green-200 text-green-700 hover:bg-green-50"
                              }`}
                            >
                              {statusBusyId === user.id ? "Working..." : user.is_active ? "Disable" : "Enable"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(user.id)}
                              disabled={deleteBusyId === user.id}
                              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deleteBusyId === user.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
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

function PlatformUserFormCard({
  title,
  description,
  form,
  submitLabel,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: string;
  form: PlatformUserFormState;
  submitLabel: string;
  busy: boolean;
  onChange: (next: PlatformUserFormState) => void;
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
        <PlatformUserFormFields form={form} onChange={onChange} />
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

function PlatformUserFormFields({
  form,
  onChange,
}: {
  form: PlatformUserFormState;
  onChange: (next: PlatformUserFormState) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <LabeledInput
        label="Full Name"
        value={form.full_name}
        onChange={(value) => onChange({ ...form, full_name: value })}
      />
      <LabeledInput
        label="Email"
        type="email"
        value={form.email}
        onChange={(value) => onChange({ ...form, email: value })}
      />
      <LabeledInput
        label="Username"
        value={form.username}
        onChange={(value) => onChange({ ...form, username: value })}
      />
      <LabeledInput
        label="Phone"
        value={form.phone}
        onChange={(value) => onChange({ ...form, phone: value })}
      />
      <LabeledInput
        label="Password"
        type="password"
        value={form.password}
        onChange={(value) => onChange({ ...form, password: value })}
      />
      <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => onChange({ ...form, is_active: event.target.checked })}
        />
        Account is active
      </label>
      <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
        <input
          type="checkbox"
          checked={form.must_change_password}
          onChange={(event) =>
            onChange({ ...form, must_change_password: event.target.checked })
          }
        />
        Force password change on next login
      </label>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
    </label>
  );
}
