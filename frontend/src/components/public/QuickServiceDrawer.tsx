import React from "react";
import {
  X,
  Droplets,
  Receipt,
  UserRound,
  Utensils,
  Eraser,
  MessageSquareHeart,
  Wifi,
  Sparkles,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";

type ServiceAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
};

const SERVICE_ACTIONS: ServiceAction[] = [
  {
    id: "WATER",
    label: "Request Water",
    icon: <Droplets className="h-6 w-6" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    description: "Cold or normal water for the table",
  },
  {
    id: "BILL",
    label: "Request Bill",
    icon: <Receipt className="h-6 w-6" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    description: "Ready to pay and checkout",
  },
  {
    id: "STEWARD",
    label: "Call Steward",
    icon: <UserRound className="h-6 w-6" />,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    description: "Talk to a waiter for assistance",
  },
  {
    id: "CUTLERY",
    label: "Extra Cutlery",
    icon: <Utensils className="h-6 w-6" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    description: "Spoons, forks, or napkins",
  },
  {
    id: "CLEANING",
    label: "Clean Table",
    icon: <Eraser className="h-6 w-6" />,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    description: "Clear dishes or clean spills",
  },
  {
    id: "WIFI",
    label: "Wifi Password",
    icon: <Wifi className="h-6 w-6" />,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    description: "Access guest internet",
  },
  {
    id: "FEEDBACK",
    label: "Give Feedback",
    icon: <MessageSquareHeart className="h-6 w-6" />,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    description: "Tell us about your experience",
  },
];

type QuickServiceDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onRequestService: (type: string) => Promise<void>;
  isSubmitting: boolean;
  lastRequestedType: string | null;
};

export default function QuickServiceDrawer({
  isOpen,
  onClose,
  onRequestService,
  isSubmitting,
  lastRequestedType,
}: QuickServiceDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity animate-in fade-in-0 duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative z-10 flex max-h-[85dvh] w-full flex-col rounded-t-[2.5rem] bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.2)] transition-transform animate-in slide-in-from-bottom-full duration-500 ease-out">
        {/* Handle */}
        <div className="flex w-full justify-center py-4">
          <div className="h-1.5 w-12 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-xl font-black tracking-tight text-slate-900">Table Services</h2>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">How can we help you today?</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Actions Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-12 no-scrollbar">
          <div className="grid grid-cols-1 gap-3">
            {SERVICE_ACTIONS.map((action) => {
              const isProcessing = isSubmitting && lastRequestedType === action.id;
              const isSuccess = !isSubmitting && lastRequestedType === action.id;

              return (
                <button
                  key={action.id}
                  disabled={isSubmitting}
                  onClick={() => onRequestService(action.id)}
                  className={`group relative flex w-full items-center gap-4 rounded-2xl border-2 p-4 transition-all duration-300 active:scale-[0.98] ${
                    isSuccess
                      ? "border-emerald-500 bg-emerald-50/50"
                      : "border-slate-50 bg-white hover:border-orange-100 hover:bg-orange-50/30"
                  }`}
                >
                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${action.bgColor} ${action.color}`}
                  >
                    {action.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[15px] font-bold text-slate-900">{action.label}</p>
                    <p className="text-xs font-medium text-slate-500">{action.description}</p>
                  </div>
                  <div className="shrink-0 text-slate-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-orange-400">
                    {isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-center gap-3 rounded-2xl bg-slate-50 p-4">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Staff will be alerted instantly
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
