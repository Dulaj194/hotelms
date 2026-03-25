import { useCallback, useEffect, useMemo, useState } from "react";

import ActionDialog from "@/components/shared/ActionDialog";
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
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

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

  async function deleteSingleRoomQr(roomNumber: string) {
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

  async function deleteAllRoomQrs() {
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

  async function handleConfirmAction() {
    if (!confirmAction) return;
    setConfirmError(null);
    try {
      await confirmAction.onConfirm();
      setConfirmAction(null);
    } catch (err) {
      if (err instanceof ApiError) setConfirmError(err.detail || "Action failed.");
      else if (err instanceof Error) setConfirmError(err.message || "Action failed.");
      else setConfirmError("Action failed.");
    }
  }

  return (
    <DashboardLayout>
      <div className="app-page-stack mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="app-page-title text-gray-900">All Room QR Codes</h1>
          <p className="app-muted-text mt-1 text-gray-500">
            View and manage generated room QR codes for operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadRoomQRCodes()}
            disabled={loading || working}
            className="app-btn-base border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
          <button
            onClick={() =>
              setConfirmAction({
                title: "Delete All Room QR Codes",
                description: "This will remove every generated room QR code from the system.",
                confirmLabel: "Delete All",
                onConfirm: async () => {
                  await deleteAllRoomQrs();
                },
              })
            }
            disabled={loading || working || qrcodes.length === 0}
            className="app-btn-base border border-red-200 bg-white text-red-700 hover:bg-red-50"
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
          <h2 className="app-section-title text-gray-900">Generated Room QRs</h2>
          <p className="app-muted-text text-gray-500">{qrcodes.length} total</p>
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
                      className="app-btn-compact border border-gray-300 bg-white text-gray-700 hover:bg-white"
                    >
                      Open
                    </a>
                    <a
                      href={`${API_ORIGIN}${qr.qr_image_url}`}
                      download
                      className="app-btn-compact bg-gray-900 text-white hover:bg-black"
                    >
                      Download
                    </a>
                    <button
                      onClick={() =>
                        setConfirmAction({
                          title: `Delete Room ${qr.target_number} QR`,
                          description: "This QR code will no longer be available for room login until regenerated.",
                          confirmLabel: "Delete QR",
                          onConfirm: async () => {
                            await deleteSingleRoomQr(qr.target_number);
                          },
                        })
                      }
                      disabled={working}
                      className="app-btn-compact border border-red-200 text-red-700 hover:bg-red-50"
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
      {confirmAction && (
        <ActionDialog
          title={confirmAction.title}
          description={confirmAction.description}
          error={confirmError}
          busy={working}
          onClose={() => {
            if (working) return;
            setConfirmAction(null);
            setConfirmError(null);
          }}
          onConfirm={() => void handleConfirmAction()}
          confirmLabel={working ? "Deleting..." : confirmAction.confirmLabel}
          confirmTone="danger"
        />
      )}
    </DashboardLayout>
  );
}
