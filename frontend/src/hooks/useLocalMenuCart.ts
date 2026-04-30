import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getGuestToken,
  hasGuestSessionForContext,
  setGuestSessionTokenForContext,
} from "@/hooks/useGuestSession";
import {
  getRoomToken,
  hasRoomSessionForContext,
  setRoomSessionTokenForContext,
} from "@/hooks/useRoomSession";
import { RESOLVED_API_BASE_URL } from "@/lib/networkBase";
import type { CartResponse } from "@/types/cart";
import type { PlaceOrderRequest, PlaceOrderResponse } from "@/types/order";
import type { PublicItemSummaryResponse, PublicMenuResponse } from "@/types/publicMenu";
import type {
  PlaceRoomOrderRequest,
  PlaceRoomOrderResponse,
  RoomCartResponse,
} from "@/types/roomSession";

type CartQuantities = Record<string, number>;

type MenuItemWithCategory = PublicItemSummaryResponse & {
  categoryName: string | null;
};

function readQuantities(storageKey: string): CartQuantities {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CartQuantities;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([itemId, quantity]) => [itemId, Number(quantity)] as const)
        .filter(([itemId, quantity]) => Number(itemId) > 0 && quantity > 0),
    );
  } catch {
    return {};
  }
}

function flattenMenuItems(menu: PublicMenuResponse | null): MenuItemWithCategory[] {
  if (!menu) return [];
  return menu.categories.flatMap((category) =>
    category.items.map((item) => ({ ...item, categoryName: category.name })),
  );
}

