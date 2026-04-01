import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { api } from "@/lib/api";
import type { PromoCodeListResponse } from "@/types/promo";
import type { PackageListResponse } from "@/types/subscription";
import type { SettingsRequestListResponse } from "@/types/settings";
import type {
  PendingRestaurantRegistrationListResponse,
  RestaurantMeResponse,
} from "@/types/restaurant";

import {
  badgeClassName,
  formatDateTime,
  formatRegistrationStatus,
  getApiErrorMessage,
  getPromoLifecycle,
  registrationTone,
} from "@/pages/super-admin/utils";

type OverviewData = {
  restaurants: RestaurantMeResponse[];
  registrations: PendingRestaurantRegistrationListResponse;
  settings: SettingsRequestListResponse;
  promos: PromoCodeListResponse;
  packages: PackageListResponse;
};

function StatCard({
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

export default function SuperAdminOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadOverview();
  }, []);

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
      const [restaurants, registrations, settings, promos, packages] = await Promise.all([
        api.get<RestaurantMeResponse[]>("/restaurants"),
        api.get<PendingRestaurantRegistrationListResponse>("/restaurants/registrations/pending?limit=200"),
        api.get<SettingsRequestListResponse>("/settings/requests/pending?limit=200"),
        api.get<PromoCodeListResponse>("/promo-codes"),
        api.get<PackageListResponse>("/packages"),
      ]);

      setData({
        restaurants,
        registrations,
        settings,
        promos,
        packages,
      });
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load platform overview."));
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    if (!data) {
      return {
        totalHotels: 0,
        activeHotels: 0,
        inactiveHotels: 0,
        rejectedHotels: 0,
        activePromos: 0,
      };
    }

    const approvedHotels = data.restaurants.filter(
      (restaurant) => restaurant.registration_status === "APPROVED",
    );
    const activePromos = data.promos.items.filter(
      (promo) => getPromoLifecycle(promo).label === "Active",
    );

    return {
      totalHotels: data.restaurants.length,
      activeHotels: approvedHotels.filter((restaurant) => restaurant.is_active).length,
      inactiveHotels: approvedHotels.filter((restaurant) => !restaurant.is_active).length,
      rejectedHotels: data.restaurants.filter(
        (restaurant) => restaurant.registration_status === "REJECTED",
      ).length,
      activePromos: activePromos.length,
    };
  }, [data]);

  const watchlist = useMemo(() => {
    if (!data) return [];
    return data.restaurants
      .filter((restaurant) => restaurant.registration_status === "APPROVED" && !restaurant.is_active)
      .slice(0, 6);
  }, [data]);

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <h1 className="app-page-title text-slate-900">Platform Overview</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Monitor hotel onboarding, tenant health, pending governance tasks, and platform-wide
                promotions from one place.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="app-btn-ghost"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading platform overview...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Hotels"
                value={metrics.totalHotels}
                hint="All registered tenants"
              />
              <StatCard
                label="Live Hotels"
                value={metrics.activeHotels}
                hint="Approved and active"
              />
              <StatCard
                label="Pending Registrations"
                value={data.registrations.total}
                hint="Waiting for review"
              />
              <StatCard
                label="Pending Settings"
                value={data.settings.total}
                hint="Profile changes to review"
              />
              <StatCard
                label="Active Promos"
                value={metrics.activePromos}
                hint="Currently usable codes"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="app-section-title text-slate-900">Registration Queue</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Latest hotel sign-ups waiting for super admin approval.
                    </p>
                  </div>
                  <Link
                    to="/super-admin/registrations"
                    className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                  >
                    Open Queue
                  </Link>
                </div>

                <div className="mt-4 space-y-3">
                  {data.registrations.items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      No pending hotel registrations right now.
                    </div>
                  ) : (
                    data.registrations.items.slice(0, 5).map((item) => (
                      <article
                        key={item.restaurant_id}
                        className="rounded-lg border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-slate-900">{item.name}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              Owner: {item.owner_full_name ?? "Pending owner record"}
                            </p>
                            <p className="text-xs text-slate-500">{item.owner_email ?? "-"}</p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                              registrationTone(item.registration_status),
                            )}`}
                          >
                            {formatRegistrationStatus(item.registration_status)}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                          <p>Phone: {item.phone ?? "-"}</p>
                          <p>Submitted: {formatDateTime(item.created_at)}</p>
                          <p>Hours: {item.opening_time ?? "-"} - {item.closing_time ?? "-"}</p>
                          <p>Billing: {item.billing_email ?? "-"}</p>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="app-section-title text-slate-900">Quick Actions</h2>
                <div className="mt-4 grid gap-3">
                  <Link
                    to="/super-admin/restaurants"
                    className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">Manage Hotels</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Create tenants, review subscriptions, and manage hotel staff.
                    </p>
                  </Link>
                  <Link
                    to="/super-admin/settings-requests"
                    className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">Review Settings Requests</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Approve or reject tenant profile updates before they go live.
                    </p>
                  </Link>
                  <Link
                    to="/super-admin/promo-codes"
                    className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">Manage Promo Codes</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Create campaign codes and control lifecycle windows platform-wide.
                    </p>
                  </Link>
                  <Link
                    to="/super-admin/packages"
                    className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">Manage Packages</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Control pricing tiers, billing cycles, and entitlement bundles.
                    </p>
                  </Link>
                  <Link
                    to="/super-admin/platform-users"
                    className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">Manage Platform Users</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Provision and govern super admin accounts with safer platform access.
                    </p>
                  </Link>
                </div>
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="app-section-title text-slate-900">Package Catalog</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Active subscription plans visible to tenants.
                    </p>
                  </div>
                  <Link
                    to="/super-admin/packages"
                    className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                  >
                    Open Packages
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {data.packages.items.map((pkg) => (
                    <article
                      key={pkg.id}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{pkg.name}</p>
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            {pkg.code}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-slate-700">
                          ${pkg.price} / {pkg.billing_period_days}d
                        </span>
                      </div>
                      {pkg.description && (
                        <p className="mt-2 text-sm text-slate-600">{pkg.description}</p>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="app-section-title text-slate-900">Promo Snapshot</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Current state of platform-wide discount campaigns.
                    </p>
                  </div>
                  <Link
                    to="/super-admin/promo-codes"
                    className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                  >
                    Open Promos
                  </Link>
                </div>

                <div className="mt-4 space-y-3">
                  {data.promos.items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      No promo codes have been created yet.
                    </div>
                  ) : (
                    data.promos.items.slice(0, 6).map((promo) => {
                      const lifecycle = getPromoLifecycle(promo);
                      return (
                        <article
                          key={promo.id}
                          className="rounded-lg border border-slate-200 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{promo.code}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {promo.discount_percent}% discount
                              </p>
                            </div>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                                lifecycle.tone,
                              )}`}
                            >
                              {lifecycle.label}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                            <p>Window: {formatDateTime(promo.valid_from)} - {formatDateTime(promo.valid_until)}</p>
                            <p>
                              Usage: {promo.used_count}
                              {promo.usage_limit !== null ? ` / ${promo.usage_limit}` : " / unlimited"}
                            </p>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="app-section-title text-slate-900">Operational Watchlist</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Tenants and governance items that may need platform attention.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                  <span>Inactive hotels: {metrics.inactiveHotels}</span>
                  <span>Rejected registrations: {metrics.rejectedHotels}</span>
                  <span>Pending settings: {data.settings.total}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-6 xl:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Inactive Approved Hotels
                  </h3>
                  {watchlist.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      No inactive approved hotels found.
                    </div>
                  ) : (
                    watchlist.map((restaurant) => (
                      <article
                        key={restaurant.id}
                        className="rounded-lg border border-slate-200 p-4"
                      >
                        <p className="text-sm font-semibold text-slate-900">{restaurant.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{restaurant.email ?? "-"}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          Updated {formatDateTime(restaurant.updated_at)}
                        </p>
                      </article>
                    ))
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Latest Settings Requests
                  </h3>
                  {data.settings.items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      No pending settings requests.
                    </div>
                  ) : (
                    data.settings.items.slice(0, 6).map((request) => (
                      <article
                        key={request.request_id}
                        className="rounded-lg border border-slate-200 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">
                            Request #{request.request_id}
                          </p>
                          <span className="text-xs font-medium text-slate-500">
                            Hotel #{request.restaurant_id}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {Object.keys(request.requested_changes).length} field change(s)
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Submitted {formatDateTime(request.created_at)}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
