import { useState, useEffect, useRef } from "react";
import {
  Check,
  X,
  Droplets,
  User,
  FileText,
  Wifi,
  Star,
  Sparkles,
  MessageSquare,
  Utensils,
  Layers,
  RotateCcw,
  Salad,
  Smile,
  ChevronRight
} from "lucide-react";

interface QuickServiceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestService: (type: string, message?: string) => Promise<void>;
  isSubmitting: boolean;
  lastRequestedType: string | null;
}

const SERVICES = [
  { id: "BILL", name: "Request Bill", icon: FileText, color: "bg-slate-900 text-white border-slate-800", isPrimary: true },
  { id: "WATER", name: "Water", icon: Droplets, color: "bg-blue-50 text-blue-600 border-blue-100" },
  { id: "STEWARD", name: "Call a Steward", icon: User, color: "bg-amber-50 text-amber-600 border-amber-100" },
  { id: "CUTLERY", name: "Extra Cutlery", icon: Utensils, color: "bg-slate-50 text-slate-600 border-slate-100" },
  { id: "NAPKINS", name: "Napkins / Tissues", icon: Layers, color: "bg-pink-50 text-pink-600 border-pink-100" },
  { id: "CLEANING", name: "Table Cleaning", icon: Sparkles, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  { id: "ORDER_UPDATE", name: "Order Help", icon: RotateCcw, color: "bg-cyan-50 text-cyan-600 border-cyan-100" },
  { id: "CONDIMENTS", name: "Sauces / Spices", icon: Salad, color: "bg-orange-50 text-orange-600 border-orange-100" },
  { id: "REFRESHMENTS", name: "Toothpicks", icon: Smile, color: "bg-teal-50 text-teal-600 border-teal-100" },
  { id: "WIFI", name: "Wifi Password", icon: Wifi, color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
  { id: "FEEDBACK", name: "Give Feedback", icon: Star, color: "bg-purple-50 text-purple-600 border-purple-100" },
];

export default function QuickServiceDrawer({
  isOpen,
  onClose,
  onRequestService,
  isSubmitting,
  lastRequestedType,
}: QuickServiceDrawerProps) {
  const [customMessage, setCustomMessage] = useState("");
  const touchStartRef = useRef<number | null>(null);
  const touchMoveRef = useRef<number | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Clear message when drawer closes or after successful request
  useEffect(() => {
    if (!isOpen) {
      setCustomMessage("");
    }
  }, [isOpen]);

  const handleServiceClick = (serviceId: string) => {
    void onRequestService(serviceId, customMessage);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartRef.current;

    // If swiping down, we can optionally move the drawer for visual feedback
    if (deltaY > 0 && drawerRef.current) {
      drawerRef.current.style.transform = `translateY(${deltaY}px)`;
    }

    touchMoveRef.current = currentY;
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current === null || touchMoveRef.current === null) {
      touchStartRef.current = null;
      touchMoveRef.current = null;
      return;
    }

    const deltaY = touchMoveRef.current - touchStartRef.current;
    const threshold = 100; // swipe distance required to close

    if (deltaY > threshold) {
      onClose();
    } else if (drawerRef.current) {
      // Reset position if threshold not met
      drawerRef.current.style.transform = isOpen ? "translateY(0)" : "translateY(100%)";
    }

    touchStartRef.current = null;
    touchMoveRef.current = null;
  };

  return (
    <div
      className={`fixed inset-0 z-[100] overflow-hidden transition-all duration-300 ${isOpen ? "visible" : "invisible"}`}
      style={{ overscrollBehaviorY: 'contain' }} // Prevent system refresh
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"
          }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`absolute inset-x-0 bottom-0 z-10 flex w-full max-h-[92dvh] flex-col rounded-t-[2.5rem] bg-white pt-3 shadow-2xl transition-transform duration-500 ease-out ${isOpen ? "translate-y-0" : "translate-y-full"
          }`}
        style={{ touchAction: 'pan-y' }} // Allow vertical panning but prevent default pull-to-refresh
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 shrink-0" />

        <div className="px-6 mb-4 flex items-center justify-between shrink-0">
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

        {/* Scrollable List Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6 space-y-3">
          {SERVICES.map((service) => {
            const isSelected = lastRequestedType === service.id;
            const Icon = service.icon;

            return (
              <button
                key={service.id}
                disabled={isSubmitting && !isSelected}
                onClick={() => handleServiceClick(service.id)}
                className={`w-full group flex items-center gap-4 p-3.5 rounded-2xl border-2 transition-all duration-300 active:scale-[0.98] ${isSelected
                  ? "border-orange-500 bg-orange-50 text-orange-900 shadow-md"
                  : service.isPrimary
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200"
                    : "bg-white border-slate-100 text-slate-900 hover:border-orange-200 hover:bg-orange-50/30"
                  } ${isSubmitting && !isSelected ? "opacity-40" : "opacity-100"}`}
              >
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${service.isPrimary ? "bg-white/20" : isSelected ? "bg-orange-500 text-white" : service.color
                  }`}>
                  {isSelected && isSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : isSelected && !isSubmitting ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1 text-left">
                  <span className="text-[15px] font-bold tracking-tight">
                    {service.name}
                  </span>
                </div>

                {!isSelected && (
                  <ChevronRight className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${service.isPrimary ? "text-white/40" : "text-slate-300"
                    }`} />
                )}
              </button>
            );
          })}

          <div className="pt-2 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  Add a message (Optional)
                </label>
                <div className="flex items-center gap-3">
                  {customMessage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomMessage("");
                      }}
                      className="text-[10px] font-bold uppercase text-orange-500 hover:text-orange-600 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <span className={`text-[10px] font-bold ${customMessage.length > 450 ? 'text-red-500' : 'text-slate-300'}`}>
                    {customMessage.length}/500
                  </span>
                </div>
              </div>
              <div className="relative">
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value.slice(0, 500))}
                  onFocus={(e) => e.stopPropagation()}
                  placeholder="e.g. Extra ice, with lemon, or baby chair please..."
                  className="w-full min-h-[95px] rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-medium outline-none transition-all placeholder:text-slate-300 focus:border-orange-500/30 focus:bg-white focus:ring-4 focus:ring-orange-500/10 resize-none"
                />
                <div className="absolute right-4 bottom-3 pointer-events-none">
                  <MessageSquare className="h-4 w-4 text-slate-200" />
                </div>
              </div>
            </div>

            <div className={`rounded-2xl transition-all duration-500 ${lastRequestedType && !isSubmitting
              ? "bg-emerald-50 border-emerald-100 shadow-sm shadow-emerald-50"
              : "bg-orange-50/50 border-orange-100/50"
              } p-4 border`}>
              {lastRequestedType && !isSubmitting ? (
                <div className="flex items-center justify-center gap-2 text-emerald-700 animate-in fade-in slide-in-from-bottom-1">
                  <Check className="h-3.5 w-3.5" />
                  <p className="text-[11px] font-bold uppercase tracking-wider">
                    Request Sent Successfully!
                  </p>
                </div>
              ) : (
                <p className="text-[10px] font-medium text-center text-orange-700/70 leading-relaxed">
                  Tap any service above to notify our staff. We'll be with you shortly!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

