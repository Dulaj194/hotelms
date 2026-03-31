import { useEffect, useRef, useState } from "react";
import ActionDialog from "@/components/shared/ActionDialog";
import { api } from "@/lib/api";
import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import type {
  RestaurantAdminUpdateRequest,
  RestaurantMeResponse,
  RestaurantCreateRequest,
  RestaurantDeleteResponse,
  RestaurantLogoUploadResponse,
} from "@/types/restaurant";
import type {
  SubscriptionResponse,
  PackageResponse,
  PackageListResponse,
} from "@/types/subscription";
import type { StaffDetailResponse } from "@/types/user";

type ConfirmActionState = {
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone?: "primary" | "success" | "warning" | "danger";
  onConfirm: () => Promise<void>;
} | null;

export default function SuperAdminRestaurants() {
  const [list, setList] = useState<RestaurantMeResponse[]>([]);
  const [subscriptionStatusByHotel, setSubscriptionStatusByHotel] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<RestaurantCreateRequest>({ name: "" });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [selected, setSelected] = useState<RestaurantMeResponse | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<RestaurantAdminUpdateRequest>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // ─── Subscription state ────────────────────────────────────────────────────
  const [selectedSub, setSelectedSub] = useState<SubscriptionResponse | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [editingSub, setEditingSub] = useState(false);
  const [subForm, setSubForm] = useState({ status: "", expires_at: "", package_id: "" });
  const [savingSub, setSavingSub] = useState(false);
  const [subMsg, setSubMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [packages, setPackages] = useState<PackageResponse[]>([]);

  // ─── Expiry job state ──────────────────────────────────────────────────────
  const [expiringOverdue, setExpiringOverdue] = useState(false);
  const [expireMsg, setExpireMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ─── Hotel staff state ─────────────────────────────────────────────────────
  const [hotelUsers, setHotelUsers] = useState<StaffDetailResponse[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    full_name: "", email: "", password: "", role: "admin",
  });
  const [addingUser, setAddingUser] = useState(false);
  const [addUserMsg, setAddUserMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  // ─── Create-hotel logo ─────────────────────────────────────────────────────
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null);
  const createLogoRef = useRef<HTMLInputElement>(null);

  // ─── Edit-hotel logo ───────────────────────────────────────────────────────
  const [uploadingEditLogo, setUploadingEditLogo] = useState(false);
  const [editLogoMsg, setEditLogoMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const editLogoRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const restaurants = await api.get<RestaurantMeResponse[]>("/restaurants");
      setList(restaurants);
      setFetchError(null);

      const statusEntries = await Promise.all(
        restaurants.map(async (restaurant) => {
          try {
            const sub = await api.get<SubscriptionResponse>(`/subscriptions/admin/${restaurant.id}`);
            return [restaurant.id, sub.status] as const;
          } catch {
            return [restaurant.id, "none"] as const;
          }
        }),
      );

      setSubscriptionStatusByHotel(Object.fromEntries(statusEntries));
    } catch {
      setFetchError("Failed to load restaurants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    api
      .get<PackageListResponse>("/packages")
      .then((r) => setPackages(r.items))
      .catch(() => {});
  }, []);

  async function fetchHotelExtras(restaurantId: number) {
    setSubLoading(true);
    setUsersLoading(true);
    setSelectedSub(null);
    setHotelUsers([]);
    setSubMsg(null);
    setAddUserMsg(null);
    setEditingSub(false);
    setShowAddUser(false);

    const [subResult, usersResult] = await Promise.allSettled([
      api.get<SubscriptionResponse>(`/subscriptions/admin/${restaurantId}`),
      api.get<StaffDetailResponse[]>(`/restaurants/${restaurantId}/users`),
    ]);

    if (subResult.status === "fulfilled") {
      const sub = subResult.value;
      setSelectedSub(sub);
      setSubForm({
        status: sub.status,
        expires_at: sub.expires_at
          ? new Date(sub.expires_at).toISOString().slice(0, 10)
          : "",
        package_id: sub.package_id?.toString() ?? "",
      });
    }
    if (usersResult.status === "fulfilled") {
      setHotelUsers(usersResult.value);
    }
    setSubLoading(false);
    setUsersLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMsg(null);
    try {
      const created = await api.post<RestaurantMeResponse>("/restaurants", form);
      if (createLogoFile) {
        try {
          const fd = new FormData();
          fd.append("file", createLogoFile);
          const logoData = await api.post<RestaurantLogoUploadResponse>(
            `/restaurants/${created.id}/logo`,
            fd,
          );
          created.logo_url = logoData.logo_url;
        } catch { /* logo upload failure is non-fatal */ }
      }
      setList((prev) => [created, ...prev]);
      setSubscriptionStatusByHotel((prev) => ({ ...prev, [created.id]: "trial" }));
      setShowCreate(false);
      setForm({ name: "" });
      setCreateLogoFile(null);
      if (createLogoRef.current) createLogoRef.current.value = "";
      setCreateMsg({ type: "ok", text: `Hotel "${created.name}" registered successfully.` });
    } catch (err) {
      setCreateMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to register hotel.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleView(restaurantId: number) {
    setSelectedLoading(true);
    setSelectedError(null);
    setActionMsg(null);
    setEditingId(null);
    setEditLogoMsg(null);
    try {
      const data = await api.get<RestaurantMeResponse>(`/restaurants/${restaurantId}`);
      setSelected(data);
      void fetchHotelExtras(restaurantId);
    } catch {
      setSelectedError("Failed to load hotel profile.");
    } finally {
      setSelectedLoading(false);
    }
  }

  async function handleStartEdit(restaurantId: number) {
    setSelectedLoading(true);
    setSelectedError(null);
    setActionMsg(null);
    setEditLogoMsg(null);
    try {
      const data = await api.get<RestaurantMeResponse>(`/restaurants/${restaurantId}`);
      setSelected(data);
      setEditingId(restaurantId);
      setEditForm({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        is_active: data.is_active,
      });
      void fetchHotelExtras(restaurantId);
    } catch {
      setSelectedError("Failed to load hotel for editing.");
    } finally {
      setSelectedLoading(false);
    }
  }

  async function handleEditLogoUpload(file: File) {
    if (!selected) return;
    setUploadingEditLogo(true);
    setEditLogoMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await api.post<RestaurantLogoUploadResponse>(
        `/restaurants/${selected.id}/logo`,
        fd,
      );
      setSelected((prev) => prev ? { ...prev, logo_url: data.logo_url } : prev);
      setList((prev) => prev.map((r) => r.id === selected.id ? { ...r, logo_url: data.logo_url } : r));
      setEditLogoMsg({ type: "ok", text: "Logo updated." });
    } catch (err) {
      setEditLogoMsg({ type: "err", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploadingEditLogo(false);
      if (editLogoRef.current) editLogoRef.current.value = "";
    }
  }

  async function handleSaveEdit() {
    if (editingId === null) return;
    setSaving(true);
    setActionMsg(null);
    try {
      const updated = await api.patch<RestaurantMeResponse>(`/restaurants/${editingId}`, editForm);
      setList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelected(updated);
      setEditingId(null);
      setActionMsg({ type: "ok", text: `Hotel "${updated.name}" updated.` });
    } catch (err) {
      setActionMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to update hotel.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await confirmAction.onConfirm();
      setConfirmAction(null);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setConfirmBusy(false);
    }
  }

  async function deleteRestaurantRecord(restaurantId: number) {
    setDeletingId(restaurantId);
    setActionMsg(null);
    try {
      const result = await api.delete<RestaurantDeleteResponse>(`/restaurants/${restaurantId}`);
      setList((prev) => prev.filter((item) => item.id !== restaurantId));
      setSubscriptionStatusByHotel((prev) => {
        const next = { ...prev };
        delete next[restaurantId];
        return next;
      });
      if (selected?.id === restaurantId) { setSelected(null); setEditingId(null); }
      setActionMsg({ type: "ok", text: result.message });
    } finally {
      setDeletingId(null);
    }
  }

  function handleDelete(restaurantId: number, restaurantName: string) {
    setConfirmError(null);
    setConfirmAction({
      title: "Delete Hotel",
      description: `Delete "${restaurantName}" permanently? This cannot be undone.`,
      confirmLabel: "Delete Hotel",
      confirmTone: "danger",
      onConfirm: async () => {
        await deleteRestaurantRecord(restaurantId);
      },
    });
  }

  async function handleSaveSub() {
    if (!selected) return;
    const payload: Record<string, unknown> = {};
    if (subForm.status) payload.status = subForm.status;
    if (subForm.expires_at) payload.expires_at = new Date(subForm.expires_at).toISOString();
    if (subForm.package_id) payload.package_id = parseInt(subForm.package_id, 10);
    if (Object.keys(payload).length === 0) {
      setSubMsg({ type: "err", text: "No changes to save." });
      return;
    }
    setSavingSub(true);
    setSubMsg(null);
    try {
      const updated = await api.patch<SubscriptionResponse>(
        `/subscriptions/admin/${selected.id}`,
        payload,
      );
      setSelectedSub(updated);
      setSubscriptionStatusByHotel((prev) => ({ ...prev, [selected.id]: updated.status }));
      setEditingSub(false);
      setSubMsg({ type: "ok", text: "Subscription updated successfully." });
    } catch (err) {
      setSubMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to update subscription.",
      });
    } finally {
      setSavingSub(false);
    }
  }

  async function handleExpireOverdue() {
    setExpiringOverdue(true);
    setExpireMsg(null);
    try {
      const result = await api.post<{ message: string; expired_count: number }>(
        "/subscriptions/admin/expire-overdue",
        {},
      );
      setExpireMsg({ type: "ok", text: result.message });
      load();
    } catch (err) {
      setExpireMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Expiry check failed.",
      });
    } finally {
      setExpiringOverdue(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setAddingUser(true);
    setAddUserMsg(null);
    try {
      const newUser = await api.post<StaffDetailResponse>(
        `/restaurants/${selected.id}/users`,
        { ...addUserForm },
      );
      setHotelUsers((prev) => [newUser, ...prev]);
      setShowAddUser(false);
      setAddUserForm({ full_name: "", email: "", password: "", role: "admin" });
      setAddUserMsg({ type: "ok", text: `"${newUser.full_name}" added successfully.` });
    } catch (err) {
      setAddUserMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to add staff member.",
      });
    } finally {
      setAddingUser(false);
    }
  }

  async function removeHotelUser(userId: number) {
    if (!selected) return;
    setDeletingUserId(userId);
    setAddUserMsg(null);
    try {
      await api.delete(`/restaurants/${selected.id}/users/${userId}`);
      setHotelUsers((prev) => prev.filter((u) => u.id !== userId));
    } finally {
      setDeletingUserId(null);
    }
  }

  function handleDeleteUser(userId: number, userName: string) {
    if (!selected) return;
    setConfirmError(null);
    setConfirmAction({
      title: "Remove Hotel User",
      description: `Remove "${userName}" from this hotel staff list?`,
      confirmLabel: "Remove User",
      confirmTone: "danger",
      onConfirm: async () => {
        await removeHotelUser(userId);
      },
    });
  }

  async function handleToggleUser(userId: number, isActive: boolean) {
    if (!selected) return;
    setTogglingUserId(userId);
    const action = isActive ? "disable" : "enable";
    try {
      const result = await api.patch<{ id: number; is_active: boolean; message: string }>(
        `/restaurants/${selected.id}/users/${userId}/${action}`,
        {},
      );
      setHotelUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: result.is_active } : u)),
      );
    } catch (err) {
      setAddUserMsg({
        type: "err",
        text: err instanceof Error ? err.message : `Failed to ${action} user.`,
      });
    } finally {
      setTogglingUserId(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SuperAdminLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Hotels</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {expireMsg && (
              <span className={`text-xs ${expireMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                {expireMsg.text}
              </span>
            )}
            <button
              type="button"
              onClick={handleExpireOverdue}
              disabled={expiringOverdue}
              className="rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
            >
              {expiringOverdue ? "Checking…" : "Run Expiry Check"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(true); setCreateMsg(null); }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Register Hotel
            </button>
          </div>
        </div>

        {createMsg && (
          <p className={`text-sm ${createMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
            {createMsg.text}
          </p>
        )}
        {actionMsg && (
          <p className={`text-sm ${actionMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
            {actionMsg.text}
          </p>
        )}

        {/* Register hotel form */}
        {showCreate && (
          <form onSubmit={handleCreate} className="rounded-lg border bg-white p-5 space-y-3">
            <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Register New Hotel</h2>
            <FormField label="Hotel Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
            <FormField label="Email" type="email" value={form.email ?? ""} onChange={(v) => setForm((f) => ({ ...f, email: v || null }))} />
            <FormField label="Phone" value={form.phone ?? ""} onChange={(v) => setForm((f) => ({ ...f, phone: v || null }))} />
            <FormField label="Address" value={form.address ?? ""} onChange={(v) => setForm((f) => ({ ...f, address: v || null }))} />
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Logo <span className="text-gray-400 font-normal">(optional · JPG/PNG/WebP · max 5 MB)</span>
              </label>
              <input
                ref={createLogoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-xs file:font-medium file:bg-gray-50 hover:file:bg-gray-100"
                onChange={(e) => setCreateLogoFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={creating || !form.name.trim()}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Registering…" : "Register Hotel"}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setCreateLogoFile(null); }}
                className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Hotels table */}
        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : fetchError ? (
          <p className="text-red-600">{fetchError}</p>
        ) : list.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center text-gray-400">
            No hotels registered yet.
          </div>
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="space-y-3 p-4 md:hidden">
              {list.map((r) => (
                <article key={r.id} className="rounded-lg border border-gray-200 p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900">{r.name}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBooleanStatusBadgeClass(r.is_active)}`}
                    >
                      {r.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <p>Email: {r.email ?? "-"}</p>
                    <p>Phone: {r.phone ?? "-"}</p>
                    <p>
                      Subscription:{" "}
                      {formatSubscriptionStatusLabel(subscriptionStatusByHotel[r.id])}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleView(r.id)}
                      className="w-full rounded border px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 sm:w-auto"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(r.id)}
                      className="w-full rounded border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 sm:w-auto"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id, r.name)}
                      disabled={deletingId === r.id}
                      className="w-full rounded border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 sm:w-auto"
                    >
                      {deletingId === r.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="app-table-scroll hidden md:block">
              <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Hotel Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Hotel Status</th>
                  <th className="px-4 py-3 text-left">Subscription Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((r) => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${selected?.id === r.id ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.email ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{r.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBooleanStatusBadgeClass(r.is_active)}`}>
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubscriptionStatusBadgeClass(subscriptionStatusByHotel[r.id])}`}
                      >
                        {formatSubscriptionStatusLabel(subscriptionStatusByHotel[r.id])}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => handleView(r.id)}
                          className="rounded border px-2.5 py-1 text-xs font-medium hover:bg-gray-50">
                          View
                        </button>
                        <button type="button" onClick={() => handleStartEdit(r.id)}
                          className="rounded border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(r.id, r.name)}
                          disabled={deletingId === r.id}
                          className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                          {deletingId === r.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Hotel detail panel */}
        {(selectedLoading || selectedError || selected) && (
          <div className="space-y-4">

            {/* ── Basic info / edit ── */}
            <div className="rounded-lg border bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
                  Hotel Profile {selected ? `— ${selected.name}` : ""}
                </h2>
                {selected && (
                  <button type="button"
                    onClick={() => { setSelected(null); setEditingId(null); setEditLogoMsg(null); }}
                    className="text-xs text-gray-400 hover:text-gray-600">
                    ✕ Close
                  </button>
                )}
              </div>

              {selectedLoading ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : selectedError ? (
                <p className="text-sm text-red-600">{selectedError}</p>
              ) : selected ? (
                editingId === selected.id ? (
                  <div className="space-y-3">
                    {/* ── Logo upload in edit mode ── */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Logo</label>
                      <div className="flex items-center gap-3">
                        {selected.logo_url && (
                          <img
                            src={`${import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000"}${selected.logo_url}`}
                            alt="Current logo"
                            className="h-14 w-14 rounded-md object-cover border"
                          />
                        )}
                        <label className="cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
                          {uploadingEditLogo ? "Uploading…" : selected.logo_url ? "Change Logo" : "Upload Logo"}
                          <input
                            ref={editLogoRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={uploadingEditLogo}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleEditLogoUpload(f);
                            }}
                          />
                        </label>
                      </div>
                      {editLogoMsg && (
                        <p className={`text-xs ${editLogoMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                          {editLogoMsg.text}
                        </p>
                      )}
                    </div>
                    <FormField label="Name *" value={editForm.name ?? ""} onChange={(v) => setEditForm((p) => ({ ...p, name: v }))} />
                    <FormField label="Email" type="email" value={editForm.email ?? ""} onChange={(v) => setEditForm((p) => ({ ...p, email: v || null }))} />
                    <FormField label="Phone" value={editForm.phone ?? ""} onChange={(v) => setEditForm((p) => ({ ...p, phone: v || null }))} />
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Address</label>
                      <textarea className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3}
                        value={editForm.address ?? ""}
                        onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value || null }))} />
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={Boolean(editForm.is_active)}
                        onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))} />
                      Active hotel
                    </label>
                    {actionMsg && (
                      <p className={`text-xs ${actionMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{actionMsg.text}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={handleSaveEdit}
                        disabled={saving || !(editForm.name ?? "").trim()}
                        className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                      <button type="button" onClick={() => { setEditingId(null); setSelectedError(null); setEditLogoMsg(null); }}
                        className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selected.logo_url && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Logo</p>
                        <img
                          src={`${import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000"}${selected.logo_url}`}
                          alt="Hotel logo"
                          className="h-20 w-20 rounded-md object-cover border"
                        />
                      </div>
                    )}
                    <dl className="grid grid-cols-2 gap-4">
                      <InfoItem label="Name" value={selected.name} />
                      <InfoItem label="Email" value={selected.email} />
                      <InfoItem label="Phone" value={selected.phone} />
                      <InfoItem label="Hotel Status" value={selected.is_active ? "Active" : "Inactive"} />
                      <div className="col-span-2"><InfoItem label="Address" value={selected.address} /></div>
                      <InfoItem label="Registered" value={new Date(selected.created_at).toLocaleDateString()} />
                      <InfoItem label="Last Updated" value={new Date(selected.updated_at).toLocaleDateString()} />
                    </dl>
                  </div>
                )
              ) : null}
            </div>

            {/* ── Subscription Management ── */}
            {selected && (
              <div className="rounded-lg border bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Subscription</h2>
                  {!editingSub && selectedSub && (
                    <button type="button" onClick={() => setEditingSub(true)}
                      className="text-xs text-blue-600 hover:underline">
                      Edit
                    </button>
                  )}
                </div>

                {subMsg && (
                  <p className={`text-xs ${subMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{subMsg.text}</p>
                )}

                {subLoading ? (
                  <p className="text-sm text-gray-400">Loading subscription…</p>
                ) : !selectedSub ? (
                  <p className="text-sm text-gray-400">No subscription found for this hotel.</p>
                ) : editingSub ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Subscription Status</label>
                      <select className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={subForm.status}
                        onChange={(e) => setSubForm((f) => ({ ...f, status: e.target.value }))}>
                        <option value="">— Keep current —</option>
                        <option value="trial">Trial</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Expiry Date</label>
                      <input type="date"
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={subForm.expires_at}
                        onChange={(e) => setSubForm((f) => ({ ...f, expires_at: e.target.value }))} />
                    </div>
                    {packages.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Package</label>
                        <select className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={subForm.package_id}
                          onChange={(e) => setSubForm((f) => ({ ...f, package_id: e.target.value }))}>
                          <option value="">— Keep current —</option>
                          {packages.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={handleSaveSub} disabled={savingSub}
                        className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {savingSub ? "Saving…" : "Save Subscription"}
                      </button>
                      <button type="button" onClick={() => setEditingSub(false)}
                        className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Subscription Status</dt>
                      <dd className="mt-0.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          selectedSub.status === "active"  ? "bg-green-100 text-green-700" :
                          selectedSub.status === "trial"   ? "bg-blue-100 text-blue-700"  :
                          selectedSub.status === "expired" ? "bg-red-100 text-red-700"    :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {selectedSub.status}
                        </span>
                      </dd>
                    </div>
                    <InfoItem label="Package" value={selectedSub.package_name ?? "—"} />
                    <InfoItem label="Package Code" value={selectedSub.package_code ?? "—"} />
                    <InfoItem label="Trial" value={selectedSub.is_trial ? "Yes" : "No"} />
                    <InfoItem label="Expires" value={selectedSub.expires_at ? new Date(selectedSub.expires_at).toLocaleDateString() : "—"} />
                    <InfoItem label="Started" value={selectedSub.started_at ? new Date(selectedSub.started_at).toLocaleDateString() : "—"} />
                  </dl>
                )}
              </div>
            )}

            {/* ── Staff Management ── */}
            {selected && (
              <div className="rounded-lg border bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Staff</h2>
                  <button type="button"
                    onClick={() => { setShowAddUser((v) => !v); setAddUserMsg(null); }}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
                    {showAddUser ? "Cancel" : "+ Add Staff"}
                  </button>
                </div>

                {addUserMsg && (
                  <p className={`text-xs ${addUserMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{addUserMsg.text}</p>
                )}

                {showAddUser && (
                  <form onSubmit={handleAddUser} className="rounded-md bg-gray-50 border p-4 space-y-3">
                    <h3 className="text-xs font-medium text-gray-500 uppercase">New Staff Member</h3>
                    <FormField label="Full Name *" value={addUserForm.full_name} onChange={(v) => setAddUserForm((f) => ({ ...f, full_name: v }))} />
                    <FormField label="Email *" type="email" value={addUserForm.email} onChange={(v) => setAddUserForm((f) => ({ ...f, email: v }))} />
                    <FormField label="Password *" type="password" value={addUserForm.password} onChange={(v) => setAddUserForm((f) => ({ ...f, password: v }))} />
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Role *</label>
                      <select className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={addUserForm.role}
                        onChange={(e) => setAddUserForm((f) => ({ ...f, role: e.target.value }))}>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                        <option value="steward">Steward</option>
                        <option value="housekeeper">Housekeeper</option>
                      </select>
                    </div>
                    <button type="submit"
                      disabled={addingUser || !addUserForm.full_name || !addUserForm.email || addUserForm.password.length < 8}
                      className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                      {addingUser ? "Adding…" : "Add Staff Member"}
                    </button>
                  </form>
                )}

                {usersLoading ? (
                  <p className="text-sm text-gray-400">Loading staff…</p>
                ) : hotelUsers.length === 0 ? (
                  <p className="text-sm text-gray-400">No staff members found.</p>
                ) : (
                  <>
                    <div className="space-y-3 md:hidden">
                      {hotelUsers.map((u) => (
                        <article key={u.id} className="rounded-lg border border-gray-200 p-4 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-gray-900">{u.full_name}</p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBooleanStatusBadgeClass(u.is_active)}`}
                            >
                              {u.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-gray-600">
                            <p>Email: {u.email}</p>
                            <p>Role: {u.role}</p>
                          </div>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleToggleUser(u.id, u.is_active)}
                              disabled={togglingUserId === u.id}
                              className={`w-full rounded border px-2 py-1 text-xs font-medium disabled:opacity-50 sm:w-auto ${
                                u.is_active
                                  ? "border-orange-200 text-orange-700 hover:bg-orange-50"
                                  : "border-green-200 text-green-700 hover:bg-green-50"
                              }`}
                            >
                              {togglingUserId === u.id ? "..." : u.is_active ? "Disable" : "Enable"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.full_name)}
                              disabled={deletingUserId === u.id}
                              className="w-full rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 sm:w-auto"
                            >
                              {deletingUserId === u.id ? "..." : "Remove"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="app-table-scroll hidden md:block">
                      <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                        <tr>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">Role</th>
                          <th className="px-3 py-2 text-left">Staff Status</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {hotelUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{u.full_name}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{u.email}</td>
                            <td className="px-3 py-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium capitalize">{u.role}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBooleanStatusBadgeClass(u.is_active)}`}>
                                {u.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1.5">
                                <button type="button" onClick={() => handleToggleUser(u.id, u.is_active)}
                                  disabled={togglingUserId === u.id}
                                  className={`rounded border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                                    u.is_active
                                      ? "border-orange-200 text-orange-700 hover:bg-orange-50"
                                      : "border-green-200 text-green-700 hover:bg-green-50"
                                  }`}>
                                  {togglingUserId === u.id ? "…" : u.is_active ? "Disable" : "Enable"}
                                </button>
                                <button type="button" onClick={() => handleDeleteUser(u.id, u.full_name)}
                                  disabled={deletingUserId === u.id}
                                  className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                                  {deletingUserId === u.id ? "…" : "Remove"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        )}

        {confirmAction && (
          <ActionDialog
            title={confirmAction.title}
            description={confirmAction.description}
            error={confirmError}
            busy={confirmBusy}
            onClose={() => {
              if (confirmBusy) return;
              setConfirmAction(null);
              setConfirmError(null);
            }}
            onConfirm={() => void runConfirmedAction()}
            confirmLabel={confirmBusy ? "Processing..." : confirmAction.confirmLabel}
            confirmTone={confirmAction.confirmTone}
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}

function FormField({
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

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value ?? "—"}</dd>
    </div>
  );
}

function getBooleanStatusBadgeClass(isActive: boolean): string {
  return isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
}

function getSubscriptionStatusBadgeClass(status: string | undefined): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "trial":
      return "bg-blue-100 text-blue-700";
    case "expired":
      return "bg-red-100 text-red-700";
    case "cancelled":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function formatSubscriptionStatusLabel(status: string | undefined): string {
  if (!status || status === "none") return "No Subscription";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
