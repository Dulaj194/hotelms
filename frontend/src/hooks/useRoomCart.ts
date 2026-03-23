import type {
  AddRoomCartItemRequest,
  PlaceRoomOrderRequest,
  PlaceRoomOrderResponse,
  RoomCartResponse,
  UpdateRoomCartItemRequest,
} from "@/types/roomSession";
import { getRoomToken } from "@/hooks/useRoomSession";
import { useSessionCart, type UseSessionCartReturn } from "@/hooks/useSessionCart";

type UseRoomCartReturn = UseSessionCartReturn<
  RoomCartResponse,
  PlaceRoomOrderRequest,
  PlaceRoomOrderResponse
>;

function buildRoomAddPayload(itemId: number, quantity: number): AddRoomCartItemRequest {
  return { item_id: itemId, quantity };
}

function buildRoomUpdatePayload(quantity: number): UpdateRoomCartItemRequest {
  return { quantity };
}

export function useRoomCart(): UseRoomCartReturn {
  return useSessionCart<
    AddRoomCartItemRequest,
    UpdateRoomCartItemRequest,
    RoomCartResponse,
    PlaceRoomOrderRequest,
    PlaceRoomOrderResponse
  >({
    headerName: "X-Room-Session",
    getToken: getRoomToken,
    cartPath: "/room-cart",
    placeOrderPath: "/room-orders",
    loadErrorMessage: "Failed to load cart",
    buildAddPayload: buildRoomAddPayload,
    buildUpdatePayload: buildRoomUpdatePayload,
  });
}
