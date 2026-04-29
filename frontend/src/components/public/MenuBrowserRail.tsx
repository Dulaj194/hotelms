import { useEffect, useRef } from "react";
import { UtensilsCrossed } from "lucide-react";

import { toAssetUrl } from "@/lib/assets";
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Categories
        </p>
        <span className="text-xs text-slate-400">
          {visibleCategories.length} {visibleCategories.length === 1 ? "category" : "categories"}
        </span>
      </div>

      <div className="scrollbar-hide flex touch-pan-x gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-1">
        <button
          key="all"
          ref={(node) => {
            categoryRefs.current.set("all", node);
          }}
          type="button"
          onClick={() => onSelectCategory(null)}
          aria-pressed={activeCategoryId === null}
          className={`sticky left-0 z-10 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-left transition duration-200 ${
            activeCategoryId === null
              ? "border-orange-300 bg-orange-50 text-orange-700 shadow-[0_8px_18px_rgba(249,115,22,0.14)]"
              : "border-slate-200 bg-white text-slate-700 shadow-[0_6px_16px_rgba(15,23,42,0.05)] hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
          }`}
        >
          <span
            aria-hidden="true"
            className={`grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full text-[10px] font-black ring-1 transition ${
              activeCategoryId === null
                ? "bg-orange-100 text-orange-700 ring-orange-200"
                : "bg-slate-100 text-slate-600 ring-slate-100"
            }`}
          >
            All
          </span>

          <span className="min-w-0 truncate text-xs font-semibold leading-4">All</span>
        </button>

        {visibleCategories.map((category) => {
          const isActive = activeCategoryId === category.id;
          const imageUrl = toAssetUrl(category.image_path);
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
              className={`group inline-flex h-10 max-w-[10rem] shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-left transition duration-200 ${
                isActive
                  ? "border-orange-300 bg-orange-50 text-orange-700 shadow-[0_8px_18px_rgba(249,115,22,0.14)]"
                  : "border-slate-200 bg-white text-slate-700 shadow-[0_6px_16px_rgba(15,23,42,0.04)] hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full ring-1 transition ${
                  isActive ? "ring-orange-200" : "ring-slate-100"
                }`}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-gradient-to-br from-orange-50 via-white to-amber-100 text-orange-400">
                    <UtensilsCrossed className="h-4 w-4" />
                  </span>
                )}
              </span>

              <span className="min-w-0 truncate text-xs font-semibold leading-4">
                {category.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
