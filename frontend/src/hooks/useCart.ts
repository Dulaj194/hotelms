import type {
  AddCartItemRequest,
  CartResponse,
  UpdateCartItemRequest,
} from "@/types/cart";
import type { PlaceOrderRequest, PlaceOrderResponse } from "@/types/order";
import { getGuestToken } from "@/hooks/useGuestSession";
import { useSessionCart, type UseSessionCartReturn } from "@/hooks/useSessionCart";

type UseCartReturn = UseSessionCartReturn<CartResponse, PlaceOrderRequest, PlaceOrderResponse>;

function buildGuestAddPayload(itemId: number, quantity: number): AddCartItemRequest {
  return { item_id: itemId, quantity };
}

function buildGuestUpdatePayload(quantity: number): UpdateCartItemRequest {
  return { quantity };
}

export function useCart(): UseCartReturn {
  return useSessionCart<
    AddCartItemRequest,
    UpdateCartItemRequest,
    CartResponse,
    PlaceOrderRequest,
    PlaceOrderResponse
  >({
    headerName: "X-Guest-Session",
    getToken: getGuestToken,
    cartPath: "/cart",
    placeOrderPath: "/orders",
    loadErrorMessage: "Failed to load cart",
    buildAddPayload: buildGuestAddPayload,
    buildUpdatePayload: buildGuestUpdatePayload,
  });
}
