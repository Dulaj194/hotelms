import { ApiError } from "@/lib/api";
import { RESOLVED_BACKEND_ORIGIN } from "@/lib/networkBase";
import type { QRCodeResponse } from "@/types/publicMenu";

export const QR_API_ORIGIN = RESOLVED_BACKEND_ORIGIN;

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

  const handleDownload = async (format: "PNG" | "PDF") => {
    if (format === "PNG") {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${labelPrefix}_${qr.target_number}_QR.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else {
      // PDF via Print strategy
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      printWindow.document.write(`
        <html>
          <head>
            <title>${labelPrefix} ${qr.target_number} QR</title>
            <style>
              body { 
                margin: 0; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                height: 100vh; 
                font-family: sans-serif;
              }
              .container { text-align: center; border: 2px solid #f3f4f6; padding: 40px; border-radius: 40px; }
              img { width: 400px; height: 400px; }
              h1 { margin-top: 20px; color: #111827; font-size: 24px; }
              p { color: #6b7280; font-size: 14px; margin-top: 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <img src="${imageUrl}" />
              <h1>${labelPrefix} ${qr.target_number}</h1>
              <p>Scan to view our digital menu</p>
            </div>
            <script>
              window.onload = () => {
                window.print();
                // window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="group relative rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-xl hover:shadow-orange-500/5">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-100">
        <img
          src={imageUrl}
          alt={`QR for ${labelPrefix} ${qr.target_number}`}
          className="h-full w-full object-cover p-2"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <button
            onClick={() => window.open(imageUrl, "_blank")}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-black active:scale-95"
          >
            Preview Large
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-black tracking-tight text-slate-900">
              {labelPrefix} {qr.target_number}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Generated {formatQrCreatedAt(qr.created_at)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void handleDownload("PNG")}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-[11px] font-bold text-white transition hover:bg-black active:scale-95"
          >
            PNG Image
          </button>
          <button
            onClick={() => void handleDownload("PDF")}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95"
          >
            PDF Print
          </button>
        </div>

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(qr.target_number)}
            disabled={working}
            className="w-full rounded-xl border border-rose-100 bg-rose-50/50 py-2 text-[11px] font-bold text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            Remove QR Code
          </button>
        )}
      </div>
    </div>
  );
}
