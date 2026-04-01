import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { hasAnyPlatformScope } from "@/features/platform-access/catalog";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
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

const EMPTY_OVERVIEW_DATA: OverviewData = {
  restaurants: [],
  registrations: { items: [], total: 0 },
  settings: { items: [], total: 0 },
  promos: { items: [], total: 0 },
  packages: { items: [] },
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
  const currentUser = getUser();
  const canViewHotels = hasAnyPlatformScope(currentUser?.super_admin_scopes, [
    "ops_viewer",
    "tenant_admin",
    "billing_admin",
    "security_admin",
  ]);
  const canViewTenantQueue = hasAnyPlatformScope(currentUser?.super_admin_scopes, [
    "ops_viewer",
    "tenant_admin",
  ]);
  const canViewSettings = hasAnyPlatformScope(currentUser?.super_admin_scopes, [
    "ops_viewer",
    "tenant_admin",
  ]);
  const canViewPromos = hasAnyPlatformScope(currentUser?.super_admin_scopes, [
    "ops_viewer",
    "billing_admin",
  ]);
  const canViewPackages = hasAnyPlatformScope(currentUser?.super_admin_scopes, [
    "billing_admin",
  ]);
  const canViewNotifications = hasAnyPlatformScope(currentUser?.super_admin_scopes, [
    "ops_viewer",
    "security_admin",
  ]);
  const canViewAudit = hasAnyPlatformScope(currentUser?.super_admin_scopes, [
    "ops_viewer",
    "security_admin",
  ]);
  const canViewPlatformUsers = hasAnyPlatformScope(currentUser?.super_admin_scopes, [
    "security_admin",
  ]);
  const hasScopedAccess =
    canViewHotels ||
    canViewTenantQueue ||
    canViewSettings ||
    canViewPromos ||
    canViewPackages ||
    canViewNotifications ||
    canViewAudit ||
    canViewPlatformUsers;
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadOverview();
  }, []);

  async function loadOverview() {
    setLoading(true);
    setError(null);
    if (!hasScopedAccess) {
      setData(EMPTY_OVERVIEW_DATA);
      setLoading(false);
      return;
    }

    try {
      const [restaurants, registrations, settings, promos, packages] = await Promise.all([
        canViewHotels
          ? api.get<RestaurantMeResponse[]>("/restaurants")
          : Promise.resolve<RestaurantMeResponse[]>([]),
        canViewTenantQueue
          ? api.get<PendingRestaurantRegistrationListResponse>(
              "/restaurants/registrations/pending?limit=200",
            )
          : Promise.resolve<PendingRestaurantRegistrationListResponse>({
              items: [],
              total: 0,
            }),
        canViewSettings
          ? api.get<SettingsRequestListResponse>("/settings/requests/pending?limit=200")
          : Promise.resolve<SettingsRequestListResponse>({
              items: [],
              total: 0,
            }),
        canViewPromos
          ? api.get<PromoCodeListResponse>("/promo-codes")
          : Promise.resolve<PromoCodeListResponse>({
              items: [],
              total: 0,
            }),
        canViewPackages
          ? api.get<PackageListResponse>("/packages")
          : Promise.resolve<PackageListResponse>({
              items: [],
            }),
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

  const quickActions = useMemo(
    () =>
      [
        canViewNotifications
          ? {
              path: "/super-admin/notifications",
              title: "Open Notification Center",
              description: "Watch live governance and package-access events as they happen.",
            }
          : null,
        canViewHotels
          ? {
              path: "/super-admin/restaurants",
              title: "Manage Hotels",
              description: "Open hotel profiles, package access, staff, and integration controls.",
            }
          : null,
        canViewTenantQueue
          ? {
              path: "/super-admin/registrations",
              title: "Review Registrations",
              description: "Approve or reject new hotel sign-ups waiting for onboarding review.",
            }
          : null,
        canViewSettings
          ? {
              path: "/super-admin/settings-requests",
              title: "Review Settings Requests",
              description: "Approve or reject tenant profile and feature-toggle requests.",
            }
          : null,
        canViewPromos
          ? {
              path: "/super-admin/promo-codes",
              title: "Manage Promo Codes",
              description: "Control active campaigns and platform-wide discounts.",
            }
          : null,
        canViewPackages
          ? {
              path: "/super-admin/packages",
              title: "Manage Packages",
              description: "Maintain package tiers, billing cycles, and access bundles.",
            }
          : null,
        canViewAudit
          ? {
              path: "/super-admin/audit-logs",
              title: "Review Audit Logs",
              description: "Search platform approvals, security events, and operational changes.",
            }
          : null,
        canViewPlatformUsers
          ? {
              path: "/super-admin/platform-users",
              title: "Manage Platform Users",
              description: "Provision super admin accounts and keep scope assignments tight.",
            }
          : null,
      ].filter((item): item is { path: string; title: string; description: string } => item !== null),
    [
      canViewAudit,
      canViewHotels,
      canViewNotifications,
      canViewPackages,
      canViewPlatformUsers,
      canViewPromos,
      canViewSettings,
      canViewTenantQueue,
    ],
  );

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

        {!loading && !error && !hasScopedAccess && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            This platform account does not have any active permission scopes yet. Ask a security
            admin to assign at least one scope such as Ops Viewer, Tenant Admin, Billing Admin, or
            Security Admin.
          </div>
        )}

        {data && !loading && hasScopedAccess && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {canViewHotels && (
                <>
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
                </>
              )}
              {canViewTenantQueue && (
                <StatCard
                  label="Pending Registrations"
                  value={data.registrations.total}
                  hint="Waiting for review"
                />
              )}
              {canViewSettings && (
                <StatCard
                  label="Pending Settings"
                  value={data.settings.total}
                  hint="Profile changes to review"
                />
              )}
              {canViewPromos && (
                <StatCard
                  label="Active Promos"
                  value={metrics.activePromos}
                  hint="Currently usable codes"
                />
              )}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              {canViewTenantQueue && (
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
              )}

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="app-section-title text-slate-900">Quick Actions</h2>
                <div className="mt-4 grid gap-3">
                  {quickActions.map((action) => (
                    <Link
                      key={action.path}
                      to={action.path}
                      className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{action.description}</p>
                    </Link>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {canViewPackages && (
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
              )}

              {canViewPromos && (
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
              )}
            </div>

            {(canViewHotels || canViewSettings) && (
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
            )}
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
