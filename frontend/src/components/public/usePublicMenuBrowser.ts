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

  const effectiveActiveCategoryId = useMemo(() => {
    return activeCategoryId ?? visibleCategories[0]?.id ?? null;
  }, [activeCategoryId, visibleCategories]);

  const selectedCategory = useMemo(() => {
    if (effectiveActiveCategoryId === null) return null;
    return (
      visibleCategories.find((category) => category.id === effectiveActiveCategoryId) ??
      null
    );
  }, [effectiveActiveCategoryId, visibleCategories]);

  const selectCategoryByOffset = useCallback(
    (offset: number) => {
      if (visibleCategories.length === 0) return;

      const currentIndex = visibleCategories.findIndex(
        (category) => category.id === effectiveActiveCategoryId
      );
      const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex =
        (safeCurrentIndex + offset + visibleCategories.length) % visibleCategories.length;

      setActiveCategoryId(visibleCategories[nextIndex].id);
    },
    [effectiveActiveCategoryId, visibleCategories]
  );

  const selectNextCategory = useCallback(() => {
    selectCategoryByOffset(1);
  }, [selectCategoryByOffset]);

  const selectPreviousCategory = useCallback(() => {
    selectCategoryByOffset(-1);
  }, [selectCategoryByOffset]);

  useEffect(() => {
    if (!menu || visibleCategories.length === 0) {
      setActiveCategoryId(null);
      return;
    }

    if (
      activeCategoryId === null ||
      !visibleCategories.some((category) => category.id === activeCategoryId)
    ) {
      setActiveCategoryId(visibleCategories[0].id);
    }
  }, [activeCategoryId, menu, visibleCategories]);

  return {
    activeCategoryId: effectiveActiveCategoryId,
    setActiveCategoryId,
    selectNextCategory,
    selectPreviousCategory,
    visibleCategories,
    selectedCategory,
  };
}
