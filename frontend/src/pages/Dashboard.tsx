import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { useSubscriptionPrivileges } from "@/hooks/useSubscriptionPrivileges";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { AdminDashboardOverviewResponse } from "@/types/dashboard";

interface Tile {
  title: string;
  description: string;
  path: string;
  color: string;
  roles?: string[];
  privilege?: string;
}

const TILES: Tile[] = [
  {
    title: "Restaurant Profile",
    description: "Update info, address, logo",
    path: "/admin/restaurant-profile",
    color: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    roles: ["owner", "admin"],
  },
  {
    title: "Staff",
    description: "Manage team members and roles",
    path: "/admin/staff",
    color: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    roles: ["owner", "admin"],
  },
  {
    title: "Tables",
    description: "Generate dine-in QR codes",
    path: "/admin/tables",
    color: "bg-rose-50 border-rose-200 hover:bg-rose-100",
    roles: ["owner", "admin"],
    privilege: "QR_MENU",
  },
  {
    title: "Offers",
    description: "Promotions for menus and items",
    path: "/admin/offers",
    color: "bg-pink-50 border-pink-200 hover:bg-pink-100",
    roles: ["owner", "admin"],
    privilege: "OFFERS",
  },
  {
    title: "Reports",
    description: "Paid sales insights and exports",
    path: "/admin/reports",
    color: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100",
    roles: ["owner", "admin", "steward"],
    privilege: "QR_MENU",
  },
  {
    title: "Kitchen",
    description: "Live order board & status updates",
    path: "/admin/kitchen",
    color: "bg-orange-50 border-orange-200 hover:bg-orange-100",
    roles: ["owner", "admin", "steward"],
    privilege: "QR_MENU",
  },
  {
    title: "Billing",
    description: "Session summaries & settlements",
    path: "/admin/billing",
    color: "bg-green-50 border-green-200 hover:bg-green-100",
    roles: ["owner", "admin", "steward"],
    privilege: "QR_MENU",
  },
  {
    title: "Rooms",
    description: "Room management & QR codes",
    path: "/admin/rooms",
    color: "bg-sky-50 border-sky-200 hover:bg-sky-100",
    roles: ["owner", "admin"],
  },
  {
    title: "Housekeeping",
    description: "Guest service requests",
    path: "/admin/housekeeping",
    color: "bg-amber-50 border-amber-200 hover:bg-amber-100",
    roles: ["owner", "admin", "housekeeper"],
  },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  steward: "Steward",
  housekeeper: "Housekeeper",
  super_admin: "Super Admin",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const role = user?.role ?? "";
  const { loading: privilegesLoading, hasPrivilege } = useSubscriptionPrivileges();
  const [overview, setOverview] = useState<AdminDashboardOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setOverviewLoading(true);
      setOverviewError(null);
      try {
        const data = await api.get<AdminDashboardOverviewResponse>("/dashboard/admin-overview");
        if (active) {
          setOverview(data);
        }
      } catch (err) {
        if (active) {
          setOverviewError(err instanceof Error ? err.message : "Failed to load dashboard data.");
        }
      } finally {
        if (active) {
          setOverviewLoading(false);
        }
      }
    }

    loadOverview();
    return () => {
      active = false;
    };
  }, []);

  const privileges = useMemo(() => overview?.subscription.privileges ?? [], [overview]);

  const visibleTiles = TILES.filter(
    (t) =>
      (!t.roles || t.roles.includes(role)) &&
      (!t.privilege ||
        ((!privilegesLoading && hasPrivilege(t.privilege)) || privileges.includes(t.privilege)))
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome header */}
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{user?.full_name ? `, ${user.full_name}` : ""} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {ROLE_LABELS[role] ?? role} · HotelMS
          </p>
        </div>

        {overviewLoading && (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 text-sm text-gray-500">
            Loading dashboard overview...
          </div>
        )}

        {overviewError && (
          <div className="bg-red-50 rounded-xl border border-red-200 px-6 py-5 text-sm text-red-700">
            {overviewError}
          </div>
        )}

        {overview && (
          <>
            {overview.setup_wizard.should_show && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
                <p className="text-sm font-semibold text-amber-900">Setup wizard required</p>
                <p className="mt-1 text-sm text-amber-800">
                  Complete missing fields: {overview.setup_wizard.missing_fields.join(", ")}.
                </p>
                <button
                  onClick={() => navigate("/admin/restaurant-profile")}
                  className="mt-3 rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Complete Setup
                </button>
              </div>
            )}

            {overview.warnings.trial_expiry_warning && overview.warnings.trial_expiry_message && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 px-5 py-4">
                <p className="text-sm font-semibold text-rose-900">Trial expiry warning</p>
                <p className="mt-1 text-sm text-rose-800">{overview.warnings.trial_expiry_message}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Pending orders</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{overview.metrics.pending_orders}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Housekeeping tasks</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {overview.metrics.pending_housekeeping_tasks}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Package</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {overview.subscription.package_name ?? "No package"}
                </p>
                <p className="mt-1 text-xs text-gray-500">Status: {overview.subscription.status}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Trial days left</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {overview.subscription.days_remaining ?? 0}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Restaurant details</h2>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
                <p><span className="font-semibold">Name:</span> {overview.restaurant.name}</p>
                <p><span className="font-semibold">Email:</span> {overview.restaurant.email ?? "-"}</p>
                <p><span className="font-semibold">Contact:</span> {overview.restaurant.contact_number ?? "-"}</p>
                <p><span className="font-semibold">Address:</span> {overview.restaurant.address ?? "-"}</p>
                <p><span className="font-semibold">Opening:</span> {overview.restaurant.opening_time ?? "-"}</p>
                <p><span className="font-semibold">Closing:</span> {overview.restaurant.closing_time ?? "-"}</p>
                <p><span className="font-semibold">Country:</span> {overview.restaurant.country ?? "-"}</p>
                <p><span className="font-semibold">Currency:</span> {overview.restaurant.currency ?? "-"}</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Privileges</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {overview.subscription.privileges.length ? (
                  overview.subscription.privileges.map((privilege) => (
                    <span
                      key={privilege}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      {privilege}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No active privileges.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Admin users</h2>
              <div className="mt-3 space-y-2">
                {overview.admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{admin.full_name}</p>
                      <p className="text-xs text-gray-500">{admin.email}</p>
                    </div>
                    <span className="text-xs font-semibold uppercase text-gray-600">{admin.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Quick-access tiles */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick Access
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTiles.map((tile) => (
              <button
                key={tile.path}
                onClick={() => navigate(tile.path)}
                className={`text-left border rounded-xl px-5 py-4 transition-colors cursor-pointer ${tile.color}`}
              >
                <p className="font-semibold text-gray-800">{tile.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tile.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
