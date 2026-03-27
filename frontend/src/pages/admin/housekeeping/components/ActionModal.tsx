import { type ReactNode } from "react";

type ConfirmTone = "primary" | "success" | "warning" | "danger";

export default function ActionModal({
  title,
  description,
  children,
  error,
  busy,
  onClose,
  onConfirm,
  confirmLabel,
  confirmTone = "primary",
}: {
  title: string;
  description: string;
  children: ReactNode;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmTone?: ConfirmTone;
}) {
  const confirmClass =
    confirmTone === "success"
      ? "bg-green-600 text-white hover:bg-green-700"
      : confirmTone === "warning"
      ? "bg-amber-500 text-white hover:bg-amber-600"
      : confirmTone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-orange-500 text-white hover:bg-orange-600";

  return (
    <div className="app-modal-shell">
      <div className="app-modal-panel max-w-2xl">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
          </div>

          {children}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="app-form-actions">
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`app-btn-base w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${confirmClass}`}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="app-btn-base w-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
