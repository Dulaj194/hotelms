import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Star } from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import type {
  AdminDashboardOverviewResponse,
  DashboardSetupRequirement,
  DashboardSubscriptionSummary,
} from "@/types/dashboard";
import type {
  RestaurantLogoUploadResponse,
  RestaurantMeResponse,
  CountryLookupListResponse,
  CountryLookupItem,
  CurrencyLookupListResponse,
  CurrencyLookupItem,
  RestaurantUpdateRequest,
} from "@/types/restaurant";

type NoticeTone = "success" | "error";

interface NoticeMessage {
  tone: NoticeTone;
  text: string;
}

interface BusinessFormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  country_id: string;
  currency_id: string;
  billing_email: string;
  tax_id: string;
}

interface ScheduleFormState {
  opening_time: string;
  closing_time: string;
}

const SETUP_SECTION_LABELS: Record<string, string> = {
  country: "Business Details",
  currency: "Business Details",
  billing_email: "Business Details",
  tax_id: "Business Details",
  logo_url: "Branding",
  opening_time: "Operating Schedule",
  closing_time: "Operating Schedule",
};

export default function RestaurantProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aliveRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [restaurant, setRestaurant] = useState<RestaurantMeResponse | null>(null);
  const [subscriptionSummary, setSubscriptionSummary] = useState<DashboardSubscriptionSummary | null>(null);
  const [setupRequirements, setSetupRequirements] = useState<DashboardSetupRequirement[]>([]);
  const [setupProgress, setSetupProgress] = useState<number | null>(null);
  const [countryOptions, setCountryOptions] = useState<CountryLookupItem[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyLookupItem[]>([]);

  const [editingBusiness, setEditingBusiness] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessForm, setBusinessForm] = useState<BusinessFormState>({
    name: "",
    email: "",
    phone: "",
    address: "",
    country_id: "",
    currency_id: "",
    billing_email: "",
    tax_id: "",
  });

  const [editingSchedule, setEditingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [profileNotice, setProfileNotice] = useState<NoticeMessage | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    opening_time: "",
    closing_time: "",
  });

  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<NoticeMessage | null>(null);

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

    try {
      const profileData = await api.get<RestaurantMeResponse>("/restaurants/me");
      if (!aliveRef.current) {
        return;
      }

      setRestaurant(profileData);
      resetBusinessForm(profileData);
      resetScheduleForm(profileData);
      await loadReferenceLookups();
    } catch (err) {
      if (!aliveRef.current) {
        return;
      }

      setFetchError(getErrorMessage(err, "Failed to load restaurant profile."));
      setRestaurant(null);
      setSubscriptionSummary(null);
      setSetupRequirements([]);
      setSetupProgress(null);
      setCountryOptions([]);
      setCurrencyOptions([]);

      if (showLoader) {
        setLoading(false);
      }
      return;
    }

    await loadOverviewSummary();

    if (showLoader && aliveRef.current) {
      setLoading(false);
    }
  }

  async function loadOverviewSummary() {
    try {
      const overviewData = await api.get<AdminDashboardOverviewResponse>("/dashboard/admin-overview");
      if (!aliveRef.current) {
        return;
      }

      setSubscriptionSummary(overviewData.subscription);
      setSetupRequirements(overviewData.setup_requirements);
      setSetupProgress(overviewData.setup_wizard.progress_percent);
    } catch {
      if (!aliveRef.current) {
        return;
      }

      // Non-blocking call: profile UI remains usable without setup summary.
      setSubscriptionSummary(null);
      setSetupRequirements([]);
      setSetupProgress(null);
    }
  }

  async function loadReferenceLookups() {
    try {
      const [countryData, currencyData] = await Promise.all([
        api.get<CountryLookupListResponse>("/reference-data/countries"),
        api.get<CurrencyLookupListResponse>("/reference-data/currencies"),
      ]);
      if (!aliveRef.current) {
        return;
      }

      setCountryOptions(countryData.items);
      setCurrencyOptions(currencyData.items);
    } catch {
      if (!aliveRef.current) {
        return;
      }
      // Non-blocking: profile editing still works with existing values.
      setCountryOptions([]);
      setCurrencyOptions([]);
    }
  }

  function resetBusinessForm(data: RestaurantMeResponse) {
    setBusinessForm({
      name: data.name,
      email: data.email ?? "",
      phone: data.phone ?? "",
      address: data.address ?? "",
      country_id: data.country_id ? String(data.country_id) : "",
      currency_id: data.currency_id ? String(data.currency_id) : "",
      billing_email: data.billing_email ?? "",
      tax_id: data.tax_id ?? "",
    });
  }

  function resetScheduleForm(data: RestaurantMeResponse) {
    setScheduleForm({
      opening_time: data.opening_time ?? "",
      closing_time: data.closing_time ?? "",
    });
  }

  async function handleRefresh() {
    setRefreshing(true);
    setProfileNotice(null);
    setUploadNotice(null);
    await loadProfile({ showLoader: false });
    if (aliveRef.current) {
      setRefreshing(false);
    }
  }

  async function saveProfileChanges(
    payload: RestaurantUpdateRequest,
    messages: { success: string; failure: string },
  ): Promise<RestaurantMeResponse | null> {
    try {
      const updated = await api.patch<RestaurantMeResponse>("/restaurants/me", payload);
      if (!aliveRef.current) {
        return null;
      }

      setRestaurant(updated);
      resetBusinessForm(updated);
      resetScheduleForm(updated);
      await loadOverviewSummary();

      if (!aliveRef.current) {
        return null;
      }

      setProfileNotice({ tone: "success", text: messages.success });
      return updated;
    } catch (err) {
      if (!aliveRef.current) {
        return null;
      }

      setProfileNotice({ tone: "error", text: getErrorMessage(err, messages.failure) });
      return null;
    }
  }

  async function handleBusinessSave() {
    if (!restaurant) {
      return;
    }

    const trimmedName = businessForm.name.trim();
    if (!trimmedName) {
      setProfileNotice({ tone: "error", text: "Restaurant name is required." });
      return;
    }

    setSavingBusiness(true);
    setProfileNotice(null);

    const updated = await saveProfileChanges(
      {
        name: trimmedName,
        email: toNullable(businessForm.email),
        phone: toNullable(businessForm.phone),
        address: toNullable(businessForm.address),
        country_id: toNullableNumber(businessForm.country_id),
        currency_id: toNullableNumber(businessForm.currency_id),
        billing_email: toNullable(businessForm.billing_email),
        tax_id: toNullable(businessForm.tax_id),
      },
      {
        success: "Business details updated successfully.",
        failure: "Failed to save business details.",
      },
    );

    if (updated && aliveRef.current) {
      setEditingBusiness(false);
    }

    if (aliveRef.current) {
      setSavingBusiness(false);
    }
  }

  function handleCancelBusinessEdit() {
    if (!restaurant) {
      return;
    }

    resetBusinessForm(restaurant);
    setEditingBusiness(false);
    setProfileNotice(null);
  }

  async function handleScheduleSave() {
    if (!restaurant) {
      return;
    }

    setSavingSchedule(true);
    setProfileNotice(null);

    const updated = await saveProfileChanges(
      {
        opening_time: toNullable(scheduleForm.opening_time),
        closing_time: toNullable(scheduleForm.closing_time),
      },
      {
        success: "Operating schedule updated successfully.",
        failure: "Failed to save operating schedule.",
      },
    );

    if (updated && aliveRef.current) {
      setEditingSchedule(false);
    }

    if (aliveRef.current) {
      setSavingSchedule(false);
    }
  }

  function handleCancelScheduleEdit() {
    if (!restaurant) {
      return;
    }

    resetScheduleForm(restaurant);
    setEditingSchedule(false);
    setProfileNotice(null);
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
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
      await loadOverviewSummary();

      if (!aliveRef.current) {
        return;
      }

      setUploadNotice({ tone: "success", text: "Logo uploaded successfully." });
    } catch (err) {
      if (!aliveRef.current) {
        return;
      }

      setUploadNotice({ tone: "error", text: getErrorMessage(err, "Logo upload failed.") });
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

  const pendingRequirements = setupRequirements.filter((item) => !item.completed);
  const blockingRequirements = pendingRequirements.filter((item) => item.severity === "blocking");
  const countrySelectOptions = countryOptions.map((item) => ({
    value: String(item.id),
    label: item.name,
  }));
  const currencySelectOptions = currencyOptions.map((item) => ({
    value: String(item.id),
    label: `${item.code} - ${item.name}`,
  }));
  if (
    businessForm.country_id &&
    !countrySelectOptions.some((item) => item.value === businessForm.country_id)
  ) {
    countrySelectOptions.unshift({
      value: businessForm.country_id,
      label: restaurant.country ?? `Country #${businessForm.country_id}`,
    });
  }
  if (
    businessForm.currency_id &&
    !currencySelectOptions.some((item) => item.value === businessForm.currency_id)
  ) {
    currencySelectOptions.unshift({
      value: businessForm.currency_id,
      label: restaurant.currency ?? `Currency #${businessForm.currency_id}`,
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile Management</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Restaurant Profile</h1>
              <p className="mt-1 text-sm text-slate-600">
                Complete branding, business details, and operating hours from one place.
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
                onClick={() => navigate("/dashboard")}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Dashboard
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

        {setupRequirements.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeader
                title="Setup Status"
                description="These fields drive the dashboard setup wizard and operational readiness checks."
              />
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {setupProgress ?? 0}% complete
              </span>
            </div>

            <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-blue-600"
                style={{ width: `${setupProgress ?? 0}%` }}
              />
            </div>

            {pendingRequirements.length === 0 ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                All setup requirements are complete. Your profile is ready for daily operations.
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {pendingRequirements.map((item) => {
                  const isBlocking = item.severity === "blocking";
                  return (
                    <div
                      key={item.key}
                      className={`rounded-xl border px-4 py-3 ${
                        isBlocking
                          ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                            isBlocking
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {item.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        Update in {getSetupSectionLabel(item.key)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {blockingRequirements.length > 0 && (
              <p className="mt-4 text-xs text-slate-500">
                Blocking items must be completed before operational workflows are fully ready.
              </p>
            )}
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
              description="Core restaurant profile information used by setup, billing, and daily operations."
            />
            {!editingBusiness && (
              <button
                type="button"
                onClick={() => {
                  resetScheduleForm(restaurant);
                  setEditingSchedule(false);
                  setEditingBusiness(true);
                  setProfileNotice(null);
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Edit Details
              </button>
            )}
          </div>

          {editingBusiness ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Name"
                  value={businessForm.name}
                  onChange={(value) => setBusinessForm((prev) => ({ ...prev, name: value }))}
                />
                <InputField
                  label="Email"
                  type="email"
                  value={businessForm.email}
                  onChange={(value) => setBusinessForm((prev) => ({ ...prev, email: value }))}
                />
                <InputField
                  label="Phone"
                  value={businessForm.phone}
                  onChange={(value) => setBusinessForm((prev) => ({ ...prev, phone: value }))}
                />
                <SelectField
                  label="Country"
                  value={businessForm.country_id}
                  options={countrySelectOptions}
                  placeholder="Select country"
                  onChange={(value) => setBusinessForm((prev) => ({ ...prev, country_id: value }))}
                />
                <SelectField
                  label="Currency"
                  value={businessForm.currency_id}
                  options={currencySelectOptions}
                  placeholder="Select currency"
                  onChange={(value) => setBusinessForm((prev) => ({ ...prev, currency_id: value }))}
                />
                <InputField
                  label="Billing Email"
                  type="email"
                  value={businessForm.billing_email}
                  onChange={(value) =>
                    setBusinessForm((prev) => ({ ...prev, billing_email: value }))
                  }
                />
                <InputField
                  label="Tax ID"
                  value={businessForm.tax_id}
                  onChange={(value) => setBusinessForm((prev) => ({ ...prev, tax_id: value }))}
                />
              </div>

              <TextAreaField
                label="Address"
                value={businessForm.address}
                onChange={(value) => setBusinessForm((prev) => ({ ...prev, address: value }))}
              />

              <p className="text-xs text-slate-500">
                Country and currency are required to clear setup blockers. Billing email and tax ID
                help with invoices and subscription notifications.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleBusinessSave}
                  disabled={savingBusiness}
                  className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingBusiness ? "Saving..." : "Save Details"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelBusinessEdit}
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
              <DetailItem label="Status" value={restaurant.is_active ? "Active" : "Inactive"} />
              <DetailItem label="Address" value={restaurant.address} fullWidth />
            </dl>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <SectionHeader
              title="Operating Schedule"
              description="Update opening and closing times used by daily operational checks."
            />
            {!editingSchedule && (
              <button
                type="button"
                onClick={() => {
                  resetBusinessForm(restaurant);
                  setEditingBusiness(false);
                  setEditingSchedule(true);
                  setProfileNotice(null);
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Edit Schedule
              </button>
            )}
          </div>

          {editingSchedule ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Opening Time"
                  type="time"
                  value={scheduleForm.opening_time}
                  onChange={(value) =>
                    setScheduleForm((prev) => ({ ...prev, opening_time: value }))
                  }
                />
                <InputField
                  label="Closing Time"
                  type="time"
                  value={scheduleForm.closing_time}
                  onChange={(value) =>
                    setScheduleForm((prev) => ({ ...prev, closing_time: value }))
                  }
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleScheduleSave}
                  disabled={savingSchedule}
                  className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSchedule ? "Saving..." : "Save Schedule"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelScheduleEdit}
                  className="rounded-md border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailItem label="Opening Time" value={restaurant.opening_time} />
              <DetailItem label="Closing Time" value={restaurant.closing_time} />
            </dl>
          )}
        </section>
      </div>
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
  return <p className={`text-xs ${tone === "success" ? "text-emerald-600" : "text-red-600"}`}>{children}</p>;
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
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
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

function toNullableNumber(value: string): number | null {
  const normalized = toNullable(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.detail || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

function getSetupSectionLabel(key: string): string {
  return SETUP_SECTION_LABELS[key] ?? "Restaurant Profile";
}
