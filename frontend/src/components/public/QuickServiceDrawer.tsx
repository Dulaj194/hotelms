import { Check, X, Droplets, User, FileText, Wifi, Star, Sparkles, MessageSquare, Coffee } from "lucide-react";
import { useState } from "react";

interface QuickServiceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestService: (type: string) => Promise<void>;
  isSubmitting: boolean;
  lastRequestedType: string | null;
}

const SERVICES = [
  { id: "WATER", name: "Water", icon: Droplets, color: "bg-blue-50 text-blue-600 border-blue-100" },
  { id: "BILL", name: "Bill", icon: FileText, color: "bg-rose-50 text-rose-600 border-rose-100" },
  { id: "STEWARD", name: "Steward", icon: User, color: "bg-amber-50 text-amber-600 border-amber-100" },
  { id: "CUTLERY", name: "Cutlery", icon: UtensilsIcon, color: "bg-slate-50 text-slate-600 border-slate-100" },
  { id: "CLEANING", name: "Cleaning", icon: Sparkles, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  { id: "WIFI", name: "Wifi", icon: Wifi, color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
  { id: "FEEDBACK", name: "Feedback", icon: Star, color: "bg-purple-50 text-purple-600 border-purple-100" },
];

function UtensilsIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}

export default function QuickServiceDrawer({
  isOpen,
  onClose,
  onRequestService,
  isSubmitting,
  lastRequestedType,
}: QuickServiceDrawerProps) {
  return (
    <div className={`fixed inset-0 z-[100] overflow-hidden transition-all duration-300 ${isOpen ? "visible" : "invisible"}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 w-full rounded-t-[2.5rem] bg-white px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 shadow-2xl transition-transform duration-500 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-slate-200" />

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Table Service</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">How can we help you today?</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 min-[400px]:grid-cols-4">
          {SERVICES.map((service) => {
            const isSelected = lastRequestedType === service.id;
            const Icon = service.icon;

            return (
              <button
                key={service.id}
                disabled={isSubmitting && !isSelected}
                onClick={() => onRequestService(service.id)}
                className="group flex flex-col items-center gap-3 outline-none"
              >
                <div
                  className={`relative grid h-16 w-16 place-items-center rounded-3xl border-2 transition-all duration-300 ${
                    isSelected
                      ? "border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-200"
                      : `${service.color} border-transparent group-hover:scale-105 group-active:scale-95`
                  } ${isSubmitting && !isSelected ? "opacity-40" : "opacity-100"}`}
                >
                  {isSelected && isSubmitting ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : isSelected && !isSubmitting ? (
                    <Check className="h-8 w-8 animate-in zoom-in-50" />
                  ) : (
                    <Icon className="h-7 w-7" />
                  )}
                </div>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    isSelected ? "text-orange-600" : "text-slate-500"
                  }`}
                >
                  {service.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl bg-slate-50 p-4">
          <div className="flex gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
              <MessageSquare className="h-5 w-5 text-orange-500" />
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Tap any service above to notify our staff. We'll be with you shortly!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
