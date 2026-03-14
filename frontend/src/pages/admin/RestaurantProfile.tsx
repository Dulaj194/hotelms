import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getAccessToken, getUser, normalizeRole } from "@/lib/auth";
import DashboardLayout from "@/components/shared/DashboardLayout";
import type {
  RestaurantMeResponse,
  RestaurantUpdateRequest,
  RestaurantCreateRequest,
} from "@/types/restaurant";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

// ─── Super-admin view: list all restaurants + create new ─────────────────────

function SuperAdminView() {
  const [list, setList] = useState<RestaurantMeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<RestaurantCreateRequest>({ name: "" });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function load() {
    setLoading(true);
    api
      .get<RestaurantMeResponse[]>("/restaurants")
      .then(setList)
      .catch(() => setFetchError("Failed to load restaurants."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMsg(null);
    try {
      const created = await api.post<RestaurantMeResponse>("/restaurants", form);
      setList((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm({ name: "" });
      setCreateMsg({ type: "ok", text: `Restaurant "${created.name}" created.` });
    } catch (err) {
      setCreateMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to create restaurant.",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Restaurants</h1>
          <button
            onClick={() => { setShowCreate(true); setCreateMsg(null); }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Restaurant
          </button>
        </div>

        {createMsg && (
          <p className={`text-sm ${createMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
            {createMsg.text}
          </p>
        )}

        {showCreate && (
          <form onSubmit={handleCreate} className="rounded-lg border bg-white p-5 space-y-3">
            <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Create Restaurant</h2>
            <FormField label="Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
            <FormField label="Email" type="email" value={form.email ?? ""} onChange={(v) => setForm((f) => ({ ...f, email: v || null }))} />
            <FormField label="Phone" value={form.phone ?? ""} onChange={(v) => setForm((f) => ({ ...f, phone: v || null }))} />
            <FormField label="Address" value={form.address ?? ""} onChange={(v) => setForm((f) => ({ ...f, address: v || null }))} />
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={creating || !form.name.trim()}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : fetchError ? (
          <p className="text-red-600">{fetchError}</p>
        ) : list.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center text-gray-400">
            No restaurants yet. Create one to get started.
          </div>
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.email ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{r.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Owner/Admin view: own restaurant profile ─────────────────────────────────

function OwnerAdminView() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantMeResponse | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState<RestaurantUpdateRequest>({});

  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<RestaurantMeResponse>("/restaurants/me")
      .then((data) => {
        setRestaurant(data);
        resetForm(data);
      })
      .catch(() => setFetchError("Failed to load restaurant profile."))
      .finally(() => setLoading(false));
  }, []);

  function resetForm(data: RestaurantMeResponse) {
    setForm({
      name: data.name,
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      address: data.address ?? undefined,
    });
  }

  async function handleSave() {
    if (!restaurant) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await api.patch<RestaurantMeResponse>("/restaurants/me", form);
      setRestaurant(updated);
      resetForm(updated);
      setEditing(false);
      setSaveMsg({ type: "ok", text: "Profile updated successfully." });
    } catch {
      setSaveMsg({ type: "err", text: "Failed to save changes." });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !restaurant) return;

    setUploading(true);
    setUploadMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Multipart upload — cannot use regular api.post (JSON-only)
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/restaurants/me/logo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? `Upload failed (${res.status})`);
      }

      const data = await res.json();
      setRestaurant((prev) => prev ? { ...prev, logo_url: data.logo_url } : prev);
      setUploadMsg({ type: "ok", text: "Logo uploaded successfully." });
    } catch (err: unknown) {
      setUploadMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Logo upload failed.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Loading…</p>
      </DashboardLayout>
    );
  }

  if (fetchError || !restaurant) {
    return (
      <DashboardLayout>
        <p className="text-red-600">{fetchError ?? "Restaurant not found."}</p>
      </DashboardLayout>
    );
  }

  const logoSrc = restaurant.logo_url
    ? `${import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000"}${restaurant.logo_url}`
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Restaurant Profile</h1>
        </div>

        {/* Logo section */}
        <div className="rounded-lg border bg-white p-5 space-y-3">
          <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Logo</h2>
          <div className="flex items-center gap-4">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="Restaurant logo"
                className="h-20 w-20 rounded-md object-cover border"
              />
            ) : (
              <div className="h-20 w-20 rounded-md border bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                No logo
              </div>
            )}
            <div>
              <label
                htmlFor="logo-upload"
                className="cursor-pointer rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                {uploading ? "Uploading…" : "Upload logo"}
              </label>
              <input
                id="logo-upload"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
                disabled={uploading}
              />
              <p className="mt-1 text-xs text-gray-400">JPG, PNG or WebP · Max 5 MB</p>
              {uploadMsg && (
                <p
                  className={`mt-1 text-xs ${
                    uploadMsg.type === "ok" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {uploadMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Profile section */}
        <div className="rounded-lg border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Details</h2>
            {!editing && (
              <button
                onClick={() => { setEditing(true); setSaveMsg(null); }}
                className="text-sm text-blue-600 hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {saveMsg && (
            <p className={`text-sm ${saveMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
              {saveMsg.text}
            </p>
          )}

          {editing ? (
            <div className="space-y-3">
              <FormField
                label="Name *"
                value={form.name ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              />
              <FormField
                label="Email"
                type="email"
                value={form.email ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, email: v || null }))}
              />
              <FormField
                label="Phone"
                value={form.phone ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, phone: v || null }))}
              />
              <div className="space-y-1">
                <label className="text-sm font-medium">Address</label>
                <textarea
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  value={form.address ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value || null }))
                  }
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setSaveMsg(null);
                    resetForm(restaurant);
                  }}
                  className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-4">
              <InfoItem label="Name" value={restaurant.name} />
              <InfoItem label="Email" value={restaurant.email} />
              <InfoItem label="Phone" value={restaurant.phone} />
              <InfoItem label="Status" value={restaurant.is_active ? "Active" : "Inactive"} />
              <div className="col-span-2">
                <InfoItem label="Address" value={restaurant.address} />
              </div>
            </dl>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function RestaurantProfile() {
  const user = getUser();
  if (normalizeRole(user?.role) === "super_admin") return <SuperAdminView />;
  return <OwnerAdminView />;
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
