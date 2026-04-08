import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { hasAnyPlatformScope } from "@/features/platform-access/catalog";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import {
  badgeClassName,
  formatDateTime,
  formatRegistrationStatus,
  getApiErrorMessage,
  getPromoLifecycle,
  registrationTone,
} from "@/pages/super-admin/utils";
import type { PlatformCommercialOverviewResponse } from "@/types/payment";
import type { PromoCodeListResponse } from "@/types/promo";
import type {
  PendingRestaurantRegistrationListResponse,
  RestaurantMeResponse,
} from "@/types/restaurant";
import type { SettingsRequestListResponse } from "@/types/settings";
import type { PackageListResponse } from "@/types/subscription";

type OverviewData = {
  restaurants: RestaurantMeResponse[];
  registrations: PendingRestaurantRegistrationListResponse;
  settings: SettingsRequestListResponse;
  promos: PromoCodeListResponse;
  packages: PackageListResponse;
  commercial: PlatformCommercialOverviewResponse;
};

const EMPTY_COMMERCIAL: PlatformCommercialOverviewResponse = {
  overdue_payment_count: 0,
  failed_stripe_webhook_count: 0,
  active_trial_count: 0,
  expiring_subscription_count: 0,
  today_revenue_total: 0,
  revenue_by_tenant: [],
  overdue_payments: [],
  failed_stripe_webhooks: [],
  expiring_subscriptions: [],
};

