import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Category, Item, Menu } from "@/types/menu";

import { getErrorMessage } from "../utils/offerHelpers";

export function useOfferLookups(enabled: boolean) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLookups = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [menusRes, categoriesRes, itemsRes] = await Promise.all([
        api.get<Menu[]>("/menus"),
        api.get<Category[]>("/categories"),
        api.get<Item[]>("/items"),
      ]);

      setMenus(menusRes);
      setCategories(categoriesRes);
      setItems(itemsRes);
    } catch (error) {
      setError(getErrorMessage(error, "Failed to load lookup data."));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  return {
    menus,
    categories,
    items,
    loading,
    error,
    reload: loadLookups,
  };
}
