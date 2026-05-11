import { useState } from "react";
import { Check, X, CreditCard, AlertCircle, Loader2 } from "lucide-react";
import { publicPatch } from "@/lib/publicApi";
import { getGuestToken } from "@/hooks/useGuestSession";

interface BillConfirmationOverlayProps {
  isOpen: boolean;
  onConfirm: () => void;
  onRaiseIssue: () => void;
  totalAmount: number;
  tableNumber: string;
  customerName: string;
}

export default function BillConfirmationOverlay({
  isOpen,
  onConfirm,
  onRaiseIssue,
  totalAmount,
  tableNumber,
  customerName,
}: BillConfirmationOverlayProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const token = getGuestToken();
      await publicPatch(
        "/table-sessions/my/confirm-bill",
        {},
        { headers: { "X-Guest-Session": token } }
      );
      onConfirm();
    } catch (err) {
      setError("Failed to confirm bill. Please try again or call a steward.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        {/* Header */}
        <div className="bg-slate-900 px-8 py-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/30">
            <CreditCard className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Your Bill is Ready</h2>
          <p className="mt-2 text-sm font-medium text-slate-400">
            Table {tableNumber} • {customerName}
          </p>
        </div>

        {/* Content */}
        <div className="px-8 py-8 text-center">
          <div className="mb-6 space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Amount Payable</p>
            <p className="text-5xl font-black tracking-tighter text-slate-900">
              ${totalAmount.toFixed(2)}
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-left text-xs font-bold text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-4 text-base font-bold text-white transition-all active:scale-[0.98] hover:bg-slate-800 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Check className="h-5 w-5 text-emerald-400" />
                  Confirm My Bill
                </>
              )}
            </button>

            <button
              onClick={onRaiseIssue}
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-50 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Something is wrong
            </button>
          </div>
        </div>

        <div className="bg-slate-50 px-8 py-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Please confirm to proceed with payment
          </p>
        </div>
      </div>
    </div>
  );
}
