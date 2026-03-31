import { ApiError } from "@/lib/api";
import type { QRCodeResponse } from "@/types/publicMenu";

export const QR_API_ORIGIN =
  import.meta.env.VITE_BACKEND_URL ??
  (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(
    /\/api\/v1\/?$/,
    "",
  );

export function buildQrImageUrl(path: string): string {
  return `${QR_API_ORIGIN}${path}`;
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    return error.detail || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
}

export function sortQRCodes(qrcodes: QRCodeResponse[]): QRCodeResponse[] {
  return [...qrcodes].sort((a, b) =>
    a.target_number.localeCompare(b.target_number, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

export function formatQrCreatedAt(createdAt: string): string {
  const value = new Date(createdAt);
  if (Number.isNaN(value.getTime())) {
    return "Unknown";
  }

  return value.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type FeedbackAlertProps = {
  type: "error" | "success";
  message: string;
  onClose: () => void;
};

export function FeedbackAlert({ type, message, onClose }: FeedbackAlertProps) {
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
      <button type="button" onClick={onClose} className={`font-semibold ${styles.button}`}>
        x
      </button>
    </div>
  );
}

type QRCodeCardProps = {
  qr: QRCodeResponse;
  labelPrefix: string;
  working?: boolean;
  onDelete?: (targetNumber: string) => void;
};

export function QRCodeCard({
  qr,
  labelPrefix,
  working = false,
  onDelete,
}: QRCodeCardProps) {
  const imageUrl = buildQrImageUrl(qr.qr_image_url);

  return (
    <div className="rounded-xl border bg-gray-50 p-4">
      <img
        src={imageUrl}
        alt={`QR for ${labelPrefix} ${qr.target_number}`}
        className="mx-auto h-40 w-40 rounded border bg-white"
      />

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900">
              {labelPrefix} {qr.target_number}
            </p>
            <p className="text-xs text-gray-500">
              Generated {formatQrCreatedAt(qr.created_at)}
            </p>
          </div>
        </div>

        <p className="break-all text-xs text-gray-500">{qr.frontend_url}</p>

        <div className="flex flex-wrap items-center gap-2">
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

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(qr.target_number)}
              disabled={working}
              className="app-btn-compact border border-red-200 text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
