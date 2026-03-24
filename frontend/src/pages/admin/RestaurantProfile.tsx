import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Star } from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import type { AdminDashboardOverviewResponse, DashboardSubscriptionSummary } from "@/types/dashboard";
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

type NoticeTone = "success" | "error";

interface NoticeMessage {
  tone: NoticeTone;
  text: string;
}

export default function RestaurantProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aliveRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [restaurant, setRestaurant] = useState<RestaurantMeResponse | null>(null);
  const [subscriptionSummary, setSubscriptionSummary] = useState<DashboardSubscriptionSummary | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<NoticeMessage | null>(null);
  const [form, setForm] = useState<RestaurantUpdateRequest>({});

  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<NoticeMessage | null>(null);

  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupCountry, setSetupCountry] = useState("");
  const [setupCurrency, setSetupCurrency] = useState("");
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    void loadProfile();

    return () => {
      aliveRef.current = false;
    };
  }, []);

  async function loadProfile(options?: { showLoader?: boolean }) {
    const showLoader = options?.showLoader ?? true;

    if (showLoader) {
      setLoading(true);
    }

    setFetchError(null);

    let profileData: RestaurantMeResponse | null = null;

    try {
      profileData = await api.get<RestaurantMeResponse>("/restaurants/me");
      if (!aliveRef.current) {
        return;
      }

      setRestaurant(profileData);
      resetForm(profileData);

      const countryMissing = !profileData.country || !profileData.country.trim();
      const currencyMissing = !profileData.currency || !profileData.currency.trim();
      if (countryMissing || currencyMissing) {
        setSetupCountry(profileData.country ?? "");
        setSetupCurrency(profileData.currency ?? "");
        setSetupModalOpen(true);
      }
    } catch (err) {
      if (!aliveRef.current) {
        return;
      }

      const message =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Failed to load restaurant profile.";
      setFetchError(message || "Failed to load restaurant profile.");
      setRestaurant(null);
      setSubscriptionSummary(null);

      if (showLoader) {
        setLoading(false);
      }
      return;
    }

    try {
      const overviewData = await api.get<AdminDashboardOverviewResponse>("/dashboard/admin-overview");
      if (!aliveRef.current) {
        return;
      }
      setSubscriptionSummary(overviewData.subscription);
    } catch {
      if (!aliveRef.current) {
        return;
      }
      // Non-blocking: the profile should remain usable even if overview fails.
      setSubscriptionSummary(null);
    } finally {
      if (showLoader && aliveRef.current) {
        setLoading(false);
      }
    }
  }

  function resetForm(data: RestaurantMeResponse) {
    setForm({
      name: data.name,
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      address: data.address ?? undefined,
      country: data.country ?? undefined,
      currency: data.currency ?? undefined,
      billing_email: data.billing_email ?? undefined,
      tax_id: data.tax_id ?? undefined,
      opening_time: data.opening_time ?? undefined,
      closing_time: data.closing_time ?? undefined,
    });
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadProfile({ showLoader: false });
    if (aliveRef.current) {
      setRefreshing(false);
    }
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

      if (!aliveRef.current) {
        return;
      }

      setRestaurant(updated);
      resetForm(updated);
      setSetupModalOpen(false);
      setProfileNotice({ tone: "success", text: "Country and currency saved successfully." });
    } catch (err) {
      if (!aliveRef.current) {
        return;
      }

      const detail =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Failed to save country and currency.";
      setSetupError(detail || "Failed to save country and currency.");
    } finally {
      if (aliveRef.current) {
        setSetupSaving(false);
      }
    }
  }

  async function handleSave() {
    if (!restaurant) {
      return;
    }

    if (!form.name || !form.name.trim()) {
      setProfileNotice({ tone: "error", text: "Restaurant name is required." });
      return;
    }

    setSaving(true);
    setProfileNotice(null);

    try {
      const updated = await api.patch<RestaurantMeResponse>("/restaurants/me", {
        ...form,
        name: form.name.trim(),
      });

      if (!aliveRef.current) {
        return;
      }

      setRestaurant(updated);
      resetForm(updated);
      setEditing(false);
      setProfileNotice({ tone: "success", text: "Profile updated successfully." });
    } catch (err) {
      if (!aliveRef.current) {
        return;
      }

      const detail =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Failed to save profile changes.";

      setProfileNotice({
        tone: "error",
        text: detail || "Failed to save profile changes.",
      });
    } finally {
      if (aliveRef.current) {
        setSaving(false);
      }
    }
  }

  function handleCancelEdit() {
    if (!restaurant) {
      return;
    }

    resetForm(restaurant);
    setEditing(false);
    setProfileNotice(null);
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !restaurant) {
      return;
    }

    setUploading(true);
    setUploadNotice(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await api.post<RestaurantLogoUploadResponse>("/restaurants/me/logo", formData);
      if (!aliveRef.current) {
        return;
      }

      setRestaurant((prev) => (prev ? { ...prev, logo_url: data.logo_url } : prev));
      setUploadNotice({ tone: "success", text: "Logo uploaded successfully." });
    } catch (err) {
      if (!aliveRef.current) {
        return;
      }

      const detail =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Logo upload failed.";

      setUploadNotice({ tone: "error", text: detail || "Logo upload failed." });
    } finally {
      if (aliveRef.current) {
        setUploading(false);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </DashboardLayout>
    );
  }

  if (fetchError || !restaurant) {
    return (
      <DashboardLayout>
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-800">Unable to load restaurant profile</h1>
          <p className="mt-2 text-sm text-red-700">{fetchError ?? "Restaurant profile not found."}</p>
          <button
            type="button"
            onClick={() => void loadProfile()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </section>
      </DashboardLayout>
    );
  }

  const logoSrc = restaurant.logo_url
    ? `${import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000"}${restaurant.logo_url}`
    : null;

  const trialDaysRemaining = subscriptionSummary?.days_remaining ?? null;
  const showTrialBanner =
    Boolean(subscriptionSummary?.is_trial) &&
    (trialDaysRemaining === null || trialDaysRemaining >= 0);
  const trialDaysLabel = trialDaysRemaining ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile Management</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Restaurant Profile</h1>
              <p className="mt-1 text-sm text-slate-600">
                Keep business identity, contact details, and operating hours accurate.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => navigate("/admin/menu/menus")}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Go to Admin Dashboard
              </button>
            </div>
          </div>
        </section>

        {showTrialBanner && (
          <section className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
                  <Star className="h-6 w-6 fill-slate-900 text-slate-900" />
                  30 Days Free Trial
                </h2>
                <p className="mt-2 text-base text-slate-700">
                  You are currently using our free trial. Enjoy all features for {trialDaysLabel} more day(s).
                </p>
              </div>
              <p className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-base font-semibold text-orange-700">
                <Clock3 className="h-4 w-4" />
                {trialDaysLabel} day(s) remaining
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-4">
              <p className="text-sm text-slate-700">
                Upgrade now to continue using all modules without interruption when your trial ends.
              </p>
              <button
                type="button"
                onClick={() => navigate("/admin/subscription")}
                className="mt-3 rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Upgrade Now
              </button>
            </div>
          </section>
        )}

        {profileNotice && <NoticeBanner tone={profileNotice.tone} text={profileNotice.text} />}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title="Branding"
            description="Upload a logo to represent your restaurant in menus and dashboard views."
          />

          <div className="mt-4 flex flex-wrap items-center gap-4">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="Restaurant logo"
                className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs font-medium text-slate-400">
                No logo
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="logo-upload"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {uploading ? "Uploading..." : "Upload logo"}
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
              <p className="text-xs text-slate-500">Supported: JPG, PNG, WebP. Max size: 5 MB.</p>
              {uploadNotice && <NoticeText tone={uploadNotice.tone}>{uploadNotice.text}</NoticeText>}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <SectionHeader
              title="Business Details"
              description="Maintain contact, billing, and operation schedule details."
            />
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setProfileNotice(null);
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Name *"
                  value={form.name ?? ""}
                  onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                />
                <InputField
                  label="Email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(value) => setForm((prev) => ({ ...prev, email: toNullable(value) }))}
                />
                <InputField
                  label="Phone"
                  value={form.phone ?? ""}
                  onChange={(value) => setForm((prev) => ({ ...prev, phone: toNullable(value) }))}
                />
                <SelectField
                  label="Country"
                  value={form.country ?? ""}
                  options={COUNTRY_OPTIONS}
                  placeholder="Select country"
                  onChange={(value) => setForm((prev) => ({ ...prev, country: toNullable(value) }))}
                />
                <SelectField
                  label="Currency"
                  value={form.currency ?? ""}
                  options={CURRENCY_OPTIONS}
                  placeholder="Select currency"
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, currency: value ? value.toUpperCase() : null }))
                  }
                />
                <InputField
                  label="Billing Email"
                  type="email"
                  value={form.billing_email ?? ""}
                  onChange={(value) => setForm((prev) => ({ ...prev, billing_email: toNullable(value) }))}
                />
                <InputField
                  label="Tax ID"
                  value={form.tax_id ?? ""}
                  onChange={(value) => setForm((prev) => ({ ...prev, tax_id: toNullable(value) }))}
                />
                <InputField
                  label="Opening Time"
                  type="time"
                  value={form.opening_time ?? ""}
                  onChange={(value) => setForm((prev) => ({ ...prev, opening_time: toNullable(value) }))}
                />
                <InputField
                  label="Closing Time"
                  type="time"
                  value={form.closing_time ?? ""}
                  onChange={(value) => setForm((prev) => ({ ...prev, closing_time: toNullable(value) }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
                <textarea
                  value={form.address ?? ""}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, address: toNullable(event.target.value) }))
                  }
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-md border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailItem label="Name" value={restaurant.name} />
              <DetailItem label="Email" value={restaurant.email} />
              <DetailItem label="Phone" value={restaurant.phone} />
              <DetailItem label="Country" value={restaurant.country} />
              <DetailItem label="Currency" value={restaurant.currency} />
              <DetailItem label="Billing Email" value={restaurant.billing_email} />
              <DetailItem label="Tax ID" value={restaurant.tax_id} />
              <DetailItem label="Opening Time" value={restaurant.opening_time} />
              <DetailItem label="Closing Time" value={restaurant.closing_time} />
              <DetailItem label="Status" value={restaurant.is_active ? "Active" : "Inactive"} />
              <DetailItem label="Address" value={restaurant.address} fullWidth />
            </dl>
          )}
        </section>
      </div>

      {setupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">Set Country and Currency</h2>
            <p className="mt-1 text-sm text-slate-600">
              Complete these fields to continue using billing and subscription modules correctly.
            </p>

            <div className="mt-5 space-y-4">
              <SelectField
                label="Country"
                value={setupCountry}
                options={COUNTRY_OPTIONS}
                placeholder="Select country"
                onChange={setSetupCountry}
              />

              <SelectField
                label="Currency"
                value={setupCurrency}
                options={CURRENCY_OPTIONS}
                placeholder="Select currency"
                onChange={setSetupCurrency}
              />

              {setupError && <NoticeText tone="error">{setupError}</NoticeText>}

              <button
                type="button"
                onClick={handleSetupSave}
                disabled={setupSaving}
                className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {setupSaving ? "Saving..." : "Save and Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function NoticeBanner({ tone, text }: { tone: NoticeTone; text: string }) {
  const isSuccess = tone === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{text}</p>
    </div>
  );
}

function NoticeText({ tone, children }: { tone: NoticeTone; children: ReactNode }) {
  return (
    <p className={`text-xs ${tone === "success" ? "text-emerald-600" : "text-red-600"}`}>{children}</p>
  );
}

function InputField({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function DetailItem({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string | null | undefined;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value || "--"}</dd>
    </div>
  );
}

function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
