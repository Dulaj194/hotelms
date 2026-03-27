import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import type { RoomListResponse, RoomResponse } from "@/types/room";
import type { BulkQRCodeResponse, QRCodeResponse } from "@/types/publicMenu";

const API_ORIGIN =
  import.meta.env.VITE_BACKEND_URL ??
  (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(
    /\/api\/v1\/?$/,
    ""
  );

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    return error.detail || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
}

function buildQrImageUrl(path: string): string {
  return `${API_ORIGIN}${path}`;
}

function sortRoomsByNumber(rooms: RoomResponse[]): RoomResponse[] {
  return [...rooms].sort((a, b) =>
    a.room_number.localeCompare(b.room_number, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function filterRooms(rooms: RoomResponse[], keyword: string): RoomResponse[] {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const orderedRooms = sortRoomsByNumber(rooms);

  if (!normalizedKeyword) {
    return orderedRooms;
  }

  return orderedRooms.filter((room) => {
    const roomName = room.room_name?.toLowerCase() ?? "";
    const roomNumber = room.room_number.toLowerCase();

    return (
      roomNumber.includes(normalizedKeyword) ||
      roomName.includes(normalizedKeyword)
    );
  });
}

type FeedbackAlertProps = {
  message: string;
  onClose: () => void;
};

function FeedbackAlert({ message, onClose }: FeedbackAlertProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <span>{message}</span>
      <button onClick={onClose} className="font-semibold text-red-500">
        x
      </button>
    </div>
  );
}

type RoomSelectionCardProps = {
  room: RoomResponse;
  checked: boolean;
  onToggle: (roomNumber: string) => void;
};

function RoomSelectionCard({
  room,
  checked,
  onToggle,
}: RoomSelectionCardProps) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        room.is_active ? "bg-white" : "bg-gray-50 opacity-70"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={!room.is_active}
        onChange={() => onToggle(room.room_number)}
        className="mt-1"
      />

      <div className="text-sm">
        <p className="font-semibold text-gray-900">Room {room.room_number}</p>
        <p className="text-gray-500">{room.room_name ?? "No room name"}</p>
        <p className="mt-1 text-xs">
          {room.is_active ? (
            <span className="text-green-700">Active</span>
          ) : (
            <span className="text-gray-500">
              Inactive rooms cannot generate QR.
            </span>
          )}
        </p>
      </div>
    </label>
  );
}

type GeneratedQrCardProps = {
  qr: QRCodeResponse;
};