async function postJson<T>(
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${RESOLVED_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail || detail;
    } catch {
      // Keep status text.
    }
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

function useLocalQuantities(storageKey: string) {
  const [quantities, setQuantities] = useState<CartQuantities>(() => readQuantities(storageKey));

  useEffect(() => {
    setQuantities(readQuantities(storageKey));
  }, [storageKey]);

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(quantities));
  }, [quantities, storageKey]);

  const addItem = useCallback(async (itemId: number, quantity = 1) => {
    setQuantities((current) => ({
      ...current,
      [itemId]: Math.min((current[itemId] ?? 0) + quantity, 99),
    }));
  }, []);

  const updateItem = useCallback(async (itemId: number, quantity: number) => {
    setQuantities((current) => {
      const next = { ...current };
      if (quantity <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = Math.min(quantity, 99);
      }
      return next;
    });
  }, []);

  const removeItem = useCallback(async (itemId: number) => {
    setQuantities((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);

  const clearCart = useCallback(async () => {
    setQuantities({});
  }, []);

  return { quantities, setQuantities, addItem, updateItem, removeItem, clearCart };
}

export function useLocalTableCart(params: {
  restaurantId: number | null;
  tableNumber: string | null;
  qrAccessKey: string;
  menu: PublicMenuResponse | null;
  customerName: string | null;
}) {
  const { restaurantId, tableNumber, qrAccessKey, menu, customerName } = params;
  const storageKey = `hotelms:table-cart:${restaurantId ?? "unknown"}:${tableNumber ?? "unknown"}`;
  const { quantities, setQuantities, addItem, updateItem, removeItem, clearCart } =
    useLocalQuantities(storageKey);
  const [placing, setPlacing] = useState(false);

  const items = useMemo(() => flattenMenuItems(menu), [menu]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const cart = useMemo<CartResponse | null>(() => {
    if (!restaurantId || !tableNumber) return null;
    const cartItems = Object.entries(quantities)
      .map(([itemId, quantity]) => {
        const item = itemById.get(Number(itemId));
        if (!item) return null;
        const unitPrice = Number(item.price);
        return {
          item_id: item.id,
          name: item.name,
          unit_price: unitPrice,
          quantity,
          line_total: Math.round(unitPrice * quantity * 100) / 100,
          is_available: item.is_available,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return {
      session_id: "client-side",
      restaurant_id: restaurantId,
      table_number: tableNumber,
      items: cartItems,
      total: Math.round(cartItems.reduce((sum, item) => sum + item.line_total, 0) * 100) / 100,
      item_count: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [itemById, quantities, restaurantId, tableNumber]);

  const placeOrder = useCallback(
    async (data: PlaceOrderRequest = {}): Promise<PlaceOrderResponse> => {
      if (!restaurantId || !tableNumber) {
        throw new Error("Invalid table context. Please scan the QR code again.");
      }
      const orderItems = Object.entries(quantities).map(([itemId, quantity]) => ({
        item_id: Number(itemId),
        quantity,
      }));
      if (orderItems.length === 0) {
        throw new Error("Cart is empty. Add items before placing an order.");
      }

      setPlacing(true);
      try {
        const guestToken = hasGuestSessionForContext(restaurantId, tableNumber)
          ? getGuestToken()
          : null;
        const response = await postJson<PlaceOrderResponse>(
          "/orders",
          {
            ...data,
            customer_name: data.customer_name ?? customerName ?? "Guest",
            items: orderItems,
          },
          guestToken
            ? { "X-Guest-Session": guestToken }
            : { "X-Table-Key": qrAccessKey },
        );
        if (response.guest_token) {
          setGuestSessionTokenForContext({
            guestToken: response.guest_token,
            restaurantId,
            tableNumber,
            customerName: customerName ?? data.customer_name ?? "Guest",
          });
        }
        setQuantities({});
        return response;
      } finally {
        setPlacing(false);
      }
    },
    [customerName, qrAccessKey, quantities, restaurantId, setQuantities, tableNumber],
  );

  return {
    cart,
    loading: false,
    error: null,
    placing,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    placeOrder,
    refetch: async () => undefined,
  };
}

export function useLocalRoomCart(params: {
  restaurantId: number | null;
  roomId: number | null;
  roomNumber: string | null;
  qrAccessKey: string;
  menu: PublicMenuResponse | null;
}) {
  const { restaurantId, roomId, roomNumber, qrAccessKey, menu } = params;
  const storageKey = `hotelms:room-cart:${restaurantId ?? "unknown"}:${roomNumber ?? "unknown"}`;
  const { quantities, setQuantities, addItem, updateItem, removeItem, clearCart } =
    useLocalQuantities(storageKey);
  const [placing, setPlacing] = useState(false);
  const items = useMemo(() => flattenMenuItems(menu), [menu]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const cart = useMemo<RoomCartResponse | null>(() => {
    if (!restaurantId || !roomNumber) return null;
    const cartItems = Object.entries(quantities)
      .map(([itemId, quantity]) => {
        const item = itemById.get(Number(itemId));
        if (!item) return null;
        const unitPrice = Number(item.price);
        return {
          item_id: item.id,
          name: item.name,
          unit_price: unitPrice,
          quantity,
          line_total: Math.round(unitPrice * quantity * 100) / 100,
          is_available: item.is_available,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return {
      session_id: "client-side",
      restaurant_id: restaurantId,
      room_id: roomId ?? 0,
      room_number: roomNumber,
      items: cartItems,
      total: Math.round(cartItems.reduce((sum, item) => sum + item.line_total, 0) * 100) / 100,
      item_count: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [itemById, quantities, restaurantId, roomId, roomNumber]);

  const placeOrder = useCallback(
    async (data: PlaceRoomOrderRequest = {}): Promise<PlaceRoomOrderResponse> => {
      if (!restaurantId || !roomNumber) {
        throw new Error("Invalid room context. Please scan the QR code again.");
      }
      const orderItems = Object.entries(quantities).map(([itemId, quantity]) => ({
        item_id: Number(itemId),
        quantity,
      }));
      if (orderItems.length === 0) {
        throw new Error("Cart is empty. Add items before placing an order.");
      }

      setPlacing(true);
      try {
        const roomToken = hasRoomSessionForContext(restaurantId, roomNumber)
          ? getRoomToken()
          : null;
        const response = await postJson<PlaceRoomOrderResponse>(
          "/room-orders",
          { ...data, items: orderItems },
          roomToken ? { "X-Room-Session": roomToken } : { "X-Room-Key": qrAccessKey },
        );
        if (response.room_session_token) {
          setRoomSessionTokenForContext({
            roomSessionToken: response.room_session_token,
            restaurantId,
            roomId: response.order.room_id ?? roomId ?? 0,
            roomNumber,
          });
        }
        setQuantities({});
        return response;
      } finally {
        setPlacing(false);
      }
    },
    [qrAccessKey, quantities, restaurantId, roomId, roomNumber, setQuantities],
  );

  return {
    cart,
    loading: false,
    error: null,
    placing,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    placeOrder,
    refetch: async () => undefined,
  };
}
