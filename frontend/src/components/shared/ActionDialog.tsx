import type { ReactNode } from "react";

type ActionDialogTone = "primary" | "success" | "warning" | "danger";

interface ActionDialogProps {
  title: string;
  description?: string;
  children?: ReactNode;
  error?: string | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  cancelLabel?: string;
  confirmTone?: ActionDialogTone;
  maxWidthClassName?: string;
}

function getConfirmButtonClass(confirmTone: ActionDialogTone): string {
  if (confirmTone === "success") return "bg-green-600 text-white hover:bg-green-700";
  if (confirmTone === "warning") return "bg-amber-500 text-white hover:bg-amber-600";
  if (confirmTone === "danger") return "bg-red-600 text-white hover:bg-red-700";
  return "bg-orange-500 text-white hover:bg-orange-600";
}

export default function ActionDialog({
  title,
  description,
  children,
  error = null,
  busy = false,
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmTone = "primary",
  maxWidthClassName = "max-w-md",
}: ActionDialogProps) {
  return (
    <div className="app-modal-shell">
      <div className={`app-modal-panel ${maxWidthClassName}`}>
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            {description && <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>}
          </div>

          {children}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="app-form-actions">
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`app-btn-base w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${getConfirmButtonClass(
                confirmTone,
              )}`}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="app-btn-base w-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