const EMPTY_DATA: OverviewData = {
  restaurants: [],
  registrations: { items: [], total: 0, next_cursor: null, has_more: false },
  settings: { items: [], total: 0, next_cursor: null, has_more: false },
  promos: { items: [], total: 0 },
  packages: { items: [] },
  commercial: EMPTY_COMMERCIAL,
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

function ListCard({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: { id: string; title: string; subtitle: string; meta: string }[];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        items.map((item) => (
          <article key={item.id} className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
            <p className="mt-2 text-xs text-slate-500">{item.meta}</p>
          </article>
        ))
      )}
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
  const canViewTenantQueue = hasAnyPlatformScope(currentUser?.super_admin_scopes, ["ops_viewer", "tenant_admin"]);
  const canViewSettings = hasAnyPlatformScope(currentUser?.super_admin_scopes, ["ops_viewer", "tenant_admin"]);
  const canViewPromos = hasAnyPlatformScope(currentUser?.super_admin_scopes, ["ops_viewer", "billing_admin"]);
  const canViewCommercial = hasAnyPlatformScope(currentUser?.super_admin_scopes, ["ops_viewer", "billing_admin"]);
  const canViewPackages = hasAnyPlatformScope(currentUser?.super_admin_scopes, ["billing_admin"]);
  const canViewNotifications = hasAnyPlatformScope(currentUser?.super_admin_scopes, ["ops_viewer", "security_admin"]);
  const canViewAudit = hasAnyPlatformScope(currentUser?.super_admin_scopes, ["ops_viewer", "security_admin"]);
  const canViewPlatformUsers = hasAnyPlatformScope(currentUser?.super_admin_scopes, ["security_admin"]);
  const hasScopedAccess = [
    canViewHotels,
    canViewTenantQueue,
    canViewSettings,
    canViewPromos,
    canViewCommercial,
    canViewPackages,
    canViewNotifications,
    canViewAudit,
    canViewPlatformUsers,
  ].some(Boolean);

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
      setData(EMPTY_DATA);
      setLoading(false);
      return;
    }

    try {
      const [restaurants, registrations, settings, promos, packages, commercial] = await Promise.all([
        canViewHotels ? api.get<RestaurantMeResponse[]>("/restaurants") : Promise.resolve([]),
        canViewTenantQueue
          ? api.get<PendingRestaurantRegistrationListResponse>("/restaurants/registrations/pending?limit=200")
          : Promise.resolve({ items: [], total: 0, next_cursor: null, has_more: false }),
        canViewSettings
          ? api.get<SettingsRequestListResponse>("/settings/requests/pending?limit=200")
          : Promise.resolve({ items: [], total: 0, next_cursor: null, has_more: false }),
        canViewPromos ? api.get<PromoCodeListResponse>("/promo-codes") : Promise.resolve({ items: [], total: 0 }),
        canViewPackages ? api.get<PackageListResponse>("/packages") : Promise.resolve({ items: [] }),
        canViewCommercial ? api.get<PlatformCommercialOverviewResponse>("/payments/admin/oversight") : Promise.resolve(EMPTY_COMMERCIAL),
      ]);
      setData({ restaurants, registrations, settings, promos, packages, commercial });
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load platform overview."));
    } finally {
      setLoading(false);
    }
  }

  const quickActions = useMemo(
    () =>
      [
        canViewNotifications && ["/super-admin/notifications", "Open Notification Center", "Watch live governance and package-access events."],
        canViewHotels && ["/super-admin/restaurants", "Manage Hotels", "Open hotel profiles, packages, staff, and integrations."],
        canViewTenantQueue && ["/super-admin/registrations", "Review Registrations", "Approve or reject hotel sign-ups waiting for review."],
        canViewSettings && ["/super-admin/settings-requests", "Review Settings Requests", "Approve or reject tenant profile and feature requests."],
        canViewSettings && ["/super-admin/site-content", "Manage Site Content", "Edit public pages, publish blogs, and work the lead inbox."],
        canViewPromos && ["/super-admin/promo-codes", "Manage Promo Codes", "Control active campaigns and platform discounts."],
        canViewPackages && ["/super-admin/packages", "Manage Packages", "Maintain package tiers and access bundles."],
        canViewAudit && ["/super-admin/audit-logs", "Review Audit Logs", "Search platform approvals, billing alerts, and security events."],
        canViewPlatformUsers && ["/super-admin/platform-users", "Manage Platform Users", "Provision super admin accounts and scope assignments."],
      ]
        .filter(Boolean)
        .map((item) => {
          const [path, title, description] = item as [string, string, string];
          return { path, title, description };
        }),
    [canViewAudit, canViewHotels, canViewNotifications, canViewPackages, canViewPlatformUsers, canViewPromos, canViewSettings, canViewTenantQueue],
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
    const approvedHotels = data.restaurants.filter((restaurant) => restaurant.registration_status === "APPROVED");
    const activePromos = data.promos.items.filter((promo) => getPromoLifecycle(promo).label === "Active");
    return {
      totalHotels: data.restaurants.length,
      activeHotels: approvedHotels.filter((restaurant) => restaurant.is_active).length,
      inactiveHotels: approvedHotels.filter((restaurant) => !restaurant.is_active).length,
      rejectedHotels: data.restaurants.filter((restaurant) => restaurant.registration_status === "REJECTED").length,
      activePromos: activePromos.length,
    };
  }, [data]);

  const inactiveHotels = useMemo(
    () => (data ? data.restaurants.filter((restaurant) => restaurant.registration_status === "APPROVED" && !restaurant.is_active).slice(0, 6) : []),
    [data],
  );

  return (
    <SuperAdminLayout>
      <div className="app-page-stack">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <h1 className="app-page-title text-slate-900">Platform Overview</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Monitor hotel onboarding, tenant health, billing risk, and platform-wide operations from one place.
              </p>
            </div>
            <button type="button" onClick={() => void loadOverview()} className="app-btn-ghost">
              Refresh
            </button>
          </div>
        </div>

        {loading && <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading platform overview...</div>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {!loading && !error && !hasScopedAccess && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            This platform account does not have any active permission scopes yet. Ask a security admin to assign at least one scope.
          </div>
        )}

        {data && !loading && hasScopedAccess && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {canViewHotels && <StatCard label="Hotels" value={metrics.totalHotels} hint="All registered tenants" />}
              {canViewHotels && <StatCard label="Live Hotels" value={metrics.activeHotels} hint="Approved and active" />}
              {canViewTenantQueue && <StatCard label="Pending Registrations" value={data.registrations.total} hint="Waiting for review" />}
              {canViewSettings && <StatCard label="Pending Settings" value={data.settings.total} hint="Profile changes to review" />}
              {canViewPromos && <StatCard label="Active Promos" value={metrics.activePromos} hint="Currently usable codes" />}
              {canViewCommercial && <StatCard label="Overdue Payments" value={data.commercial.overdue_payment_count} hint="Pending bills older than 24h" />}
              {canViewCommercial && <StatCard label="Webhook Failures" value={data.commercial.failed_stripe_webhook_count} hint="Stripe failures in last 7 days" />}
              {canViewCommercial && <StatCard label="Active Trials" value={data.commercial.active_trial_count} hint="Trial tenants still running" />}
              {canViewCommercial && <StatCard label="Expiring Soon" value={data.commercial.expiring_subscription_count} hint="Subscriptions ending within 7 days" />}
            </div>

            {canViewCommercial && (
              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="app-section-title text-slate-900">Commercial Oversight</h2>
                      <p className="mt-1 text-sm text-slate-500">Daily billing health, trial exposure, and renewal risk.</p>
                    </div>
                    <div className="rounded-xl bg-slate-900 px-4 py-3 text-white">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Revenue Today</p>
                      <p className="mt-1 text-2xl font-bold">{money.format(data.commercial.today_revenue_total)}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-6 xl:grid-cols-3">
                    <ListCard
                      title="Overdue Payments"
                      emptyText="No overdue bills detected."
                      items={data.commercial.overdue_payments.map((item) => ({
                        id: `bill-${item.bill_id}`,
                        title: item.restaurant_name,
                        subtitle: `Table ${item.table_number} • ${money.format(item.amount)}`,
                        meta: `Opened ${formatDateTime(item.created_at)}`,
                      }))}
                    />
                    <ListCard
                      title="Failed Stripe Webhooks"
                      emptyText="No recent Stripe webhook failures."
                      items={data.commercial.failed_stripe_webhooks.map((item) => ({
                        id: `webhook-${item.audit_log_id}`,
                        title: item.restaurant_name ?? "Platform event",
                        subtitle: item.stripe_event_type ?? "Unknown Stripe event",
                        meta: item.reason ? `${item.reason} • ${formatDateTime(item.created_at)}` : formatDateTime(item.created_at),
                      }))}
                    />
                    <ListCard
                      title="Expiring Subscriptions"
                      emptyText="No subscriptions are expiring this week."
                      items={data.commercial.expiring_subscriptions.map((item) => ({
                        id: `sub-${item.restaurant_id}`,
                        title: item.restaurant_name,
                        subtitle: `${item.package_name ?? "No package"} • ${item.status}`,
                        meta: `${item.days_remaining} day(s) left • ${formatDateTime(item.expires_at)}`,
                      }))}
                    />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="app-section-title text-slate-900">Revenue By Tenant</h2>
                      <p className="mt-1 text-sm text-slate-500">Today&apos;s paid bills grouped by restaurant.</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {data.commercial.revenue_by_tenant.length} active tenant{data.commercial.revenue_by_tenant.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {data.commercial.revenue_by_tenant.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No paid bills have settled today yet.</div>
                    ) : (
                      data.commercial.revenue_by_tenant.map((item) => (
                        <article key={item.restaurant_id} className="rounded-lg border border-slate-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.restaurant_name}</p>
                              <p className="mt-1 text-xs text-slate-500">{item.paid_bill_count} paid bill{item.paid_bill_count === 1 ? "" : "s"} today</p>
                            </div>
                            <p className="text-sm font-semibold text-slate-900">{money.format(item.revenue_today)}</p>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              {canViewTenantQueue && (
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="app-section-title text-slate-900">Registration Queue</h2>
                      <p className="mt-1 text-sm text-slate-500">Latest hotel sign-ups waiting for super admin approval.</p>
                    </div>
                    <Link to="/super-admin/registrations" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Open Queue</Link>
                  </div>
                  <div className="mt-4 space-y-3">
                    {data.registrations.items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No pending hotel registrations right now.</div>
                    ) : (
                      data.registrations.items.slice(0, 5).map((item) => (
                        <article key={item.restaurant_id} className="rounded-lg border border-slate-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-slate-900">{item.name}</p>
                              <p className="mt-1 text-sm text-slate-600">Owner: {item.owner_full_name ?? "Pending owner record"}</p>
                              <p className="text-xs text-slate-500">{item.owner_email ?? "-"}</p>
                            </div>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassName(registrationTone(item.registration_status))}`}>
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
                    <Link key={action.path} to={action.path} className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50">
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
                      <p className="mt-1 text-sm text-slate-500">Active subscription plans visible to tenants.</p>
                    </div>
                    <Link to="/super-admin/packages" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Open Packages</Link>
                  </div>
                  <div className="mt-4 space-y-3">
                    {data.packages.items.map((pkg) => (
                      <article key={pkg.id} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{pkg.name}</p>
                            <p className="text-xs uppercase tracking-wide text-slate-500">{pkg.code}</p>
                          </div>
                          <span className="text-sm font-semibold text-slate-700">${pkg.price} / {pkg.billing_period_days}d</span>
                        </div>
                        {pkg.description && <p className="mt-2 text-sm text-slate-600">{pkg.description}</p>}
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
                      <p className="mt-1 text-sm text-slate-500">Current state of platform-wide discount campaigns.</p>
                    </div>
                    <Link to="/super-admin/promo-codes" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Open Promos</Link>
                  </div>
                  <div className="mt-4 space-y-3">
                    {data.promos.items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No promo codes have been created yet.</div>
                    ) : (
                      data.promos.items.slice(0, 6).map((promo) => {
                        const lifecycle = getPromoLifecycle(promo);
                        return (
                          <article key={promo.id} className="rounded-lg border border-slate-200 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{promo.code}</p>
                                <p className="mt-1 text-sm text-slate-500">{promo.discount_percent}% discount</p>
                              </div>
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassName(lifecycle.tone)}`}>{lifecycle.label}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                              <p>Window: {formatDateTime(promo.valid_from)} - {formatDateTime(promo.valid_until)}</p>
                              <p>Usage: {promo.used_count}{promo.usage_limit !== null ? ` / ${promo.usage_limit}` : " / unlimited"}</p>
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
                    <p className="mt-1 text-sm text-slate-500">Tenants and governance items that may need platform attention.</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                    <span>Inactive hotels: {metrics.inactiveHotels}</span>
                    <span>Rejected registrations: {metrics.rejectedHotels}</span>
                    <span>Pending settings: {data.settings.total}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-6 xl:grid-cols-2">
                  <ListCard
                    title="Inactive Approved Hotels"
                    emptyText="No inactive approved hotels found."
                    items={inactiveHotels.map((restaurant) => ({
                      id: `inactive-${restaurant.id}`,
                      title: restaurant.name,
                      subtitle: restaurant.email ?? "-",
                      meta: `Updated ${formatDateTime(restaurant.updated_at)}`,
                    }))}
                  />
                  <ListCard
                    title="Latest Settings Requests"
                    emptyText="No pending settings requests."
                    items={data.settings.items.slice(0, 6).map((request) => ({
                      id: `setting-${request.request_id}`,
                      title: `Request #${request.request_id}`,
                      subtitle: `Hotel #${request.restaurant_id} • ${Object.keys(request.requested_changes).length} field change(s)`,
                      meta: `Submitted ${formatDateTime(request.created_at)}`,
                    }))}
                  />
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
