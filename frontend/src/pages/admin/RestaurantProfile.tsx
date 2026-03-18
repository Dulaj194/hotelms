import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/shared/DashboardLayout";
import type {
  RestaurantLogoUploadResponse,
  RestaurantMeResponse,
  RestaurantUpdateRequest,
} from "@/types/restaurant";

const COUNTRY_OPTIONS = [
  "Sri Lanka",
  "India",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Australia",
  "Singapore",
  "Maldives",
];

const CURRENCY_OPTIONS = ["LKR", "INR", "AED", "GBP", "USD", "AUD", "SGD", "MVR"];
export default function RestaurantProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantMeResponse | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState<RestaurantUpdateRequest>({});

  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupCountry, setSetupCountry] = useState("");
  const [setupCurrency, setSetupCurrency] = useState("");
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    api
      .get<RestaurantMeResponse>("/restaurants/me")
      .then((data) => {
        setRestaurant(data);
        resetForm(data);
        const countryMissing = !data.country || !data.country.trim();
        const currencyMissing = !data.currency || !data.currency.trim();
        if (countryMissing || currencyMissing) {
          setSetupCountry(data.country ?? "");
          setSetupCurrency(data.currency ?? "");
          setSetupModalOpen(true);
        }
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
      country: data.country ?? undefined,
      currency: data.currency ?? undefined,
    });
  }

  async function handleSetupSave() {
    if (!setupCountry || !setupCurrency) {
      setSetupError("Please select both country and currency.");
      return;
    }

    setSetupSaving(true);
    setSetupError(null);
    try {
      const updated = await api.patch<RestaurantMeResponse>("/restaurants/me", {
        country: setupCountry,
        currency: setupCurrency,
      });
      setRestaurant(updated);
      resetForm(updated);
      setSetupModalOpen(false);
      setSaveMsg({ type: "ok", text: "Country and currency saved successfully." });
    } catch {
      setSetupError("Failed to save country and currency.");
    } finally {
      setSetupSaving(false);
    }
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

      const data = await api.post<RestaurantLogoUploadResponse>(
        "/restaurants/me/logo",
        formData,
      );
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
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Restaurant Profile</h1>
          <button
            onClick={() => navigate("/admin/menu/menus")}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Admin Dashboard
          </button>
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
              <FormField
                label="Country"
                value={form.country ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, country: v || null }))}
              />
              <FormField
                label="Currency"
                value={form.currency ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, currency: v.toUpperCase() || null }))}
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
              <InfoItem label="Country" value={restaurant.country ?? "Unknown Country"} />
              <InfoItem label="Currency" value={restaurant.currency ?? "Unknown Currency"} />
              <InfoItem label="Status" value={restaurant.is_active ? "Active" : "Inactive"} />
              <div className="col-span-2">
                <InfoItem label="Address" value={restaurant.address} />
              </div>
            </dl>
          )}
        </div>
      </div>

      {setupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-4xl font-semibold text-center text-gray-700">Add Country and Currency</h2>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="block text-3xl font-semibold text-center">Country</label>
                <select
                  value={setupCountry}
                  onChange={(e) => setSetupCountry(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Country</option>
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-3xl font-semibold text-center">Currency</label>
                <select
                  value={setupCurrency}
                  onChange={(e) => setSetupCurrency(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Currency</option>
                  {CURRENCY_OPTIONS.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>

              {setupError && <p className="text-sm text-red-600">{setupError}</p>}

              <div className="pt-1 text-center">
                <button
                  onClick={handleSetupSave}
                  disabled={setupSaving}
                  className="rounded-md bg-blue-600 px-6 py-2 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {setupSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
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
