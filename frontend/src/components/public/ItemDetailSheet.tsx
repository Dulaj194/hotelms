import { ShoppingCart, X, Plus, Minus, Check, UtensilsCrossed, Info, ChevronRight, Play, ExternalLink } from "lucide-react";
import SafeMenuAsset from "./SafeMenuAsset";
import { PublicItemSummaryResponse } from "@/types/publicMenu";
import { useEffect, useState, useMemo } from "react";

interface ItemDetailSheetProps {
  item: PublicItemSummaryResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (itemId: number, quantity: number) => Promise<void>;
  qtyInCart: number;
  formatPrice: (price: number) => string;
}

export default function ItemDetailSheet({
  item,
  isOpen,
  onClose,
  onAddToCart,
  qtyInCart,
  formatPrice,
}: ItemDetailSheetProps) {
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [localQty, setLocalQty] = useState(1);

  const images = useMemo(() => {
    if (!item) return [];
    return [
      item.image_path,
      item.image_path_2,
      item.image_path_3,
      item.image_path_4,
      item.image_path_5,
    ].filter(Boolean) as string[];
  }, [item]);

  const [activeImage, setActiveImage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalQty(qtyInCart > 0 ? qtyInCart : 1);
      setSuccess(false);
    }
  }, [isOpen, qtyInCart]);

  useEffect(() => {
    if (item) setActiveImage(item.image_path);
  }, [item]);

  if (!item) return null;

  const handleAdd = async () => {
    setAdding(true);
    try {
      await onAddToCart(item.id, localQty);
      setSuccess(true);
      if (window.navigator.vibrate) window.navigator.vibrate([10, 30, 10]);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 800);
    } catch (error) {
      console.error("Failed to add to cart:", error);
    } finally {
      setAdding(false);
    }
  };

  const increment = () => {
    setLocalQty((prev) => Math.min(prev + 1, 99));
    if (window.navigator.vibrate) window.navigator.vibrate(5);
  };

  const decrement = () => {
    setLocalQty((prev) => Math.max(prev - 1, 1));
    if (window.navigator.vibrate) window.navigator.vibrate(5);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm transition-opacity duration-500 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[101] flex max-h-[95dvh] flex-col overflow-hidden rounded-t-[2.5rem] bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[440px] sm:rounded-[2.5rem] ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle for mobile */}
        <div className="flex h-8 w-full shrink-0 items-center justify-center sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-slate-200" />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/80 text-slate-900 shadow-sm backdrop-blur-md transition hover:bg-white active:scale-90"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="overflow-y-auto no-scrollbar pb-[env(safe-area-inset-bottom,24px)]">
          {/* Image Header */}
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 sm:aspect-square">
            <SafeMenuAsset
              path={activeImage}
              alt={item.name}
              className="h-full w-full object-cover transition-all duration-700 hover:scale-110"
              fallback={
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-300">
                  <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-50">
                    <UtensilsCrossed className="h-10 w-10" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Flavor Insight</span>
                </div>
              }
            />

            {/* Bubble Overlay */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="group flex items-center gap-3 rounded-2xl bg-slate-900/80 px-5 py-3.5 shadow-2xl backdrop-blur-md ring-1 ring-white/20 transition-all hover:bg-slate-900">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-400/80 mb-0.5">Signature Dish</span>
                  <span className="text-sm font-black uppercase tracking-widest text-white whitespace-nowrap">
                    {item.name}
                  </span>
                </div>
                <div className="ml-2 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white transition-transform group-hover:translate-x-1">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
              <div className="mx-auto mt-[-1px] h-3 w-3 -translate-y-1/2 rotate-45 bg-slate-900/80 shadow-2xl" />
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            {!item.is_available && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px]">
                <div className="rounded-2xl bg-white/95 px-6 py-3 text-center shadow-xl">
                  <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</span>
                  <span className="text-sm font-black uppercase tracking-widest text-slate-900">Sold Out</span>
                </div>
              </div>
            )}
          </div>

          {/* Multiple Images Gallery */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto no-scrollbar px-6 py-4 bg-white/50 backdrop-blur-sm border-b border-slate-100">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 transition-all ${
                    activeImage === img
                      ? "border-orange-500 ring-4 ring-orange-500/10 scale-95"
                      : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <SafeMenuAsset
                    path={img}
                    alt={`${item.name} gallery ${idx + 1}`}
                    className="h-full w-full object-cover"
                    fallback={<UtensilsCrossed className="h-4 w-4 text-slate-300" />}
                  />
                </button>
              ))}
              {item.video_path && (
                <button
                  onClick={() => setActiveImage(null)} // Or handle video display
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-slate-100 bg-slate-900 flex flex-col items-center justify-center gap-1 text-white hover:bg-slate-800 transition-colors"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span className="text-[8px] font-black uppercase tracking-tighter">Watch</span>
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-6 sm:p-10">
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl font-black leading-[1.1] tracking-tight text-slate-900 sm:text-3xl">
                  {item.name}
                </h2>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-black tracking-tight text-orange-600 sm:text-3xl">
                    {formatPrice(item.price)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                 <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 ring-1 ring-emerald-500/20">
                   Freshly Made
                 </span>
                 <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 ring-1 ring-blue-500/20">
                   Premium Selection
                 </span>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Info className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Item Description</span>
                </div>
                <p className="text-base font-medium leading-relaxed text-slate-500 sm:text-lg">
                  {item.description || "This signature dish is crafted using time-honored techniques and the freshest ingredients available. Every element is designed to provide a sophisticated and memorable dining experience."}
                </p>
              </div>

              {item.more_details && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <UtensilsCrossed className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Chef's Special Notes</span>
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-slate-600 bg-orange-50/50 p-4 rounded-2xl border border-orange-100/50">
                    {item.more_details}
                  </p>
                </div>
              )}

              {item.blog_link && (
                <a
                  href={item.blog_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-4 rounded-2xl bg-slate-900 p-4 text-white transition hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                      <ExternalLink className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Want to know the secret?</p>
                      <p className="text-[10px] text-slate-400">Read the story behind this recipe</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </a>
              )}
              
              <div className="grid grid-cols-2 gap-4 rounded-3xl bg-slate-50 p-5">
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Preparation</span>
                  <span className="block text-xs font-bold text-slate-700">15-20 Mins</span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Serving</span>
                  <span className="block text-xs font-bold text-slate-700">Standard Portion</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-16 items-center justify-between rounded-2xl bg-slate-100 p-1.5 sm:w-44">
                <button
                  onClick={decrement}
                  className="grid h-12 w-12 place-items-center rounded-xl bg-white text-slate-900 shadow-sm transition active:scale-90 disabled:opacity-30"
                  disabled={localQty <= 1}
                >
                  <Minus className="h-5 w-5" />
                </button>
                <span className="text-xl font-black text-slate-900">
                  {localQty}
                </span>
                <button
                  onClick={increment}
                  className="grid h-12 w-12 place-items-center rounded-xl bg-white text-slate-900 shadow-sm transition active:scale-90"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              <button
                onClick={handleAdd}
                disabled={adding || !item.is_available}
                className={`group relative flex h-16 flex-1 items-center justify-center gap-3 overflow-hidden rounded-2xl text-base font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] ${
                  success
                    ? "bg-emerald-500 text-white shadow-emerald-500/20"
                    : "bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700"
                } disabled:opacity-40 disabled:shadow-none`}
              >
                {adding ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent" />
                ) : success ? (
                  <>
                    <Check className="h-6 w-6 animate-in zoom-in-50" />
                    <span>Added Successfully</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-5 w-5" />
                    <span>Add to Cart — {formatPrice(item.price * localQty)}</span>
                  </>
                )}
                
                {/* Shine effect */}
                {!success && !adding && (
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
