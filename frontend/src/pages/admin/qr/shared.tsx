import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Download, 
  Printer, 
  Trash2, 
  Maximize2, 
  ExternalLink,
  CheckCircle2,
  Clock
} from "lucide-react";
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
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-[1.5rem] border p-4 text-sm font-bold shadow-lg animate-in slide-in-from-top-2 duration-300 ${
        type === "error"
          ? "bg-red-50 border-red-100 text-red-700"
          : "bg-emerald-50 border-emerald-100 text-emerald-700"
      }`}
    >
      <div className="flex items-center gap-3">
        {type === "error" ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        <span>{message}</span>
      </div>
      <button type="button" onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
        ✕
      </button>
    </div>
  );
}

const AlertCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

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
  const [downloading, setDownloading] = useState<"PNG" | "PDF" | null>(null);
  const imageUrl = buildQrImageUrl(qr.qr_image_url);

  const handleDownload = async (format: "PNG" | "PDF") => {
    setDownloading(format);
    try {
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
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;
        printWindow.document.write(`
          <html>
            <head>
              <title>${labelPrefix} ${qr.target_number} QR</title>
              <style>
                body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, sans-serif; }
                .card { text-align: center; border: 1px solid #e5e7eb; padding: 60px; border-radius: 60px; box-shadow: 0 20px 50px rgba(0,0,0,0.05); }
                img { width: 450px; height: 450px; border-radius: 20px; }
                h1 { margin-top: 32px; color: #111827; font-size: 32px; font-weight: 900; letter-spacing: -0.02em; }
                p { color: #6b7280; font-size: 16px; margin-top: 12px; font-weight: 500; }
              </style>
            </head>
            <body>
              <div class="card">
                <img src="${imageUrl}" />
                <h1>${labelPrefix} ${qr.target_number}</h1>
                <p>Scan to explore our menu & services</p>
              </div>
              <script>window.onload = () => { window.print(); window.close(); };</script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } finally {
      setTimeout(() => setDownloading(null), 1000);
    }
  };

  return (
    <motion.div 
      layout
      className="group relative flex flex-col rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:border-orange-100 hover:shadow-2xl hover:shadow-orange-500/10"
    >
      {/* Image Container */}
      <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] bg-slate-50 ring-1 ring-slate-100">
        <motion.img
          layoutId={`qr-${qr.target_number}`}
          src={imageUrl}
          alt={`QR for ${labelPrefix} ${qr.target_number}`}
          className="h-full w-full object-cover p-4 transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 opacity-0 backdrop-blur-[4px] transition-all duration-300 group-hover:opacity-100">
          <button
            onClick={() => window.open(imageUrl, "_blank")}
            className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-black text-slate-900 shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <Maximize2 className="h-4 w-4" />
            Large View
          </button>
          <a
            href={qr.frontend_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-2xl bg-white/20 px-5 py-2.5 text-xs font-black text-white backdrop-blur-md transition-all hover:bg-white/30 active:scale-95"
          >
            <ExternalLink className="h-4 w-4" />
            Test Link
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6 flex flex-1 flex-col">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-black tracking-tight text-slate-900">
              {labelPrefix} {qr.target_number}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <Clock className="h-3 w-3" />
              {formatQrCreatedAt(qr.created_at)}
            </div>
          </div>
          
          {onDelete && (
            <button
              onClick={() => onDelete(qr.target_number)}
              disabled={working}
              className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-500 transition-all hover:bg-rose-500 hover:text-white disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => void handleDownload("PNG")}
            disabled={downloading !== null}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-black hover:shadow-slate-300 active:scale-95 disabled:opacity-50"
          >
            {downloading === "PNG" ? (
              <CheckCircle2 className="h-4 w-4 animate-in zoom-in" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PNG
          </button>
          <button
            onClick={() => void handleDownload("PDF")}
            disabled={downloading !== null}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-[11px] font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
          >
            {downloading === "PDF" ? (
              <CheckCircle2 className="h-4 w-4 animate-in zoom-in" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            PDF
          </button>
        </div>
      </div>
    </motion.div>
  );
}
