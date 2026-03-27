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
  (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(
    /\/api\/v1\/?$/,
    ""
  );

type ConfirmActionState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
} | null;

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    return error.detail || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
}

type FeedbackAlertProps = {
  type: "error" | "success";
  message: string;
  onClose: () => void;
};

function FeedbackAlert({ type, message, onClose }: FeedbackAlertProps) {
  const styles =
    type === "error"
      ? {
          container: "bg-red-50 border-red-200 text-red-700",
          button: "text-red-500",
        }
      : {
          container: "bg-green-50 border-green-200 text-green-700",
          button: "text-green-700",
        };

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${styles.container}`}
    >
      <span>{message}</span>
      <button onClick={onClose} className={`font-semibold ${styles.button}`}>
        x
      </button>
    </div>
  );
}

type RoomQRCodeCardProps = {
  qr: QRCodeResponse;
  working: boolean;
  onDelete: (roomNumber: string) => void;
};

function RoomQRCodeCard({ qr, working, onDelete }: RoomQRCodeCardProps) {
  const imageUrl = `${API_ORIGIN}${qr.qr_image_url}`;

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

          <button
            onClick={() => onDelete(qr.target_number)}
            disabled={working}
            className="app-btn-compact border border-red-200 text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AllRoomQRCodes() {
  const [qrcodes, setQRCodes] = useState<QRCodeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null);

  const orderedQRCodes = useMemo(() => {
    return [...qrcodes].sort((a, b) =>
      a.target_number.localeCompare(b.target_number, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [qrcodes]);

  const clearMessages = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const loadRoomQRCodes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.get<RoomQRCodeListResponse>("/qr/rooms");
      setQRCodes(data.qrcodes);
    } catch (error) {
      setError(getApiErrorMessage(error, "Failed to load room QR codes."));
    } finally {
      setLoading(false);
    }
  }, []);

  const executeDelete = useCallback(
    async ({
      endpoint,
      fallbackErrorMessage,
    }: {
      endpoint: string;
      fallbackErrorMessage: string;
    }) => {
      setWorking(true);
      clearMessages();

      try {
        const data = await api.delete<QRCodeDeleteResponse>(endpoint);
        setNotice(data.message);
        await loadRoomQRCodes();
      } catch (error) {
        throw new Error(getApiErrorMessage(error, fallbackErrorMessage));
      } finally {
        setWorking(false);
      }
    },
    [clearMessages, loadRoomQRCodes]
  );

  const openDeleteSingleConfirm = useCallback((roomNumber: string) => {
    setConfirmError(null);
    setConfirmAction({
      title: `Delete Room ${roomNumber} QR`,
      description:
        "This QR code will no longer be available for room login until regenerated.",
      confirmLabel: "Delete QR",
      onConfirm: () =>
        executeDelete({
          endpoint: `/qr/room/${encodeURIComponent(roomNumber)}`,
          fallbackErrorMessage: "Failed to delete room QR.",
        }),
    });
  }, [executeDelete]);

  const openDeleteAllConfirm = useCallback(() => {
    setConfirmError(null);
    setConfirmAction({
      title: "Delete All Room QR Codes",
      description:
        "This will remove every generated room QR code from the system.",
      confirmLabel: "Delete All",
      onConfirm: () =>
        executeDelete({
          endpoint: "/qr/rooms",
          fallbackErrorMessage: "Failed to delete room QR codes.",
        }),
    });
  }, [executeDelete]);

  const closeConfirmDialog = useCallback(() => {
    if (working) return;

    setConfirmAction(null);
    setConfirmError(null);
  }, [working]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;

    setConfirmError(null);

    try {
      await confirmAction.onConfirm();
      setConfirmAction(null);
    } catch (error) {
      setConfirmError(getApiErrorMessage(error, "Action failed."));
    }
  }, [confirmAction]);

  useEffect(() => {
    void loadRoomQRCodes();
  }, [loadRoomQRCodes]);

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
              onClick={openDeleteAllConfirm}
              disabled={loading || working || qrcodes.length === 0}
              className="app-btn-base border border-red-200 bg-white text-red-700 hover:bg-red-50"
            >
              Delete All
            </button>
          </div>
        </div>

        {error && (
          <FeedbackAlert
            type="error"
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {notice && (
          <FeedbackAlert
            type="success"
            message={notice}
            onClose={() => setNotice(null)}
          />
        )}

        <div className="rounded-xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="app-section-title text-gray-900">
              Generated Room QRs
            </h2>
            <p className="app-muted-text text-gray-500">
              {qrcodes.length} total
            </p>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400">
              Loading room QR codes...
            </div>
          ) : orderedQRCodes.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              No room QR codes found. Generate room QR codes first.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orderedQRCodes.map((qr) => (
                <RoomQRCodeCard
                  key={`${qr.qr_type}-${qr.target_number}`}
                  qr={qr}
                  working={working}
                  onDelete={openDeleteSingleConfirm}
                />
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
          onClose={closeConfirmDialog}
          onConfirm={() => void handleConfirmAction()}
          confirmLabel={working ? "Deleting..." : confirmAction.confirmLabel}
          confirmTone="danger"
        />
      )}
    </DashboardLayout>
  );
}