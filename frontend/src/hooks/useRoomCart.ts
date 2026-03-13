import { useCallback, useEffect, useState } from "react";
import type {
  AddRoomCartItemRequest,
  PlaceRoomOrderRequest,
  PlaceRoomOrderResponse,
  RoomCartResponse,
  UpdateRoomCartItemRequest,
} from "@/types/roomSession";
import { getRoomToken } from "@/hooks/useRoomSession";
import { createSessionRequest } from "@/lib/sessionRequest";

const roomRequest = createSessionRequest("X-Room-Session", getRoomToken);

interface UseRoomCartReturn {
  cart: RoomCartResponse | null;
  loading: boolean;
  error: string | null;
  placing: boolean;
  addItem: (itemId: number, quantity?: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  placeOrder: (data?: PlaceRoomOrderRequest) => Promise<PlaceRoomOrderResponse>;
  refetch: () => Promise<void>;
}

export function useRoomCart(): UseRoomCartReturn {
  const [cart, setCart] = useState<RoomCartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    if (!getRoomToken()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await roomRequest<RoomCartResponse>("GET", "/room-cart");
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
      const payload: AddRoomCartItemRequest = { item_id: itemId, quantity };
      await roomRequest("POST", "/room-cart/items", payload);
      await fetchCart();
    },
    [fetchCart]
  );

  const updateItem = useCallback(
    async (itemId: number, quantity: number) => {
      const payload: UpdateRoomCartItemRequest = { quantity };
      await roomRequest("PATCH", `/room-cart/items/${itemId}`, payload);
      await fetchCart();
    },
    [fetchCart]
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      await roomRequest("DELETE", `/room-cart/items/${itemId}`);
      await fetchCart();
    },
    [fetchCart]
  );

  const clearCart = useCallback(async () => {
    await roomRequest("DELETE", "/room-cart");
    setCart(null);
  }, []);

  const placeOrder = useCallback(
    async (data: PlaceRoomOrderRequest = {}): Promise<PlaceRoomOrderResponse> => {
      setPlacing(true);
      try {
        const result = await roomRequest<PlaceRoomOrderResponse>(
          "POST",
          "/room-orders",
          data
        );
        setCart(null);
        return result;
      } finally {
        setPlacing(false);
      }
    },
    []
  );

  return {
    cart,
    loading,
    error,
    placing,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    placeOrder,
    refetch: fetchCart,
  };
}
