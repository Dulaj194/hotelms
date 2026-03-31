import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import ActionDialog from "@/components/shared/ActionDialog";
import DashboardLayout from "@/components/shared/DashboardLayout";
import type {
  AssignedArea,
  StaffListItemResponse,
  StaffCreateRequest,
  StaffUpdateRequest,
  UserRole,
} from "@/types/user";
import {
  ASSIGNED_AREAS,
  ASSIGNED_AREA_LABELS,
  ROLE_LABELS,
  STAFF_ROLES,
} from "@/types/user";
import { ApiError } from "@/lib/api";
import { getUser, normalizeRole } from "@/lib/auth";

type DialogMode = { type: "add" } | { type: "edit"; staff: StaffListItemResponse } | null;
type ConfirmActionState = {
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone?: "primary" | "success" | "warning" | "danger";
  onConfirm: () => Promise<void>;
} | null;

const EMPTY_CREATE: StaffCreateRequest = {
  full_name: "",
  email: "",
  username: "",
  phone: "",
  password: "",
  role: "steward",
  assigned_area: "steward",
  is_active: true,
};

export default function Staff() {
  const currentUserRole = normalizeRole(getUser()?.role);

  function canManageRole(targetRole: UserRole): boolean {
    if (currentUserRole === "owner") return targetRole !== "owner";
    if (currentUserRole === "admin") return targetRole === "steward" || targetRole === "housekeeper";
    return false;
  }

  const [staffList, setStaffList] = useState<StaffListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [dialog, setDialog] = useState<DialogMode>(null);
  const [formData, setFormData] = useState<StaffCreateRequest>(EMPTY_CREATE);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [pageMsg, setPageMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const allowedRoles = useMemo<UserRole[]>(() => {
    if (currentUserRole === "owner") {
      return STAFF_ROLES.filter((role) => role !== "owner");
    }
    if (currentUserRole === "admin") {
      return ["steward", "housekeeper"];
    }
    return ["steward", "housekeeper"];
  }, [currentUserRole]);

  function loadStaff() {
    setLoading(true);
    setFetchError(null);
    api
      .get<StaffListItemResponse[]>("/users")
      .then(setStaffList)
      .catch((err: unknown) => {
        const msg =
          err instanceof ApiError
            ? err.detail
            : err instanceof Error
              ? err.message
              : "Failed to load staff list.";
        setFetchError(msg);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadStaff(); }, []);

  function openAdd() {
    setFormData({
      ...EMPTY_CREATE,
      role: allowedRoles[0] ?? "steward",
      assigned_area: "steward",
    });
    setFormError(null);
    setDialog({ type: "add" });
  }

  function openEdit(s: StaffListItemResponse) {
    if (!canManageRole(s.role)) {
      setPageMsg({ type: "err", text: "You are not allowed to edit this role." });
      return;
    }
    setFormData({
      full_name: s.full_name,
      email: s.email,
      username: s.username ?? "",
      phone: s.phone ?? "",
      password: "",
      role: s.role,
      assigned_area: s.assigned_area,
      is_active: s.is_active,
    });
    setFormError(null);
    setDialog({ type: "edit", staff: s });
  }

  function closeDialog() {
    setDialog(null);
    setFormError(null);
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await confirmAction.onConfirm();
      setConfirmAction(null);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "An error occurred.";
      setConfirmError(msg);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function submitStaffChange() {
    if (!dialog) return;

    setSubmitting(true);
    setFormError(null);

    try {
      if (dialog.type === "add") {
        await api.post<StaffListItemResponse>("/users", formData);
        setPageMsg({ type: "ok", text: "Staff member added successfully." });
      } else {
        const payload: StaffUpdateRequest = {
          full_name: formData.full_name || undefined,
          email: formData.email || undefined,
          username: formData.username || undefined,
          phone: formData.phone || undefined,
          role: formData.role,
          assigned_area: formData.assigned_area,
          is_active: formData.is_active,
        };
        if (formData.password) payload.password = formData.password;
        await api.patch<StaffListItemResponse>(`/users/${dialog.staff.id}`, payload);
        setPageMsg({ type: "ok", text: "Staff member updated successfully." });
      }
      closeDialog();
      loadStaff();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!dialog) return;

    if (!formData.full_name.trim() || !formData.email.trim() || !formData.username.trim() || !formData.phone.trim()) {
      setFormError("Name, email, username, and contact are required.");
      return;
    }
    if (dialog.type === "add" && !formData.password.trim()) {
      setFormError("Password is required for new staff accounts.");
      return;
    }

    const duplicate = staffList.find((staff) => {
      if (dialog.type === "edit" && staff.id === dialog.staff.id) return false;
      return (
        staff.email.toLowerCase() === formData.email.trim().toLowerCase() ||
        (staff.username ?? "").toLowerCase() === formData.username.trim().toLowerCase() ||
        (staff.phone ?? "") === formData.phone.trim()
      );
    });

    if (duplicate) {
      setFormError("Duplicate account detected: email, username, or contact already exists.");
      return;
    }

    setConfirmError(null);
    setConfirmAction({
      title: dialog.type === "add" ? "Create Staff Account" : "Save Staff Changes",
      description:
        dialog.type === "add"
          ? `Create a new staff account for ${formData.full_name.trim()}?`
          : `Apply updates for ${dialog.staff.full_name}?`,
      confirmLabel: dialog.type === "add" ? "Create Account" : "Save Changes",
      confirmTone: "primary",
      onConfirm: submitStaffChange,
    });
  }

  async function handleDisable(id: number) {
    setConfirmError(null);
    setConfirmAction({
      title: "Deactivate Staff Account",
      description: "This staff member will lose access until the account is enabled again.",
      confirmLabel: "Deactivate",
      confirmTone: "warning",
      onConfirm: async () => {
        setPageMsg(null);
        await api.patch(`/users/${id}/disable`, {});
        setPageMsg({ type: "ok", text: "Staff member disabled." });
        loadStaff();
      },
    });
  }

  async function handleEnable(id: number) {
    setConfirmError(null);
    setConfirmAction({
      title: "Reactivate Staff Account",
      description: "This staff member will regain access to operational pages immediately.",
      confirmLabel: "Enable",
      confirmTone: "success",
      onConfirm: async () => {
        setPageMsg(null);
        await api.patch(`/users/${id}/enable`, {});
        setPageMsg({ type: "ok", text: "Staff member enabled." });
        loadStaff();
      },
    });
  }

  async function handleDelete(id: number, name: string) {
    setConfirmError(null);
    setConfirmAction({
      title: "Delete Staff Account",
      description: `Delete "${name}" permanently? Deactivating first is recommended.`,
      confirmLabel: "Delete Staff",
      confirmTone: "danger",
      onConfirm: async () => {
        setPageMsg(null);
        await api.delete(`/users/${id}`);
        setPageMsg({ type: "ok", text: "Staff member deleted." });
        loadStaff();
      },
    });
  }

  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      const roleMatched = roleFilter === "all" || staff.role === roleFilter;
      const statusMatched =
        statusFilter === "all" ||
        (statusFilter === "active" ? staff.is_active : !staff.is_active);
      return roleMatched && statusMatched;
    });
  }, [roleFilter, statusFilter, staffList]);

  const activeCount = staffList.filter((staff) => staff.is_active).length;
  const inactiveCount = staffList.length - activeCount;
  const activeStewards = staffList.filter(
    (staff) => staff.role === "steward" && staff.is_active
  ).length;
  const activeHousekeepers = staffList.filter(
    (staff) => staff.role === "housekeeper" && staff.is_active
  ).length;
  const kitchenPending =
    staffList.find((staff) => staff.role === "steward")?.pending_tasks_count ?? 0;
  const housekeepingPending =
    staffList.find((staff) => staff.role === "housekeeper")?.pending_tasks_count ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Staff</h1>
          <button
            onClick={openAdd}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add staff
          </button>
        </div>

        {pageMsg && (
          <p
            className={`text-sm ${
              pageMsg.type === "ok" ? "text-green-600" : "text-red-600"
            }`}
          >
            {pageMsg.text}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <Metric title="Active Staff" value={activeCount} />
          <Metric title="Inactive Staff" value={inactiveCount} />
          <Metric
            title="Kitchen Load"
            value={`${kitchenPending} pending / ${activeStewards || 1} active`}
          />
          <Metric
            title="Housekeeping Load"
            value={`${housekeepingPending} pending / ${activeHousekeepers || 1} active`}
          />
        </div>

        <div className="rounded-lg border bg-white p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-600">Role</label>
            <select
              className="rounded-md border px-3 py-1.5 text-sm"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
            >
              <option value="all">All roles</option>
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-600">Status</label>
            <select
              className="rounded-md border px-3 py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : fetchError ? (
          <p className="text-red-600 text-sm">{fetchError}</p>
        ) : filteredStaff.length === 0 ? (
          <p className="text-gray-400 text-sm">No staff found. Add the first member.</p>
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="space-y-3 p-4 md:hidden">
              {filteredStaff.map((s) => (
                <article key={s.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900">{s.full_name}</p>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {s.is_active ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <p>Username: {s.username ?? "-"}</p>
                    <p>Contact: {s.phone ?? "-"}</p>
                    <p>Email: {s.email}</p>
                    <p>Role: {ROLE_LABELS[s.role]}</p>
                    <p>Area: {s.assigned_area ? ASSIGNED_AREA_LABELS[s.assigned_area] : "-"}</p>
                    <p>
                      Load:{" "}
                      {s.pending_tasks_count > 0
                        ? `${s.pending_tasks_count} / ${s.load_per_staff.toFixed(2)}`
                        : "-"}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {canManageRole(s.role) ? (
                      <>
                        <button
                          onClick={() => openEdit(s)}
                          className="w-full rounded-md border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 sm:w-auto"
                        >
                          Edit
                        </button>
                        {s.is_active ? (
                          <button
                            onClick={() => handleDisable(s.id)}
                            className="w-full rounded-md border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 sm:w-auto"
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnable(s.id)}
                            className="w-full rounded-md border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 sm:w-auto"
                          >
                            Enable
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(s.id, s.full_name)}
                          className="w-full rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 sm:w-auto"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">Restricted</span>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="app-table-scroll hidden md:block">
              <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Area</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Load</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{s.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.username ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{s.phone ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500">{s.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {ROLE_LABELS[s.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.assigned_area ? ASSIGNED_AREA_LABELS[s.assigned_area] : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.pending_tasks_count > 0
                        ? `${s.pending_tasks_count} / ${s.load_per_staff.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          s.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {s.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canManageRole(s.role) ? (
                          <>
                            <button
                              onClick={() => openEdit(s)}
                              className="text-xs font-medium text-blue-600 hover:underline"
                            >
                              Edit
                            </button>
                            {s.is_active ? (
                              <button
                                onClick={() => handleDisable(s.id)}
                                className="text-xs font-medium text-amber-600 hover:underline"
                              >
                                Disable
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEnable(s.id)}
                                className="text-xs font-medium text-green-600 hover:underline"
                              >
                                Enable
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(s.id, s.full_name)}
                              className="text-xs font-medium text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Restricted</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      {dialog && (
        <div className="app-modal-shell">
          <div className="app-modal-panel max-w-md space-y-4">
            <h2 className="text-lg font-semibold">
              {dialog.type === "add" ? "Add Staff Member" : "Edit Staff Member"}
            </h2>

            <StaffFormField
              label="Full name *"
              value={formData.full_name}
              onChange={(v) => setFormData((f) => ({ ...f, full_name: v }))}
            />
            <StaffFormField
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(v) => setFormData((f) => ({ ...f, email: v }))}
            />
            <StaffFormField
              label="Username *"
              value={formData.username}
              onChange={(v) =>
                setFormData((f) => ({ ...f, username: v.toLowerCase().replace(/\s+/g, "") }))
              }
            />
            <StaffFormField
              label="Contact Number *"
              value={formData.phone}
              onChange={(v) => setFormData((f) => ({ ...f, phone: v }))}
            />
            <StaffFormField
              label={dialog.type === "add" ? "Password *" : "New password (leave blank to keep)"}
              type="password"
              value={formData.password}
              onChange={(v) => setFormData((f) => ({ ...f, password: v }))}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium">Role *</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.role}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, role: e.target.value as UserRole }))
                }
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Assigned Area</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.assigned_area ?? ""}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    assigned_area: (e.target.value || null) as AssignedArea | null,
                  }))
                }
              >
                <option value="">Not assigned</option>
                {ASSIGNED_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {ASSIGNED_AREA_LABELS[area]}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active status
            </label>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="app-form-actions pt-1">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
              >
                {submitting ? "Saving..." : dialog.type === "add" ? "Add member" : "Save changes"}
              </button>
              <button
                onClick={closeDialog}
                className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <ActionDialog
          title={confirmAction.title}
          description={confirmAction.description}
          error={confirmError}
          busy={confirmBusy || submitting}
          onClose={() => {
            if (confirmBusy || submitting) return;
            setConfirmAction(null);
            setConfirmError(null);
          }}
          onConfirm={() => void runConfirmedAction()}
          confirmLabel={confirmBusy || submitting ? "Processing..." : confirmAction.confirmLabel}
          confirmTone={confirmAction.confirmTone}
        />
      )}
    </DashboardLayout>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function StaffFormField({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

