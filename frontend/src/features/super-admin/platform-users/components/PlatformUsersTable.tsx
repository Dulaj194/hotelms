import {
  PLATFORM_SCOPE_CATALOG,
} from "@/features/platform-access/catalog";
import { formatDateTime } from "@/pages/super-admin/utils";
import type { PlatformUserListItemResponse } from "@/types/user";

export function PlatformUsersTable({
  items,
  statusBusyId,
  deleteBusyId,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  items: PlatformUserListItemResponse[];
  statusBusyId: number | null;
  deleteBusyId: number | null;
  onEdit: (user: PlatformUserListItemResponse) => void;
  onToggleStatus: (userId: number, isActive: boolean) => void;
  onDelete: (userId: number) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="app-section-title text-slate-900">Accounts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Protect platform access by keeping only the required super admin accounts active.
          </p>
        </div>
        <span className="text-sm font-semibold text-slate-500">{items.length} users</span>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          No platform users found.
        </div>
      ) : (
        <div className="app-table-scroll mt-5">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3">Username</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Scopes</th>
                <th className="px-3 py-3">Password Policy</th>
                <th className="px-3 py-3">Last Login</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-900">{user.full_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{user.username ?? "-"}</td>
                  <td className="px-3 py-3 text-slate-600">{user.phone ?? "-"}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {user.super_admin_scopes.map((scope) => {
                        const definition = PLATFORM_SCOPE_CATALOG.find((item) => item.key === scope);
                        return (
                          <span
                            key={scope}
                            className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                          >
                            {definition?.label ?? scope}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {user.must_change_password ? "Reset required" : "Stable"}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{formatDateTime(user.last_login_at)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(user)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStatus(user.id, user.is_active)}
                        disabled={statusBusyId === user.id}
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                          user.is_active
                            ? "border-orange-200 text-orange-700 hover:bg-orange-50"
                            : "border-green-200 text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {statusBusyId === user.id ? "Working..." : user.is_active ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(user.id)}
                        disabled={deleteBusyId === user.id}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deleteBusyId === user.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
