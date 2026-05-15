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
  RotateCcw,
  Salad,
  Smile,
  ChevronRight,
  Bell,
  Utensils,
  Layers,
  MessageSquare,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  Bell,
  Droplets,
  User,
  Utensils,
  Layers,
  Sparkles,
  RotateCcw,
  Salad,
  Smile,
  Wifi,
  Star,
  FileText,
  MessageSquare,
};

export interface QuickServiceItem {
  id: number;
  label: string;
  message: string;
  icon_name: string | null;
  is_active: boolean;
}

interface QuickServiceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestService: (type: string, message?: string) => Promise<void>;
  isSubmitting: boolean;
  lastRequestedId: number | null;
  services: QuickServiceItem[];
}

export default function QuickServiceDrawer({
  isOpen,
  onClose,
  onRequestService,
  isSubmitting,
  lastRequestedId,
  services,
}: QuickServiceDrawerProps) {
  const [customMessage, setCustomMessage] = useState("");
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);
  const isDragging = useRef(false);

  // Clear message when drawer closes or after successful request
  useEffect(() => {
    if (isOpen) {
      setDragY(0);
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      setCustomMessage("");
      setDragY(0);
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [isOpen]);

  const handleServiceClick = (service: QuickServiceItem) => {
    // Append custom message to the admin-defined message if present
    const fullMessage = customMessage.trim() 
      ? `${service.message}\n\nGuest Note: ${customMessage.trim()}`
      : service.message;
    
    void onRequestService(service.label, fullMessage);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const deltaY = e.touches[0].clientY - startY.current;
    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (dragY > 150) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-500 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative w-full max-w-xl mx-auto bg-white rounded-t-[2.5rem] shadow-2xl overflow-hidden transition-transform duration-500 ease-out h-[75dvh] flex flex-col ${isOpen ? "translate-y-0" : "translate-y-full"
          }`}
        style={{ 
          transform: isOpen ? `translateY(${dragY}px)` : undefined,
          transition: isDragging.current ? 'none' : 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
          touchAction: 'pan-y', 
          overscrollBehavior: 'contain'
        }}
      >
        {/* Handle */}
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200 shrink-0" />

        <div className="px-6 mb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Quick Services</h2>
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
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-8 space-y-3">
          {services.map((service) => {
            const isSelected = lastRequestedId === service.id;
            const Icon = ICON_MAP[service.icon_name || "Bell"] || Bell;

            return (
              <button
                key={service.id}
                disabled={isSubmitting && !isSelected}
                onClick={() => handleServiceClick(service)}
                className={`w-full group flex items-center gap-4 p-3.5 rounded-2xl border-2 transition-all duration-300 active:scale-[0.98] ${isSelected
                  ? "border-orange-500 bg-orange-50 text-orange-900 shadow-md"
                  : "bg-white border-slate-100 text-slate-900 hover:border-orange-200 hover:bg-orange-50/30"
                  } ${isSubmitting && !isSelected ? "opacity-40" : "opacity-100"}`}
              >
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${isSelected ? "bg-orange-500 text-white" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
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
                    {service.label}
                  </span>
                </div>

                {!isSelected && (
                  <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 text-slate-300" />
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
                {customMessage && (
                  <button
                    onClick={() => setCustomMessage("")}
                    className="text-[10px] font-bold uppercase text-orange-500 hover:text-orange-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="relative">
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value.slice(0, 500))}
                  placeholder="e.g. Extra ice, with lemon, or baby chair please..."
                  className="w-full min-h-[95px] rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-bold outline-none transition-all placeholder:text-slate-300 focus:border-orange-500/30 focus:bg-white focus:ring-4 focus:ring-orange-500/10 resize-none"
                />
                <div className="absolute right-4 bottom-3 pointer-events-none">
                  <MessageSquare className="h-4 w-4 text-slate-200" />
                </div>
              </div>
            </div>

            <div className={`rounded-2xl transition-all duration-500 ${lastRequestedId && !isSubmitting
              ? "bg-emerald-50 border-emerald-100 shadow-sm shadow-emerald-50"
              : "bg-orange-50/50 border-orange-100/50"
              } p-4 border`}>
              {lastRequestedId && !isSubmitting ? (
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

