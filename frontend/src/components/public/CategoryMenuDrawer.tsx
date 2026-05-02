import { X, UtensilsCrossed, ChevronRight, LayoutGrid } from "lucide-react";
import SafeMenuAsset from "@/components/public/SafeMenuAsset";
import type { PublicCategoryResponse } from "@/types/publicMenu";

type CategoryMenuDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: PublicCategoryResponse[];
  activeCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
};

export default function CategoryMenuDrawer({
  isOpen,
  onClose,
  categories,
  activeCategoryId,
  onSelectCategory,
}: CategoryMenuDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[2.5rem] bg-white shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.25)] transition-transform animate-in slide-in-from-bottom-full duration-500 ease-out">
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="h-1.5 w-12 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 pt-2">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">Explore Menu</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Categories</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Categories List */}
        <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-10 pt-2">
          <div className="grid grid-cols-1 gap-2.5">
            {/* "All" Option */}
            <button
              onClick={() => {
                onSelectCategory(null);
                onClose();
              }}
              className={`group flex items-center justify-between rounded-2xl border-2 p-4 transition-all duration-300 ${
                activeCategoryId === null
                  ? "border-orange-500 bg-orange-50 shadow-[0_8px_20px_-6px_rgba(249,115,22,0.2)]"
                  : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-white"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`grid h-12 w-12 place-items-center rounded-xl transition-colors ${
                  activeCategoryId === null ? "bg-orange-500 text-white" : "bg-white text-slate-400 shadow-sm"
                }`}>
                  <LayoutGrid className="h-6 w-6" />
                </div>
                <div>
                  <p className={`text-base font-bold ${
                    activeCategoryId === null ? "text-orange-600" : "text-slate-700"
                  }`}>All Items</p>
                  <p className="text-[11px] font-medium text-slate-400">View everything we offer</p>
                </div>
              </div>
              <ChevronRight className={`h-5 w-5 transition-transform ${
                activeCategoryId === null ? "translate-x-1 text-orange-500" : "text-slate-300"
              }`} />
            </button>

            {/* Category Items */}
            {categories.map((category) => {
              const isActive = activeCategoryId === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    onSelectCategory(category.id);
                    onClose();
                  }}
                  className={`group flex items-center justify-between rounded-2xl border-2 p-4 transition-all duration-300 ${
                    isActive
                      ? "border-orange-500 bg-orange-50 shadow-[0_8px_20px_-6px_rgba(249,115,22,0.2)]"
                      : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
                      <SafeMenuAsset
                        path={category.image_path}
                        alt=""
                        className="h-full w-full object-cover"
                        fallbackClassName="grid h-full w-full place-items-center bg-orange-50 text-orange-400"
                        fallback={<UtensilsCrossed className="h-5 w-5" />}
                      />
                    </div>
                    <div className="text-left">
                      <p className={`text-base font-bold ${
                        isActive ? "text-orange-600" : "text-slate-700"
                      }`}>{category.name}</p>
                      {category.description && (
                        <p className="max-w-[14rem] truncate text-[11px] font-medium text-slate-400">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 transition-transform ${
                    isActive ? "translate-x-1 text-orange-500" : "text-slate-300"
                  }`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Swipe down or tap outside to close
          </p>
        </div>
      </div>
    </div>
  );
}
