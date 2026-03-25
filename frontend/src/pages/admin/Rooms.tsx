import { useCallback, useEffect, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";
import { getUser, normalizeRole } from "@/lib/auth";
import type {
  RoomCreateRequest,
  RoomListResponse,
  RoomResponse,
  RoomUpdateRequest,
} from "@/types/room";

function Badge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function Rooms() {
  const user = getUser();
  const role = normalizeRole(user?.role);
  const canManageRooms = role === "owner" || role === "admin";

  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomResponse | null>(null);
  const [formData, setFormData] = useState<RoomCreateRequest>({
    room_number: "",
    room_name: null,
    floor_number: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<RoomResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<RoomListResponse>("/rooms");
      setRooms(data.rooms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rooms.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  function openCreate() {
    setEditingRoom(null);
    setFormData({ room_number: "", room_name: null, floor_number: null });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(room: RoomResponse) {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number,
      room_name: room.room_name,
      floor_number: room.floor_number,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.room_number.trim()) {
      setFormError("Room number is required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editingRoom) {
        const payload: RoomUpdateRequest = {
          room_number: formData.room_number || undefined,
          room_name: formData.room_name || undefined,
          floor_number: formData.floor_number ?? undefined,
        };
        await api.patch<RoomResponse>(`/rooms/${editingRoom.id}`, payload);
      } else {
        const payload: RoomCreateRequest = {
          room_number: formData.room_number,
          room_name: formData.room_name || null,
          floor_number: formData.floor_number ?? null,
        };
        await api.post<RoomResponse>("/rooms", payload);
      }
      setModalOpen(false);
      await loadRooms();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save room.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(room: RoomResponse) {
    try {
      const action = room.is_active ? "disable" : "enable";
      await api.patch(`/rooms/${room.id}/${action}`, {});
      await loadRooms();
    } catch {
      setError("Failed to update room status.");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/rooms/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadRooms();
    } catch {
      setError("Failed to delete room.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="app-page-stack mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="app-page-title text-gray-900">Rooms</h1>
          <p className="app-muted-text mt-1 text-gray-500">
            {canManageRooms
              ? "Manage hotel rooms for your restaurant."
              : "View room inventory for housekeeping operations."}
          </p>
        </div>
        {canManageRooms && (
          <button
            onClick={openCreate}
            className="app-btn-base w-full bg-orange-500 text-white hover:bg-orange-600 sm:w-auto"
          >
            + Add Room
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700 font-bold"
          >
            x
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-12 animate-pulse">Loading rooms...</p>
      ) : rooms.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">{canManageRooms ? "No rooms yet." : "No rooms available."}</p>
          {canManageRooms && (
            <p className="text-sm mt-1">Click "Add Room" to create your first room.</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="space-y-3 p-4 md:hidden">
            {rooms.map((room) => (
              <article key={room.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Room {room.room_number}</p>
                    <p className="text-xs text-gray-500">{room.room_name ?? "No room name"}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {room.floor_number !== null ? `Floor ${room.floor_number}` : "Floor -"}
                    </p>
                  </div>
                  <Badge active={room.is_active} />
                </div>
                {canManageRooms ? (
                  <div className="app-form-actions mt-4">
                    <button
                      onClick={() => openEdit(room)}
                      className="app-btn-compact w-full border border-gray-200 text-gray-700 hover:bg-gray-100 sm:w-auto"
                      title="Edit room"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleToggleActive(room)}
                      className={`app-btn-compact w-full border sm:w-auto ${
                        room.is_active
                          ? "border-orange-200 text-orange-600 hover:bg-orange-50"
                          : "border-green-200 text-green-600 hover:bg-green-50"
                      }`}
                      title={room.is_active ? "Disable room" : "Enable room"}
                    >
                      {room.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(room)}
                      className="app-btn-compact w-full border border-red-200 text-red-600 hover:bg-red-50 sm:w-auto"
                      title="Delete room"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-gray-500">View only</div>
                )}
              </article>
            ))}
          </div>

          <div className="app-table-scroll hidden md:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Room #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Floor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold">{room.room_number}</td>
                    <td className="px-4 py-3 text-gray-600">{room.room_name ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {room.floor_number !== null ? `Floor ${room.floor_number}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge active={room.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      {canManageRooms ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(room)}
                            className="app-btn-compact w-full border border-gray-200 text-gray-700 hover:bg-gray-100 sm:w-auto"
                            title="Edit room"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void handleToggleActive(room)}
                            className={`app-btn-compact w-full border sm:w-auto ${
                              room.is_active
                                ? "border-orange-200 text-orange-600 hover:bg-orange-50"
                                : "border-green-200 text-green-600 hover:bg-green-50"
                            }`}
                            title={room.is_active ? "Disable room" : "Enable room"}
                          >
                            {room.is_active ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(room)}
                            className="app-btn-compact w-full border border-red-200 text-red-600 hover:bg-red-50 sm:w-auto"
                            title="Delete room"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <div className="text-right text-xs text-gray-500">View only</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManageRooms && modalOpen && (
        <div className="app-modal-shell">
          <div className="app-modal-panel max-w-lg">
            <h2 className="app-section-title mb-4 text-gray-900">
              {editingRoom ? `Edit Room ${editingRoom.room_number}` : "Add Room"}
            </h2>

            <div className="app-form-grid">
              <div className="md:col-span-2">
                <label className="app-muted-text mb-1 block font-medium text-gray-700">
                  Room Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.room_number}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, room_number: e.target.value }))
                  }
                  placeholder="e.g. 101, 2A"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div className="md:col-span-1">
                <label className="app-muted-text mb-1 block font-medium text-gray-700">
                  Room Name (optional)
                </label>
                <input
                  type="text"
                  value={formData.room_name ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      room_name: e.target.value || null,
                    }))
                  }
                  placeholder="e.g. Deluxe Suite"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div className="md:col-span-1">
                <label className="app-muted-text mb-1 block font-medium text-gray-700">
                  Floor Number (optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.floor_number ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      floor_number: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  placeholder="e.g. 1"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <div className="app-form-actions mt-6">
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="app-btn-base w-full bg-orange-500 text-white hover:bg-orange-600 sm:w-auto"
              >
                {saving ? "Saving..." : editingRoom ? "Save Changes" : "Create Room"}
              </button>
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="app-btn-base w-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {canManageRooms && deleteTarget && (
        <div className="app-modal-shell">
          <div className="app-modal-panel max-w-md">
            <h2 className="app-section-title mb-2 text-gray-900">Delete Room?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete Room <span className="font-semibold">{deleteTarget.room_number}</span>?
              This action cannot be undone.
            </p>
            <div className="app-form-actions">
              <button
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
                className="app-btn-base w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="app-btn-base w-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
