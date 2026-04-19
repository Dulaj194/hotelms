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

      <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
        <button
          key="all"
          ref={(node) => {
            categoryRefs.current.set("all", node);
          }}
          type="button"
          onClick={() => onSelectCategory(null)}
          aria-pressed={activeCategoryId === null}
          className={`group flex min-w-[5.75rem] snap-center flex-col items-center justify-center gap-2 rounded-[1.5rem] border px-3 py-3 text-center transition duration-200 ${
            activeCategoryId === null
              ? "border-orange-300 bg-orange-50 shadow-[0_10px_25px_rgba(249,115,22,0.12)]"
              : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_10px_25px_rgba(15,23,42,0.06)]"
          }`}
        >
          <div
            className={`grid h-14 w-14 place-items-center overflow-hidden rounded-full ring-1 transition ${
              activeCategoryId === null ? "ring-orange-200" : "ring-slate-100"
            }`}
          >
            <div className="grid h-full w-full place-items-center bg-slate-100 text-slate-700 font-bold text-base">
              All
            </div>
          </div>
          <span
            className={`line-clamp-2 text-xs font-semibold leading-4 ${
              activeCategoryId === null ? "text-orange-700" : "text-slate-700"
            }`}
          >
            All
          </span>
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
                className={`group flex min-w-[5.75rem] snap-center flex-col items-center gap-2 rounded-[1.5rem] border px-3 py-3 text-center transition duration-200 ${
                  isActive
                    ? "border-orange-300 bg-orange-50 shadow-[0_10px_25px_rgba(249,115,22,0.12)]"
                    : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_10px_25px_rgba(15,23,42,0.06)]"
                }`}
              >
                <div
                  className={`grid h-14 w-14 place-items-center overflow-hidden rounded-full ring-1 transition ${
                    isActive ? "ring-orange-200" : "ring-slate-100"
                  }`}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={category.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-orange-50 via-white to-amber-100 text-orange-400">
                      <UtensilsCrossed className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <span
                  className={`line-clamp-2 text-xs font-semibold leading-4 ${
                    isActive ? "text-orange-700" : "text-slate-700"
                  }`}
                >
                  {category.name}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}