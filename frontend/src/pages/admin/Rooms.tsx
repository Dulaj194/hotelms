/**
 * Admin Rooms page — manage hotel rooms for the current restaurant.
 *
 * Features:
 * - List all rooms with status indicator
 * - Create room (number, optional name, optional floor)
 * - Edit room details
 * - Enable / disable room
 * - Delete room with confirmation
 * - Generate QR code for a room
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { RoomCreateRequest, RoomResponse, RoomUpdateRequest } from "@/types/room";
import type { QRCodeResponse } from "@/types/publicMenu";

// ── Local types ──────────────────────────────────────────────────────────────

interface RoomListResponse {
  rooms: RoomResponse[];
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        active
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-500"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Rooms() {
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomResponse | null>(null);
  const [formData, setFormData] = useState<RoomCreateRequest>({
    room_number: "",
    room_name: null,
    floor_number: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<RoomResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  // QR preview
  const [qrResult, setQrResult] = useState<QRCodeResponse | null>(null);
  const [qrLoading, setQrLoading] = useState<string | null>(null); // room_number being fetched

  // ── Data loading ────────────────────────────────────────────────────────────

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

  // ── Create / edit modal ─────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingRoom(null);
    setFormData({ room_number: "", room_name: null, floor_number: null });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (room: RoomResponse) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number,
      room_name: room.room_name,
      floor_number: room.floor_number,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
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
  };

  // ── Enable / disable ────────────────────────────────────────────────────────

  const handleToggleActive = async (room: RoomResponse) => {
    try {
      const action = room.is_active ? "disable" : "enable";
      await api.patch(`/rooms/${room.id}/${action}`, {});
      await loadRooms();
    } catch {
      setError("Failed to update room status.");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleConfirmDelete = async () => {
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
  };

  // ── QR generation ───────────────────────────────────────────────────────────

  const handleGenerateQR = async (room: RoomResponse) => {
    setQrLoading(room.room_number);
    setQrResult(null);
    try {
      const result = await api.get<QRCodeResponse>(
        `/qr/room/${encodeURIComponent(room.room_number)}`
      );
      setQrResult(result);
    } catch {
      setError("Failed to generate QR code.");
    } finally {
      setQrLoading(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage hotel rooms and generate QR codes for guests.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold
                     hover:bg-orange-600 transition-colors"
        >
          + Add Room
        </button>
      </div>

      {/* Global error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* QR result panel */}
      {qrResult && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-4">
          <img
            src={`http://localhost:8000${qrResult.qr_image_url}`}
            alt={`QR for Room ${qrResult.target_number}`}
            className="w-24 h-24 border rounded"
          />
          <div className="text-sm">
            <p className="font-semibold text-blue-800">
              Room {qrResult.target_number} QR Code
            </p>
            <p className="text-blue-600 mt-1 break-all">{qrResult.frontend_url}</p>
            <button
              onClick={() => setQrResult(null)}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Room list */}
      {loading ? (
        <p className="text-center text-gray-400 py-12 animate-pulse">Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No rooms yet.</p>
          <p className="text-sm mt-1">Click "Add Room" to create your first room.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
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
                  <td className="px-4 py-3 text-gray-600">{room.room_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {room.floor_number !== null ? `Floor ${room.floor_number}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge active={room.is_active} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* QR */}
                      <button
                        onClick={() => handleGenerateQR(room)}
                        disabled={qrLoading === room.room_number}
                        className="px-2 py-1 text-xs border rounded hover:bg-gray-100 transition-colors
                                   disabled:opacity-50"
                        title="Generate QR"
                      >
                        {qrLoading === room.room_number ? "…" : "QR"}
                      </button>
                      {/* Edit */}
                      <button
                        onClick={() => openEdit(room)}
                        className="px-2 py-1 text-xs border rounded hover:bg-gray-100 transition-colors"
                        title="Edit room"
                      >
                        Edit
                      </button>
                      {/* Enable/Disable */}
                      <button
                        onClick={() => handleToggleActive(room)}
                        className={`px-2 py-1 text-xs border rounded transition-colors ${
                          room.is_active
                            ? "hover:bg-orange-50 border-orange-200 text-orange-600"
                            : "hover:bg-green-50 border-green-200 text-green-600"
                        }`}
                        title={room.is_active ? "Disable room" : "Enable room"}
                      >
                        {room.is_active ? "Disable" : "Enable"}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(room)}
                        className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded
                                   hover:bg-red-50 transition-colors"
                        title="Delete room"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingRoom ? `Edit Room ${editingRoom.room_number}` : "Add Room"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.room_number}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, room_number: e.target.value }))
                  }
                  placeholder="e.g. 101, 2A"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                             focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Name (optional)
                </label>
                <input
                  type="text"
                  value={formData.room_name ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      room_name: e.target.value || null,
                    }))
                  }
                  placeholder="e.g. Deluxe Suite"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                             focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Floor Number (optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.floor_number ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      floor_number: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  placeholder="e.g. 1"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                             focus:ring-orange-300"
                />
              </div>
            </div>

            {formError && (
              <p className="mt-3 text-sm text-red-600">{formError}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold
                           hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : editingRoom ? "Save Changes" : "Create Room"}
              </button>
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-2">Delete Room?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete Room{" "}
              <span className="font-semibold">{deleteTarget.room_number}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold
                           hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
