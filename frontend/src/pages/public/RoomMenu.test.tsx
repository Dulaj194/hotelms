import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RoomMenu from "@/pages/public/RoomMenu";

const { publicGet, publicPost, setRoomSession, useRoomCart } = vi.hoisted(() => ({
  publicGet: vi.fn(),
  publicPost: vi.fn(),
  setRoomSession: vi.fn(),
  useRoomCart: vi.fn(),
}));

vi.mock("@/lib/publicApi", () => ({
  publicGet,
  publicPost,
}));

vi.mock("@/hooks/useRoomSession", () => ({
  setRoomSession,
}));

vi.mock("@/hooks/useRoomCart", () => ({
  useRoomCart,
}));

describe("RoomMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicPost.mockResolvedValue({
      session_id: "room-session-1",
      room_session_token: "room-token-1",
      restaurant_id: 5,
      room_id: 8,
      room_number: "101",
      expires_at: "2026-04-02T20:00:00Z",
    });
    publicGet.mockResolvedValue({
      restaurant: {
        id: 5,
        name: "Coastal Bay",
        phone: null,
        address: null,
        logo_url: null,
        is_active: true,
      },
      menus: [],
      uncategorized_categories: [],
      categories: [
        {
          id: 10,
          name: "Mains",
          description: "Popular dishes",
          image_path: null,
          sort_order: 1,
          menu_id: null,
          items: [
            {
              id: 100,
              name: "Seafood Fried Rice",
              description: "Fresh and spicy",
              price: 12,
              image_path: null,
              is_available: true,
              category_id: 10,
              subcategory_id: null,
            },
          ],
          subcategories: [],
        },
      ],
    });
    useRoomCart.mockReturnValue({
      cart: {
        session_id: "room-session-1",
        restaurant_id: 5,
        room_id: 8,
        room_number: "101",
        items: [
          {
            item_id: 100,
            name: "Seafood Fried Rice",
            unit_price: 12,
            quantity: 1,
            line_total: 12,
            is_available: true,
          },
        ],
        total: 12,
        item_count: 1,
      },
      addItem: vi.fn(),
      updateItem: vi.fn(),
      removeItem: vi.fn(),
      clearCart: vi.fn(),
      placeOrder: vi.fn().mockResolvedValue({
        order: {
          id: 900,
          order_number: "RO-900",
          session_id: "room-session-1",
          restaurant_id: 5,
          order_source: "room",
          room_id: 8,
          room_number: "101",
          customer_name: null,
          status: "pending",
          subtotal_amount: 12,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: 12,
          placed_at: "2026-04-02T12:00:00Z",
          confirmed_at: null,
          processing_at: null,
          completed_at: null,
          rejected_at: null,
          notes: null,
          items: [],
        },
        message: "ok",
      }),
      placing: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("lets a guest track a room order after placement", async () => {
    render(
      <MemoryRouter initialEntries={["/menu/5/room/101?k=room-secret"]}>
        <Routes>
          <Route path="/menu/:restaurantId/room/:roomNumber" element={<RoomMenu />} />
          <Route
            path="/menu/:restaurantId/room/:roomNumber/order/:orderId"
            element={<div>Room order route</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("Seafood Fried Rice")).length).toBeGreaterThan(0);
    expect(setRoomSession).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /1 item in cart/i }));
    fireEvent.click(screen.getByRole("button", { name: "Place Order - $12.00" }));

    expect(await screen.findByText("Order Placed!")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Track Order" }));
    expect(await screen.findByText("Room order route")).toBeTruthy();
  });
});
