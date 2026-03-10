import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { RestaurantMeResponse, RestaurantUpdateRequest } from "@/types/restaurant";

export default function RestaurantProfile() {
  const [restaurant, setRestaurant] = useState<RestaurantMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<RestaurantUpdateRequest>({});

  useEffect(() => {
    api
      .get<RestaurantMeResponse>("/restaurants/me")
      .then((data) => {
        setRestaurant(data);
        setForm({
          name: data.name,
          email: data.email ?? undefined,
          phone: data.phone ?? undefined,
          address: data.address ?? undefined,
        });
      })
      .catch(() => setError("Failed to load restaurant profile."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!restaurant) return;
    setSaving(true);
    setSaveError(null);
    try {
      // SECURITY: We only send the form fields — no restaurant_id is included.
      // The backend derives the current restaurant from the access token.
      const updated = await api.patch<RestaurantMeResponse>("/restaurants/me", form);
      setRestaurant(updated);
      setEditing(false);
    } catch {
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading restaurant profile…</p>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-destructive">{error ?? "Restaurant not found."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Restaurant Profile</h1>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <Field label="Name">
            <input
              className="input"
              value={form.name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input"
              value={form.email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value || null }))}
            />
          </Field>
          <Field label="Phone">
            <input
              className="input"
              value={form.phone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value || null }))}
            />
          </Field>
          <Field label="Address">
            <textarea
              className="input resize-none"
              rows={3}
              value={form.address ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value || null }))
              }
            />
          </Field>

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setSaveError(null);
                setForm({
                  name: restaurant.name,
                  email: restaurant.email ?? undefined,
                  phone: restaurant.phone ?? undefined,
                  address: restaurant.address ?? undefined,
                });
              }}
              className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <dl className="space-y-4">
          <InfoRow label="Name" value={restaurant.name} />
          <InfoRow label="Email" value={restaurant.email} />
          <InfoRow label="Phone" value={restaurant.phone} />
          <InfoRow label="Address" value={restaurant.address} />
          <InfoRow
            label="Status"
            value={restaurant.is_active ? "Active" : "Inactive"}
          />
        </dl>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value ?? "—"}</dd>
    </div>
  );
}
