import { useCallback, useEffect, useMemo, useState } from "react";

import { createSessionRequest } from "@/lib/sessionRequest";

export interface UseSessionCartReturn<CartResponse, PlaceOrderRequest, PlaceOrderResponse> {
  cart: CartResponse | null;
  loading: boolean;
  error: string | null;
  placing: boolean;
  addItem: (itemId: number, quantity?: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  placeOrder: (data?: PlaceOrderRequest) => Promise<PlaceOrderResponse>;
  refetch: () => Promise<void>;
}

interface UseSessionCartConfig<AddPayload, UpdatePayload> {
  headerName: string;
  getToken: () => string | null;
  cartPath: string;
  placeOrderPath: string;
  loadErrorMessage: string;
  buildAddPayload: (itemId: number, quantity: number) => AddPayload;
  buildUpdatePayload: (quantity: number) => UpdatePayload;
}

export function useSessionCart<
  AddPayload,
  UpdatePayload,
  CartResponse,
  PlaceOrderRequest,
  PlaceOrderResponse,
>(
  config: UseSessionCartConfig<AddPayload, UpdatePayload>
): UseSessionCartReturn<CartResponse, PlaceOrderRequest, PlaceOrderResponse> {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    headerName,
    getToken,
    cartPath,
    placeOrderPath,
    loadErrorMessage,
    buildAddPayload,
    buildUpdatePayload,
  } = config;

  const sessionRequest = useMemo(
    () => createSessionRequest(headerName, getToken),
    [headerName, getToken]
  );

  const fetchCart = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await sessionRequest<CartResponse>("GET", cartPath);
      setCart(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : loadErrorMessage);
    } finally {
      setLoading(false);
    }
  }, [cartPath, getToken, loadErrorMessage, sessionRequest]);

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  const addItem = useCallback(
    async (itemId: number, quantity = 1) => {
      await sessionRequest(
        "POST",
        `${cartPath}/items`,
        buildAddPayload(itemId, quantity)
      );
      await fetchCart();
    },
    [buildAddPayload, cartPath, fetchCart, sessionRequest]
  );

  const updateItem = useCallback(
    async (itemId: number, quantity: number) => {
      await sessionRequest(
        "PATCH",
        `${cartPath}/items/${itemId}`,
        buildUpdatePayload(quantity)
      );
      await fetchCart();
    },
    [buildUpdatePayload, cartPath, fetchCart, sessionRequest]
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      await sessionRequest("DELETE", `${cartPath}/items/${itemId}`);
      await fetchCart();
    },
    [cartPath, fetchCart, sessionRequest]
  );

  const clearCart = useCallback(async () => {
    await sessionRequest("DELETE", cartPath);
    setCart(null);
  }, [cartPath, sessionRequest]);

  const placeOrder = useCallback(
    async (data: PlaceOrderRequest = {} as PlaceOrderRequest): Promise<PlaceOrderResponse> => {
      setPlacing(true);
      try {
        const result = await sessionRequest<PlaceOrderResponse>(
          "POST",
          placeOrderPath,
          data
        );
        setCart(null);
        return result;
      } finally {
        setPlacing(false);
      }
    },
    [placeOrderPath, sessionRequest]
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
