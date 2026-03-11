import { useCallback, useEffect, useState } from "react";
import type {
  AddCartItemRequest,
  CartResponse,
  UpdateCartItemRequest,
} from "@/types/cart";
import { getGuestToken } from "@/hooks/useGuestSession";

const BASE_URL =
  (import.meta as { env: Record<string, string | undefined> }).env.VITE_API_URL ??
  "http://localhost:8000/api/v1";

async function guestRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getGuestToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["X-Guest-Session"] = token;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    throw new Error(
      `${method} ${path} failed — ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

interface UseCartReturn {
  cart: CartResponse | null;
  loading: boolean;
  error: string | null;
  addItem: (itemId: number, quantity?: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useCart(): UseCartReturn {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    if (!getGuestToken()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await guestRequest<CartResponse>("GET", "/cart");
      setCart(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cart");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  const addItem = useCallback(
    async (itemId: number, quantity = 1) => {
      const payload: AddCartItemRequest = { item_id: itemId, quantity };
      await guestRequest("POST", "/cart/items", payload);
      await fetchCart();
    },
    [fetchCart]
  );

  const updateItem = useCallback(
    async (itemId: number, quantity: number) => {
      const payload: UpdateCartItemRequest = { quantity };
      await guestRequest("PATCH", `/cart/items/${itemId}`, payload);
      await fetchCart();
    },
    [fetchCart]
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      await guestRequest("DELETE", `/cart/items/${itemId}`);
      await fetchCart();
    },
    [fetchCart]
  );

  const clearCart = useCallback(async () => {
    await guestRequest("DELETE", "/cart");
    setCart(null);
  }, []);

  return {
    cart,
    loading,
    error,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    refetch: fetchCart,
  };
}
