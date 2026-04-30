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
    <div
      className="flex min-w-0 items-center gap-2.5 overflow-hidden pb-1"
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
        className={`inline-flex h-11 shrink-0 items-center rounded-full border px-5 text-left text-sm font-semibold transition duration-200 ${
          activeCategoryId === null
            ? "border-orange-300 bg-orange-50 text-orange-700 shadow-[0_8px_18px_rgba(249,115,22,0.14)]"
            : "border-slate-200 bg-white text-slate-700 shadow-[0_6px_16px_rgba(15,23,42,0.05)] hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
        }`}
      >
        All
      </button>

      <div className="scrollbar-hide flex min-w-0 flex-1 snap-x touch-pan-x gap-2.5 overflow-x-auto overscroll-x-contain scroll-smooth">
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
              className={`group inline-flex h-11 max-w-[11.5rem] shrink-0 snap-start items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-left transition duration-200 ${
                isActive
                  ? "border-orange-300 bg-orange-50 text-orange-700 shadow-[0_8px_18px_rgba(249,115,22,0.14)]"
                  : "border-slate-200 bg-white text-slate-700 shadow-[0_6px_16px_rgba(15,23,42,0.04)] hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full ring-1 transition ${
                  isActive ? "ring-orange-200" : "ring-slate-100"
                }`}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-gradient-to-br from-orange-50 via-white to-amber-100 text-orange-400">
                    <UtensilsCrossed className="h-4 w-4" />
                  </span>
                )}
              </span>

              <span className="min-w-0 truncate text-sm font-semibold leading-5">
                {category.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
