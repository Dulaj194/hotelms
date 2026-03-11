import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/shared/DashboardLayout";
import type {
  StaffListItemResponse,
  StaffCreateRequest,
  StaffUpdateRequest,
  UserRole,
} from "@/types/user";
import { ROLE_LABELS, STAFF_ROLES } from "@/types/user";

type DialogMode = { type: "add" } | { type: "edit"; staff: StaffListItemResponse } | null;

const EMPTY_CREATE: StaffCreateRequest = {
  full_name: "",
  email: "",
  password: "",
  role: "steward",
};

export default function Staff() {
  const [staffList, setStaffList] = useState<StaffListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [dialog, setDialog] = useState<DialogMode>(null);
  const [formData, setFormData] = useState<StaffCreateRequest>(EMPTY_CREATE);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pageMsg, setPageMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function loadStaff() {
    setLoading(true);
    api
      .get<StaffListItemResponse[]>("/users")
      .then(setStaffList)
      .catch(() => setFetchError("Failed to load staff list."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadStaff(); }, []);

  function openAdd() {
    setFormData(EMPTY_CREATE);
    setFormError(null);
    setDialog({ type: "add" });
  }

  function openEdit(s: StaffListItemResponse) {
    setFormData({
      full_name: s.full_name,
      email: s.email,
      password: "",
      role: s.role,
    });
    setFormError(null);
    setDialog({ type: "edit", staff: s });
  }

  function closeDialog() {
    setDialog(null);
    setFormError(null);
  }

  async function handleSubmit() {
    if (!dialog) return;
    setSubmitting(true);
    setFormError(null);

    try {
      if (dialog.type === "add") {
        // SECURITY: No restaurant_id sent — backend derives it from token
        await api.post<StaffListItemResponse>("/users", formData);
        setPageMsg({ type: "ok", text: "Staff member added." });
      } else {
        // Only send changed fields for edit; skip empty password
        const payload: StaffUpdateRequest = {
          full_name: formData.full_name || undefined,
          email: formData.email || undefined,
          role: formData.role,
        };
        if (formData.password) payload.password = formData.password;
        await api.patch<StaffListItemResponse>(`/users/${dialog.staff.id}`, payload);
        setPageMsg({ type: "ok", text: "Staff member updated." });
      }
      closeDialog();
      loadStaff();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "An error occurred.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable(id: number) {
    setPageMsg(null);
    try {
      await api.patch(`/users/${id}/disable`, {});
      setPageMsg({ type: "ok", text: "Staff member disabled." });
      loadStaff();
    } catch (err: unknown) {
      setPageMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to disable." });
    }
  }

  async function handleEnable(id: number) {
    setPageMsg(null);
    try {
      await api.patch(`/users/${id}/enable`, {});
      setPageMsg({ type: "ok", text: "Staff member enabled." });
      loadStaff();
    } catch (err: unknown) {
      setPageMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to enable." });
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setPageMsg(null);
    try {
      await api.delete(`/users/${id}`);
      setPageMsg({ type: "ok", text: "Staff member deleted." });
      loadStaff();
    } catch (err: unknown) {
      setPageMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to delete." });
    }
  }

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

        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : fetchError ? (
          <p className="text-red-600 text-sm">{fetchError}</p>
        ) : staffList.length === 0 ? (
          <p className="text-gray-400 text-sm">No staff found. Add the first member.</p>
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{s.full_name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {ROLE_LABELS[s.role]}
                      </span>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl p-6 space-y-4">
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
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Saving…" : dialog.type === "add" ? "Add member" : "Save changes"}
              </button>
              <button
                onClick={closeDialog}
                className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
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
