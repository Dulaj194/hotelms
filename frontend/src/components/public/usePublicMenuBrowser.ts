import { useEffect, useMemo, useState } from "react";

import type {
  PublicCategoryResponse,
  PublicMenuResponse,
} from "@/types/publicMenu";

type PublicMenuBrowserState = {
  activeCategoryId: number | null;
  setActiveCategoryId: (categoryId: number | null) => void;
  visibleCategories: PublicCategoryResponse[];
  selectedCategory: PublicCategoryResponse | null;
};

export function usePublicMenuBrowser(menu: PublicMenuResponse | null): PublicMenuBrowserState {
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const visibleCategories = useMemo(() => {
    return menu?.categories ?? [];
  }, [menu]);

  const selectedCategory = useMemo(() => {
    if (activeCategoryId === null) return null;
    return visibleCategories.find((category) => category.id === activeCategoryId) ?? null;
  }, [activeCategoryId, visibleCategories]);

  useEffect(() => {
    if (!menu) {
      setActiveCategoryId(null);
      return;
    }

    if (
      activeCategoryId !== null &&
      !visibleCategories.some((category) => category.id === activeCategoryId)
    ) {
      setActiveCategoryId(null);
    }
  }, [activeCategoryId, menu, visibleCategories]);

  return {
    activeCategoryId,
    setActiveCategoryId,
    visibleCategories,
    selectedCategory,
  };
}