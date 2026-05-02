import { useEffect, useRef } from "react";
import { UtensilsCrossed } from "lucide-react";

import SafeMenuAsset from "@/components/public/SafeMenuAsset";
import type { PublicCategoryResponse } from "@/types/publicMenu";

type MenuBrowserRailProps = {
  visibleCategories: PublicCategoryResponse[];
  activeCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
};

export default function MenuBrowserRail({
  visibleCategories,
  activeCategoryId,
  onSelectCategory,
}: MenuBrowserRailProps) {
  const categoryRefs = useRef(new Map<string, HTMLButtonElement | null>());

  const scrollIntoViewIfAvailable = (node: HTMLButtonElement | null | undefined) => {
    if (!node || typeof node.scrollIntoView !== "function") return;
    node.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  useEffect(() => {
    const key = activeCategoryId === null ? "all" : `category-${activeCategoryId}`;
    scrollIntoViewIfAvailable(categoryRefs.current.get(key));
  }, [activeCategoryId, visibleCategories.length]);

  if (visibleCategories.length === 0) {
    return null;
  }

  return (
    <div
      className="box-border flex w-full max-w-full min-w-0 items-center justify-center gap-2.5 overflow-hidden pb-1"
      aria-label="Menu categories"
    >
      <button
        key="all"
        ref={(node) => {
          categoryRefs.current.set("all", node);
        }}
        type="button"
        onClick={() => onSelectCategory(null)}
        aria-pressed={activeCategoryId === null}
        className={`box-border inline-flex h-12 shrink-0 items-center rounded-full border px-6 text-sm font-bold transition-all duration-300 active:scale-[0.96] ${
          activeCategoryId === null
            ? "border-orange-500 bg-orange-500 text-white shadow-[0_8px_20px_-4px_rgba(249,115,22,0.4)]"
            : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-orange-200 hover:bg-orange-50/50"
        }`}
      >
        All
      </button>

      <div className="no-scrollbar box-border flex w-full max-w-full min-w-0 flex-1 snap-x touch-pan-x justify-start gap-2.5 overflow-x-auto overscroll-x-contain scroll-smooth sm:justify-center">
        {visibleCategories.map((category) => {
          const isActive = activeCategoryId === category.id;
          const categoryKey = `category-${category.id}`;

          return (
            <button
              key={category.id}
              ref={(node) => {
                categoryRefs.current.set(categoryKey, node);
              }}
              type="button"
              onClick={() => onSelectCategory(category.id)}
              aria-pressed={isActive}
              className={`group box-border inline-flex h-12 max-w-[12rem] shrink-0 snap-start items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-5 text-left transition-all duration-300 active:scale-[0.96] ${
                isActive
                  ? "border-orange-500 bg-orange-500 text-white shadow-[0_8px_20px_-4px_rgba(249,115,22,0.4)]"
                  : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-orange-200 hover:bg-orange-50/50"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full transition-all ${
                  isActive ? "bg-white/20 ring-1 ring-white/30" : "bg-slate-50 ring-1 ring-slate-100"
                }`}
              >
                <SafeMenuAsset
                  path={category.image_path}
                  alt=""
                  className="h-full w-full object-cover"
                  fallbackClassName={`grid h-full w-full place-items-center bg-gradient-to-br transition ${
                    isActive ? "from-white/10 to-white/20 text-white" : "from-orange-50 to-amber-50 text-orange-400"
                  }`}
                  fallback={
                    <UtensilsCrossed className="h-4.5 w-4.5" />
                  }
                />
              </span>

              <span className={`min-w-0 truncate text-sm font-bold tracking-tight ${
                isActive ? "text-white" : "text-slate-700"
              }`}>
                {category.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
