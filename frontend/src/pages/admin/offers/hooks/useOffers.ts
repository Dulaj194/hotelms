import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { unwrapPaginated, type PaginatedResponse } from "@/lib/pagination";
import type { Category, Item, Menu } from "@/types/menu";
import type { OfferListResponse, OfferResponse } from "@/types/offer";

import { getErrorMessage } from "../utils/offerHelpers";

export function useOffers(enabled: boolean) {
  const [offers, setOffers] = useState<OfferResponse[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [offersRes, menusRes, categoriesRes, itemsRes] = await Promise.all([
        api.get<OfferListResponse>("/offers"),
        api.get<Menu[]>("/menus"),
        api.get<Category[] | PaginatedResponse<Category>>("/categories?limit=500"),
        api.get<Item[] | PaginatedResponse<Item>>("/items?limit=500"),
      ]);

      setOffers(offersRes.items);
      setMenus(menusRes);
      setCategories(unwrapPaginated(categoriesRes));
      setItems(unwrapPaginated(itemsRes));
    } catch (error) {
      setError(getErrorMessage(error, "Failed to load offers."));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const menuNameById = useMemo(
    () => new Map(menus.map((menu) => [menu.id, menu.name])),
    [menus]
  );

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const itemNameById = useMemo(
    () => new Map(items.map((item) => [item.id, item.name])),
    [items]
  );

  const getProductLabel = useCallback(
    (offer: OfferResponse) => {
      if (offer.product_type === "menu") {
        return menuNameById.get(offer.product_id) ?? `Menu #${offer.product_id}`;
      }

      if (offer.product_type === "category") {
        return categoryNameById.get(offer.product_id) ?? `Category #${offer.product_id}`;
      }

      return itemNameById.get(offer.product_id) ?? `Item #${offer.product_id}`;
    },
    [categoryNameById, itemNameById, menuNameById]
  );

  return {
    offers,
    loading,
    error,
    setError,
    reload: loadData,
    getProductLabel,
  };
}
