import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  PublicCategoryResponse,
  PublicMenuResponse,
} from "@/types/publicMenu";

type PublicMenuBrowserState = {
  activeCategoryId: number | null;
  setActiveCategoryId: (categoryId: number | null) => void;
  selectNextCategory: () => void;
  selectPreviousCategory: () => void;
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

  const selectCategoryByOffset = useCallback(
    (offset: number) => {
      const categoryIds = visibleCategories.map((category) => category.id);
      const navigationIds = [null, ...categoryIds];
      const currentIndex = navigationIds.findIndex(
        (categoryId) => categoryId === activeCategoryId
      );
      const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = Math.min(
        Math.max(safeCurrentIndex + offset, 0),
        navigationIds.length - 1
      );

      if (nextIndex === safeCurrentIndex) return;

      setActiveCategoryId(navigationIds[nextIndex]);
    },
    [activeCategoryId, visibleCategories]
  );

  const selectNextCategory = useCallback(() => {
    selectCategoryByOffset(1);
  }, [selectCategoryByOffset]);

  const selectPreviousCategory = useCallback(() => {
    selectCategoryByOffset(-1);
  }, [selectCategoryByOffset]);

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
    selectNextCategory,
    selectPreviousCategory,
    visibleCategories,
    selectedCategory,
  };
}
