import type { RestaurantMeResponse } from "@/types/restaurant";

import {
  formatSubscriptionStatusLabel,
  getBooleanStatusBadgeClass,
  getSubscriptionStatusBadgeClass,
} from "@/features/super-admin/restaurants/helpers";

type RestaurantListProps = {
  loading: boolean;
  fetchError: string | null;
  list: RestaurantMeResponse[];
  selectedId: number | null;
  deletingId: number | null;
  canManageTenants: boolean;
  subscriptionStatusByHotel: Record<number, string>;
  onView: (restaurantId: number) => void;
  onEdit: (restaurantId: number) => void;
  onDelete: (restaurantId: number, restaurantName: string) => void;
};

export function RestaurantList({
  loading,
  fetchError,
  list,
  selectedId,
  deletingId,
  canManageTenants,
  subscriptionStatusByHotel,
  onView,
  onEdit,
  onDelete,
}: RestaurantListProps) {
  if (loading) {
    return <p className="text-gray-400">Loading...</p>;
  }

  if (fetchError) {
    return <p className="text-red-600">{fetchError}</p>;
  }

  if (list.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-gray-400">
        No hotels registered yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="space-y-3 p-4 md:hidden">
        {list.map((restaurant) => (
          <article key={restaurant.id} className="rounded-lg border border-gray-200 p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-900">{restaurant.name}</p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBooleanStatusBadgeClass(
                  restaurant.is_active,
                )}`}
              >
                {restaurant.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <p>Email: {restaurant.email ?? "-"}</p>
              <p>Phone: {restaurant.phone ?? "-"}</p>
              <p>
                Subscription:{" "}
                {formatSubscriptionStatusLabel(subscriptionStatusByHotel[restaurant.id])}
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => onView(restaurant.id)}
                className="w-full rounded border px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 sm:w-auto"
              >
                View
              </button>
              {canManageTenants && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(restaurant.id)}
                    className="w-full rounded border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 sm:w-auto"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(restaurant.id, restaurant.name)}
                    disabled={deletingId === restaurant.id}
                    className="w-full rounded border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 sm:w-auto"
                  >
                    {deletingId === restaurant.id ? "Deleting..." : "Delete"}
                  </button>
                </>
              )}
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
            {list.map((restaurant) => (
              <tr
                key={restaurant.id}
                className={`hover:bg-gray-50 ${selectedId === restaurant.id ? "bg-blue-50" : ""}`}
              >
                <td className="px-4 py-3 font-medium">{restaurant.name}</td>
                <td className="px-4 py-3 text-gray-500">{restaurant.email ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{restaurant.phone ?? "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBooleanStatusBadgeClass(
                      restaurant.is_active,
                    )}`}
                  >
                    {restaurant.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubscriptionStatusBadgeClass(
                      subscriptionStatusByHotel[restaurant.id],
                    )}`}
                  >
                    {formatSubscriptionStatusLabel(subscriptionStatusByHotel[restaurant.id])}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onView(restaurant.id)}
                      className="rounded border px-2.5 py-1 text-xs font-medium hover:bg-gray-50"
                    >
                      View
                    </button>
                    {canManageTenants && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(restaurant.id)}
                          className="rounded border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(restaurant.id, restaurant.name)}
                          disabled={deletingId === restaurant.id}
                          className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === restaurant.id ? "Deleting..." : "Delete"}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