function GeneratedQrCard({ qr }: GeneratedQrCardProps) {
  const imageUrl = buildQrImageUrl(qr.qr_image_url);

  return (
    <div className="rounded-xl border bg-gray-50 p-4">
      <img
        src={imageUrl}
        alt={`QR for Room ${qr.target_number}`}
        className="mx-auto h-40 w-40 rounded border bg-white"
      />

      <div className="mt-4 space-y-2 text-sm">
        <p className="font-semibold text-gray-900">Room {qr.target_number}</p>
        <p className="break-all text-xs text-gray-500">{qr.frontend_url}</p>

        <div className="flex items-center gap-2">
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="app-btn-compact border border-gray-300 bg-white text-gray-700 hover:bg-white"
          >
            Open
          </a>

          <a
            href={imageUrl}
            download
            className="app-btn-compact bg-gray-900 text-white hover:bg-black"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

export default function GenerateRoomQRCodes() {
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkQRCodeResponse | null>(null);

  const activeRoomNumbers = useMemo(() => {
    return rooms
      .filter((room) => room.is_active)
      .map((room) => room.room_number);
  }, [rooms]);

  const visibleRooms = useMemo(() => {
    return filterRooms(rooms, search);
  }, [rooms, search]);

  const selectedCount = selectedRooms.length;
  const selectableCount = activeRoomNumbers.length;

  const clearMessages = useCallback(() => {
    setError(null);
  }, []);

  const syncDefaultSelectedRooms = useCallback((roomList: RoomResponse[]) => {
    const activeNumbers = roomList
      .filter((room) => room.is_active)
      .map((room) => room.room_number);

    setSelectedRooms(activeNumbers);
  }, []);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    clearMessages();

    try {
      const data = await api.get<RoomListResponse>("/rooms");
      setRooms(data.rooms);
      syncDefaultSelectedRooms(data.rooms);
    } catch (error) {
      setError(getErrorMessage(error, "Failed to load rooms."));
    } finally {
      setLoading(false);
    }
  }, [clearMessages, syncDefaultSelectedRooms]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const toggleRoom = useCallback((roomNumber: string) => {
    setSelectedRooms((previous) =>
      previous.includes(roomNumber)
        ? previous.filter((value) => value !== roomNumber)
        : [...previous, roomNumber]
    );
  }, []);

  const selectAllActiveRooms = useCallback(() => {
    setSelectedRooms(activeRoomNumbers);
  }, [activeRoomNumbers]);

  const clearSelectedRooms = useCallback(() => {
    setSelectedRooms([]);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (selectedRooms.length === 0) {
      setError("Select at least one active room.");
      return;
    }

    setWorking(true);
    clearMessages();

    try {
      const data = await api.post<BulkQRCodeResponse>("/qr/rooms/bulk", {
        room_numbers: selectedRooms,
      });

      setResult(data);
    } catch (error) {
      setError(getErrorMessage(error, "Failed to generate room QR codes."));
    } finally {
      setWorking(false);
    }
  }, [selectedRooms, clearMessages]);

  const handleRefreshRooms = useCallback(() => {
    void loadRooms();
  }, [loadRooms]);

  return (
    <DashboardLayout>
      <div className="app-page-stack mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="app-page-title text-gray-900">
              Generate Room QR Codes
            </h1>
            <p className="app-muted-text mt-1 text-gray-500">
              Create or reuse room QR codes in bulk for onboarding and daily
              operations.
            </p>
          </div>

          <button
            onClick={handleRefreshRooms}
            disabled={loading || working}
            className="app-btn-base border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            Refresh Rooms
          </button>
        </div>

        {error && (
          <FeedbackAlert message={error} onClose={() => setError(null)} />
        )}

        <div className="space-y-4 rounded-xl border bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="app-section-title text-gray-900">
                Room Selection
              </h2>
              <p className="app-muted-text mt-1 text-gray-500">
                Selected {selectedCount} of {selectableCount} active room(s).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={selectAllActiveRooms}
                disabled={loading || working || activeRoomNumbers.length === 0}
                className="app-btn-compact border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Select All Active
              </button>

              <button
                onClick={clearSelectedRooms}
                disabled={loading || working || selectedRooms.length === 0}
                className="app-btn-compact border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>

              <button
                onClick={() => void handleGenerate()}
                disabled={loading || working || selectedRooms.length === 0}
                className="app-btn-base bg-orange-500 text-white hover:bg-orange-600"
              >
                {working ? "Generating..." : "Generate QR Codes"}
              </button>
            </div>
          </div>

          <div className="max-w-sm">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Search Room
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Room number or name"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>

          {loading ? (
            <div className="py-10 text-center text-gray-400">
              Loading rooms...
            </div>
          ) : visibleRooms.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              No rooms found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleRooms.map((room) => (
                <RoomSelectionCard
                  key={room.id}
                  room={room}
                  checked={selectedRooms.includes(room.room_number)}
                  onToggle={toggleRoom}
                />
              ))}
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-4 rounded-xl border bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="app-section-title text-gray-900">
                  Generated QRs
                </h2>
                <p className="app-muted-text mt-1 text-gray-500">
                  {result.count} room QR code{result.count !== 1 ? "s" : ""}{" "}
                  ready.
                </p>
              </div>

              <button
                onClick={() => setResult(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.generated.map((qr) => (
                <GeneratedQrCard
                  key={`${qr.qr_type}-${qr.target_number}`}
                  qr={qr}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}