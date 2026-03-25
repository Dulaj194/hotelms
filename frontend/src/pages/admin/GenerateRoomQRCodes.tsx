import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import type { RoomListResponse, RoomResponse } from "@/types/room";
import type { BulkQRCodeResponse } from "@/types/publicMenu";

const API_ORIGIN =
  import.meta.env.VITE_BACKEND_URL ??
  (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(/\/api\/v1\/?$/, "");

export default function GenerateRoomQRCodes() {
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkQRCodeResponse | null>(null);

  const activeRoomNumbers = useMemo(
    () => rooms.filter((room) => room.is_active).map((room) => room.room_number),
    [rooms]
  );

  const visibleRooms = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const ordered = [...rooms].sort((a, b) =>
      a.room_number.localeCompare(b.room_number, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
    if (!keyword) return ordered;
    return ordered.filter((room) => {
      const name = room.room_name?.toLowerCase() ?? "";
      return room.room_number.toLowerCase().includes(keyword) || name.includes(keyword);
    });
  }, [rooms, search]);

  const selectedCount = selectedRooms.length;
  const selectableCount = activeRoomNumbers.length;

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<RoomListResponse>("/rooms");
      setRooms(data.rooms);
      const active = data.rooms.filter((room) => room.is_active).map((room) => room.room_number);
      setSelectedRooms(active);
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail || "Failed to load rooms.");
      else setError("Failed to load rooms.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  function toggleRoom(roomNumber: string) {
    setSelectedRooms((prev) =>
      prev.includes(roomNumber) ? prev.filter((value) => value !== roomNumber) : [...prev, roomNumber]
    );
  }

  async function handleGenerate() {
    if (selectedRooms.length === 0) {
      setError("Select at least one active room.");
      return;
    }

    setWorking(true);
    setError(null);
    try {
      const data = await api.post<BulkQRCodeResponse>("/qr/rooms/bulk", {
        room_numbers: selectedRooms,
      });
      setResult(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail || "Failed to generate room QR codes.");
      else setError("Failed to generate room QR codes.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generate Room QR Codes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create or reuse room QR codes in bulk for onboarding and daily operations.
          </p>
        </div>
        <button
          onClick={() => void loadRooms()}
          disabled={loading || working}
          className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Refresh Rooms
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-semibold text-red-500">
            x
          </button>
        </div>
      )}

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Room Selection</h2>
            <p className="text-sm text-gray-500 mt-1">
              Selected {selectedCount} of {selectableCount} active room(s).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedRooms(activeRoomNumbers)}
              disabled={loading || working || activeRoomNumbers.length === 0}
              className="px-3 py-2 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Select All Active
            </button>
            <button
              onClick={() => setSelectedRooms([])}
              disabled={loading || working || selectedRooms.length === 0}
              className="px-3 py-2 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              onClick={() => void handleGenerate()}
              disabled={loading || working || selectedRooms.length === 0}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {working ? "Generating..." : "Generate QR Codes"}
            </button>
          </div>
        </div>

        <div className="max-w-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search Room</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Room number or name"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-400">Loading rooms...</div>
        ) : visibleRooms.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            No rooms found.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleRooms.map((room) => {
              const checked = selectedRooms.includes(room.room_number);
              return (
                <label
                  key={room.id}
                  className={`border rounded-lg p-3 flex items-start gap-3 ${
                    room.is_active ? "bg-white" : "bg-gray-50 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!room.is_active}
                    onChange={() => toggleRoom(room.room_number)}
                    className="mt-1"
                  />
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">Room {room.room_number}</p>
                    <p className="text-gray-500">{room.room_name ?? "No room name"}</p>
                    <p className="text-xs mt-1">
                      {room.is_active ? (
                        <span className="text-green-700">Active</span>
                      ) : (
                        <span className="text-gray-500">Inactive rooms cannot generate QR.</span>
                      )}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {result && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Generated QRs</h2>
              <p className="text-sm text-gray-500 mt-1">
                {result.count} room QR code{result.count !== 1 ? "s" : ""} ready.
              </p>
            </div>
            <button
              onClick={() => setResult(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.generated.map((qr) => (
              <div key={`${qr.qr_type}-${qr.target_number}`} className="border rounded-xl p-4 bg-gray-50">
                <img
                  src={`${API_ORIGIN}${qr.qr_image_url}`}
                  alt={`QR for Room ${qr.target_number}`}
                  className="w-40 h-40 mx-auto border rounded bg-white"
                />
                <div className="mt-4 space-y-2 text-sm">
                  <p className="font-semibold text-gray-900">Room {qr.target_number}</p>
                  <p className="text-xs text-gray-500 break-all">{qr.frontend_url}</p>
                  <div className="flex items-center gap-2">
                    <a
                      href={`${API_ORIGIN}${qr.qr_image_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 text-xs border rounded hover:bg-white transition-colors"
                    >
                      Open
                    </a>
                    <a
                      href={`${API_ORIGIN}${qr.qr_image_url}`}
                      download
                      className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-black transition-colors"
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
