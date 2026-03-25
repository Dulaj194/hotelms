import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import type {
  QRCodeDeleteResponse,
  QRCodeResponse,
  RoomQRCodeListResponse,
} from "@/types/publicMenu";

const API_ORIGIN =
  import.meta.env.VITE_BACKEND_URL ??
  (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(/\/api\/v1\/?$/, "");

export default function AllRoomQRCodes() {
  const [qrcodes, setQRCodes] = useState<QRCodeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const orderedQRCodes = useMemo(
    () =>
      [...qrcodes].sort((a, b) =>
        a.target_number.localeCompare(b.target_number, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    [qrcodes]
  );

  const loadRoomQRCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<RoomQRCodeListResponse>("/qr/rooms");
      setQRCodes(data.qrcodes);
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail || "Failed to load room QR codes.");
      else setError("Failed to load room QR codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoomQRCodes();
  }, [loadRoomQRCodes]);

  async function handleDeleteSingle(roomNumber: string) {
    const confirmed = window.confirm(`Delete QR for room ${roomNumber}?`);
    if (!confirmed) return;

    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const data = await api.delete<QRCodeDeleteResponse>(`/qr/room/${encodeURIComponent(roomNumber)}`);
      setNotice(data.message);
      await loadRoomQRCodes();
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail || "Failed to delete room QR.");
      else setError("Failed to delete room QR.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteAll() {
    const confirmed = window.confirm("Delete all room QR codes?");
    if (!confirmed) return;

    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const data = await api.delete<QRCodeDeleteResponse>("/qr/rooms");
      setNotice(data.message);
      await loadRoomQRCodes();
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail || "Failed to delete room QR codes.");
      else setError("Failed to delete room QR codes.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Room QR Codes</h1>
          <p className="text-sm text-gray-500 mt-1">
            View and manage generated room QR codes for operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadRoomQRCodes()}
            disabled={loading || working}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={() => void handleDeleteAll()}
            disabled={loading || working || qrcodes.length === 0}
            className="px-3 py-2 text-sm font-semibold text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            Delete All
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-semibold text-red-500">
            x
          </button>
        </div>
      )}

      {notice && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-semibold text-green-700">
            x
          </button>
        </div>
      )}

      <div className="bg-white border rounded-xl p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Generated Room QRs</h2>
          <p className="text-sm text-gray-500">{qrcodes.length} total</p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading room QR codes...</div>
        ) : orderedQRCodes.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No room QR codes found. Generate room QR codes first.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orderedQRCodes.map((qr) => (
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
                    <button
                      onClick={() => void handleDeleteSingle(qr.target_number)}
                      disabled={working}
                      className="px-3 py-1.5 text-xs text-red-700 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </DashboardLayout>
  );
}
