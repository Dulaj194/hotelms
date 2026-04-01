import type { StaffDetailResponse, UserRole } from "@/types/user";
import { ROLE_LABELS } from "@/types/user";

import { FormField } from "@/features/super-admin/restaurants/components/FormField";
import { getBooleanStatusBadgeClass } from "@/features/super-admin/restaurants/helpers";
import type { AddHotelUserFormState, InlineMessage } from "@/features/super-admin/restaurants/types";

type StaffPanelProps = {
  hotelUsers: StaffDetailResponse[];
  usersLoading: boolean;
  showAddUser: boolean;
  addUserForm: AddHotelUserFormState;
  addingUser: boolean;
  addUserMsg: InlineMessage;
  availableRoles: UserRole[];
  deletingUserId: number | null;
  togglingUserId: number | null;
  onToggleAddUser: () => void;
  onFormChange: (next: AddHotelUserFormState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onToggleUser: (userId: number, isActive: boolean) => void;
  onDeleteUser: (userId: number, userName: string) => void;
};

export function StaffPanel({
  hotelUsers,
  usersLoading,
  showAddUser,
  addUserForm,
  addingUser,
  addUserMsg,
  availableRoles,
  deletingUserId,
  togglingUserId,
  onToggleAddUser,
  onFormChange,
  onSubmit,
  onToggleUser,
  onDeleteUser,
}: StaffPanelProps) {
  return (
    <div className="rounded-lg border bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">Staff</h2>
        <button
          type="button"
          onClick={onToggleAddUser}
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
        >
          {showAddUser ? "Cancel" : "+ Add Staff"}
        </button>
      </div>

      {addUserMsg && (
        <p className={`text-xs ${addUserMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
          {addUserMsg.text}
        </p>
      )}

      {showAddUser && (
        <form onSubmit={onSubmit} className="rounded-md bg-gray-50 border p-4 space-y-3">
          <h3 className="text-xs font-medium text-gray-500 uppercase">New Staff Member</h3>
          <FormField
            label="Full Name *"
            value={addUserForm.full_name}
            onChange={(value) => onFormChange({ ...addUserForm, full_name: value })}
          />
          <FormField
            label="Email *"
            type="email"
            value={addUserForm.email}
            onChange={(value) => onFormChange({ ...addUserForm, email: value })}
          />
          <FormField
            label="Password *"
            type="password"
            value={addUserForm.password}
            onChange={(value) => onFormChange({ ...addUserForm, password: value })}
          />
          <div className="space-y-1">
            <label className="text-sm font-medium">Role *</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={addUserForm.role}
              onChange={(event) =>
                onFormChange({ ...addUserForm, role: event.target.value as AddHotelUserFormState["role"] })
              }
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          {availableRoles.length < 6 && (
            <p className="text-xs text-gray-500">
              Feature-disabled hotel workflows are hidden from the staff-role picker.
            </p>
          )}
          <button
            type="submit"
            disabled={
              addingUser ||
              !addUserForm.full_name ||
              !addUserForm.email ||
              addUserForm.password.length < 8
            }
            className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {addingUser ? "Adding..." : "Add Staff Member"}
          </button>
        </form>
      )}

      {usersLoading ? (
        <p className="text-sm text-gray-400">Loading staff...</p>
      ) : hotelUsers.length === 0 ? (
        <p className="text-sm text-gray-400">No staff members found.</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {hotelUsers.map((user) => (
              <article key={user.id} className="rounded-lg border border-gray-200 p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900">{user.full_name}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBooleanStatusBadgeClass(
                      user.is_active,
                    )}`}
                  >
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p>Email: {user.email}</p>
                  <p>Role: {ROLE_LABELS[user.role]}</p>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => onToggleUser(user.id, user.is_active)}
                    disabled={togglingUserId === user.id}
                    className={`w-full rounded border px-2 py-1 text-xs font-medium disabled:opacity-50 sm:w-auto ${
                      user.is_active
                        ? "border-orange-200 text-orange-700 hover:bg-orange-50"
                        : "border-green-200 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {togglingUserId === user.id ? "..." : user.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteUser(user.id, user.full_name)}
                    disabled={deletingUserId === user.id}
                    className="w-full rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 sm:w-auto"
                  >
                    {deletingUserId === user.id ? "..." : "Remove"}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="app-table-scroll hidden md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Staff Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {hotelUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{user.full_name}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{user.email}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium capitalize">
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBooleanStatusBadgeClass(
                          user.is_active,
                        )}`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleUser(user.id, user.is_active)}
                          disabled={togglingUserId === user.id}
                          className={`rounded border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                            user.is_active
                              ? "border-orange-200 text-orange-700 hover:bg-orange-50"
                              : "border-green-200 text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {togglingUserId === user.id ? "..." : user.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteUser(user.id, user.full_name)}
                          disabled={deletingUserId === user.id}
                          className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingUserId === user.id ? "..." : "Remove"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
