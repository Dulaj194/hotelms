import type { OfferResponse } from "@/types/offer";

type Props = {
  offer: OfferResponse | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function OfferDeleteModal({
  offer,
  deleting,
  onCancel,
  onConfirm,
}: Props) {
  if (!offer) return null;

  return (
    <div className="app-modal-shell">
      <div className="app-modal-panel max-w-md">
        <h2 className="text-lg font-semibold text-slate-900">Delete offer</h2>
        <p className="mt-2 text-sm text-slate-600">
          Delete <span className="font-semibold text-slate-800">{offer.title}</span>?
          This action cannot be undone.
        </p>

        <div className="app-form-actions mt-6 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
