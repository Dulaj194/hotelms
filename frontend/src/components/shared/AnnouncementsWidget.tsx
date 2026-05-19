import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Bell, 
  X, 
  ArrowUpRight, 
  ShieldAlert, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { api } from "@/lib/api";

interface Banner {
  id: number;
  title: string;
  content: string;
  type: "info" | "success" | "warning" | "danger";
  image_url?: string;
  cta_link?: string;
  cta_label?: string;
  dismissible: boolean;
}

export default function AnnouncementsWidget() {
  const [activeTab, setActiveTab] = useState<"promotional" | "system_alert">("promotional");
  const [promoBanners, setPromoBanners] = useState<Banner[]>([]);
  const [systemBanners, setSystemBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  // Carousel slider state for promotions
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(0);

  // Local dismissed keys state to avoid flashing
  const [dismissedKeys, setDismissedKeys] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("dismissed_platform_banners");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let active = true;

    async function fetchBanners() {
      try {
        const response = await api.get<{
          promotional: Banner[];
          system_alert: Banner[];
        }>("/dashboard/banners/active");
        
        if (!active) return;

        // Extract and filter out already dismissed banners
        const promos = (response.promotional || []).filter(
          (b) => !dismissedKeys.includes(b.id)
        );
        const systems = (response.system_alert || []).filter(
          (b) => !dismissedKeys.includes(b.id)
        );

        setPromoBanners(promos);
        setSystemBanners(systems);
      } catch (err) {
        console.error("Failed to load platform announcements:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchBanners();
    return () => {
      active = false;
    };
  }, [dismissedKeys]);

  // Auto-play timer: 5-second interval for promotional banners
  useEffect(() => {
    if (activeTab !== "promotional" || promoBanners.length <= 1 || isPaused) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promoBanners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [activeTab, promoBanners.length, isPaused]);

  // Navigate carousel
  const handleNext = () => {
    if (promoBanners.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % promoBanners.length);
    }
  };

  const handlePrev = () => {
    if (promoBanners.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + promoBanners.length) % promoBanners.length);
    }
  };

  // Swiping gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    setIsPaused(true); // Pause on touch hold
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - endX;
    
    if (diff > 50) {
      handleNext(); // Swiped left
    } else if (diff < -50) {
      handlePrev(); // Swiped right
    }
    
    setIsPaused(false); // Resume rotation
  };

  // Dismiss banner
  const dismissBanner = (id: number) => {
    const updated = [...dismissedKeys, id];
    setDismissedKeys(updated);
    try {
      localStorage.setItem("dismissed_platform_banners", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    // Adjust carousel index if dismissed item is the last one in active promos
    if (activeTab === "promotional") {
      setPromoBanners((prev) => {
        const nextPromos = prev.filter((b) => b.id !== id);
        if (currentIndex >= nextPromos.length && nextPromos.length > 0) {
          setCurrentIndex(nextPromos.length - 1);
        }
        return nextPromos;
      });
    } else {
      setSystemBanners((prev) => prev.filter((b) => b.id !== id));
    }
  };

  // Skip rendering if completely empty or loading
  if (loading || (promoBanners.length === 0 && systemBanners.length === 0)) {
    return null;
  }

  const currentPromo = promoBanners[currentIndex];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm backdrop-blur-md mb-6 overflow-hidden">
      
      {/* ─────────────────────────────────────────────────────────────────
          TABS HEADERS
          ───────────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4 gap-4 items-center">
        
        {/* Promotional / Marketing Tab */}
        <button
          onClick={() => setActiveTab("promotional")}
          className={`flex items-center gap-2 text-sm font-semibold transition-all pb-1 border-b-2 -mb-[14px] ${
            activeTab === "promotional" 
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <Sparkles size={16} />
          Discover & Share
          {promoBanners.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
          )}
        </button>

        {/* System Warnings / Notices Tab */}
        <button
          onClick={() => setActiveTab("system_alert")}
          className={`flex items-center gap-2 text-sm font-semibold transition-all pb-1 border-b-2 -mb-[14px] relative ${
            activeTab === "system_alert" 
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <Bell size={16} />
          System Alerts
          
          {/* Smart Alert Count Badge: count for <=3, pulse dot for >= 4 */}
          {systemBanners.length > 0 && (
            systemBanners.length <= 3 ? (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white flex items-center justify-center min-w-[16px] h-4">
                {systemBanners.length}
              </span>
            ) : (
              <span className="relative flex h-2.5 w-2.5 ml-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            )
          )}
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          TAB 1: DISCOVER & SHARE (Carousel Promo Layout)
          ───────────────────────────────────────────────────────────────── */}
      {activeTab === "promotional" && (
        <div className="relative min-h-[90px]">
          {promoBanners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-zinc-400 text-xs">
              No promotions or referrals at this time.
            </div>
          ) : (
            <div 
              className="relative group/carousel flex items-start gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/60 dark:border-zinc-800/60 transition-all select-none"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              
              {/* Swipe/Click Controls (shown on hover on desktop) */}
              {promoBanners.length > 1 && (
                <>
                  <button 
                    onClick={handlePrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-zinc-200 bg-white/90 dark:bg-zinc-850 dark:border-zinc-700 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity shadow-sm z-10 hover:bg-zinc-100"
                  >
                    <ChevronLeft size={16} className="text-zinc-600 dark:text-zinc-400" />
                  </button>
                  <button 
                    onClick={handleNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-zinc-200 bg-white/90 dark:bg-zinc-850 dark:border-zinc-700 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity shadow-sm z-10 hover:bg-zinc-100"
                  >
                    <ChevronRight size={16} className="text-zinc-600 dark:text-zinc-400" />
                  </button>
                </>
              )}

              {/* Promo Cover Image */}
              {currentPromo.image_url && (
                <img 
                  src={currentPromo.image_url} 
                  alt={currentPromo.title} 
                  className="w-16 h-16 object-cover rounded-lg border border-zinc-200/50 dark:border-zinc-800 shadow-sm shrink-0" 
                  draggable={false}
                />
              )}

              {/* Info text */}
              <div className="flex-1 pr-6">
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-snug">
                  {currentPromo.title}
                </h4>
                <p className="text-xs mt-1.5 text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
                  {currentPromo.content}
                </p>

                {/* Call To Action Redirect */}
                {currentPromo.cta_link && (
                  <a
                    href={currentPromo.cta_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                  >
                    {currentPromo.cta_label || "Explore Now"}
                    <ArrowUpRight size={14} />
                  </a>
                )}
              </div>

              {/* Dismiss Button */}
              {currentPromo.dismissible && (
                <button
                  onClick={() => dismissBanner(currentPromo.id)}
                  className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          {/* Dots Indicator for Carousel Navigation */}
          {promoBanners.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {promoBanners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    setIsPaused(true);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    index === currentIndex 
                      ? "bg-indigo-600 dark:bg-indigo-400 w-3" 
                      : "bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          TAB 2: SYSTEM ALERTS (Warning severity status bands)
          ───────────────────────────────────────────────────────────────── */}
      {activeTab === "system_alert" && (
        <div className="space-y-3 min-h-[90px]">
          {systemBanners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-zinc-400 text-xs">
              No active system warnings or alerts.
            </div>
          ) : (
            systemBanners.map((alert) => (
              <div 
                key={alert.id}
                className={`p-4 rounded-xl border flex items-start gap-4 relative overflow-hidden transition-all duration-200 ${getAlertStyles(alert.type)}`}
              >
                <ShieldAlert className="shrink-0 mt-0.5" size={18} />

                <div className="flex-1 pr-6">
                  <h4 className="font-bold text-sm leading-snug">{alert.title}</h4>
                  <p className="text-xs mt-1 leading-relaxed opacity-90">{alert.content}</p>
                </div>

                {/* Dismiss Button */}
                {alert.dismissible && (
                  <button
                    onClick={() => dismissBanner(alert.id)}
                    className="absolute right-3 top-3 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
      
    </div>
  );
}

function getAlertStyles(type: Banner["type"]) {
  switch (type) {
    case "info": 
      return "bg-blue-50/50 border-blue-200 text-blue-900 dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-200";
    case "success": 
      return "bg-emerald-50/50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-200";
    case "warning": 
      return "bg-amber-50/50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-200";
    case "danger": 
      return "bg-rose-50/50 border-rose-200 text-rose-900 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-200";
  }
}
