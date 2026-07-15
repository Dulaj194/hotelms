import { useState, useRef, useEffect } from "react";
import type { RestaurantMeResponse } from "@/types/restaurant";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  updatingStatusId: number | null;
  canManageTenants: boolean;
  subscriptionStatusByHotel: Record<number, string>;
  onView: (restaurantId: number) => void;
  onEdit: (restaurantId: number) => void;
  onUpdateStatus: (restaurantId: number, restaurantName: string, isActive: boolean) => void;
};

export function RestaurantList({
  loading,
  fetchError,
  list,
  selectedId,
  updatingStatusId,
  canManageTenants,
  subscriptionStatusByHotel,
  onView,
  onEdit,
  onUpdateStatus,
}: RestaurantListProps) {
  const [showDeactivated, setShowDeactivated] = useState(false);
  const accordionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accordionRef.current && !accordionRef.current.contains(event.target as Node)) {
        setShowDeactivated(false);
      }
    };
    if (showDeactivated) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDeactivated]);

  if (loading) {
    return <p className="text-slate-400">Loading...</p>;
  }

  if (fetchError) {
    return <p className="text-red-600">{fetchError}</p>;
  }

  const activeHotels = list.filter((r) => r.is_active);
  const deactivatedHotels = list.filter((r) => !r.is_active);

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        No hotels registered yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Mobile View - Active */}
        <div className="space-y-3 p-4 md:hidden">
          {activeHotels.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-4">No active hotels.</p>
          ) : (
            activeHotels.map((restaurant) => (
              <article key={restaurant.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{restaurant.name}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBooleanStatusBadgeClass(
                      restaurant.is_active,
                    )}`}
                  >
                    Active
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
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
                    className="w-full rounded border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 sm:w-auto"
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
                        onClick={() => onUpdateStatus(restaurant.id, restaurant.name, false)}
                        disabled={updatingStatusId === restaurant.id}
                        className="w-full rounded border border-orange-200 px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50 sm:w-auto"
                      >
                        {updatingStatusId === restaurant.id ? "Updating..." : "Deactivate"}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))
          )}
        </div>

        {/* Desktop View - Active */}
        <div className="app-table-scroll hidden md:block">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Hotel Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Subscription Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeHotels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No active hotels.
                  </td>
                </tr>
              ) : (
                activeHotels.map((restaurant) => (
                  <tr
                    key={restaurant.id}
                    className={`hover:bg-slate-50 ${selectedId === restaurant.id ? "bg-blue-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{restaurant.name}</td>
                    <td className="px-4 py-3 text-slate-500">{restaurant.email ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{restaurant.phone ?? "-"}</td>
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
                          className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
                              onClick={() => onUpdateStatus(restaurant.id, restaurant.name, false)}
                              disabled={updatingStatusId === restaurant.id}
                              className="rounded border border-orange-200 px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                            >
                              {updatingStatusId === restaurant.id ? "Updating..." : "Deactivate"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deactivated Hotels Accordion */}
      {deactivatedHotels.length > 0 && (
        <div ref={accordionRef} className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden mt-6">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-4 text-left focus:outline-none hover:bg-slate-100 transition-colors"
            onClick={() => setShowDeactivated((prev) => !prev)}
          >
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Deactivated Hotels</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {deactivatedHotels.length} {deactivatedHotels.length === 1 ? "hotel is" : "hotels are"} currently inactive.
              </p>
            </div>
            {showDeactivated ? (
              <ChevronUp className="h-5 w-5 text-slate-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-500" />
            )}
          </button>
          
          {showDeactivated && (
            <div className="border-t border-slate-200 bg-white">
              {/* Mobile View - Deactivated */}
              <div className="space-y-3 p-4 md:hidden">
                {deactivatedHotels.map((restaurant) => (
                  <article key={restaurant.id} className="rounded-lg border border-slate-200 p-4 text-sm bg-slate-50/50 opacity-80">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-700 line-through">{restaurant.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-200 text-slate-600">
                        Inactive
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onView(restaurant.id)}
                        className="w-full rounded border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
                      >
                        View Profile
                      </button>
                      {canManageTenants && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(restaurant.id, restaurant.name, true)}
                          disabled={updatingStatusId === restaurant.id}
                          className="w-full rounded border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          {updatingStatusId === restaurant.id ? "Activating..." : "Activate"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {/* Desktop View - Deactivated */}
              <div className="app-table-scroll hidden md:block">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs">
                    <tr>
                      <th className="px-5 py-3 text-left">Hotel Name</th>
                      <th className="px-5 py-3 text-left">Email</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deactivatedHotels.map((restaurant) => (
                      <tr key={restaurant.id} className="hover:bg-slate-50 opacity-80">
                        <td className="px-5 py-3 font-medium text-slate-600 line-through">{restaurant.name}</td>
                        <td className="px-5 py-3 text-slate-500">{restaurant.email ?? "-"}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onView(restaurant.id)}
                              className="rounded border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                            >
                              View
                            </button>
                            {canManageTenants && (
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(restaurant.id, restaurant.name, true)}
                                disabled={updatingStatusId === restaurant.id}
                                className="rounded border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50 shadow-sm"
                              >
                                {updatingStatusId === restaurant.id ? "Activating..." : "Activate"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
