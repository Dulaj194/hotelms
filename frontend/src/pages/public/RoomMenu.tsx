/**
 * Room Menu - public guest-facing room ordering page.
 *
 * Route: /menu/:restaurantId/room/:roomNumber
 *
 * Flow:
 * 1. On mount: start or reuse a room session (POST /room-sessions/start).
 * 2. Fetch the public menu (same menu endpoint as table flow).
 * 3. Guest browses categories and items.
 * 4. Guest adds items to room cart (X-Room-Session header).
 * 5. Guest reviews cart and places room order.
 * 6. Confirmation shown with order number.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { setRoomSession } from "@/hooks/useRoomSession";
import { useRoomCart } from "@/hooks/useRoomCart";
import { publicGet, publicPost } from "@/lib/publicApi";
import type { PublicItemSummaryResponse, PublicMenuResponse } from "@/types/publicMenu";
import type { RoomSessionStartResponse, RoomOrderDetailResponse } from "@/types/roomSession";

// Sub-component: Cart Drawer (inline, room-specific)

interface RoomCartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: import("@/types/roomSession").RoomCartResponse | null;
  onUpdateItem: (itemId: number, quantity: number) => Promise<void>;
  onRemoveItem: (itemId: number) => Promise<void>;
  onClearCart: () => Promise<void>;
  onPlaceOrder: () => Promise<void>;
  placing: boolean;
  orderPlaced: RoomOrderDetailResponse | null;
}

function RoomCartDrawer({
  open,
  onClose,
  cart,
  onUpdateItem,
  onRemoveItem,
  onClearCart,
  onPlaceOrder,
  placing,
  orderPlaced,
}: RoomCartDrawerProps) {
  const [placeError, setPlaceError] = useState<string | null>(null);
  const itemCount = cart?.item_count ?? 0;
  const total = cart?.total ?? 0;

  const handlePlaceOrder = async () => {
    setPlaceError(null);
    try {
      await onPlaceOrder();
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "Failed to place order.");
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed right-0 top-0 z-50 box-border flex h-full w-full max-w-[min(24rem,100%)] min-w-0 flex-col overflow-x-hidden bg-white shadow-xl
          transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Room cart"
      >
        {/* Header */}
        <div className="flex min-w-0 items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="min-w-0 truncate text-lg font-semibold">
            Cart{itemCount > 0 ? ` (${itemCount})` : ""}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close cart"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Order confirmation */}
        {orderPlaced && (
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Order Placed!</h3>
            <p className="text-gray-500 text-sm mb-3">
              Your order has been sent to the kitchen.
            </p>
            <div className="mb-4 w-full max-w-full rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Order number</p>
              <p className="font-bold text-gray-900">{orderPlaced.order_number}</p>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Total: ${orderPlaced.total_amount.toFixed(2)}
            </p>
            <button
              onClick={onClose}
              className="box-border min-h-10 w-full max-w-full rounded-xl bg-orange-500 py-2 text-sm font-semibold text-white
                         hover:bg-orange-600 transition-colors"
            >
              Continue Browsing
            </button>
          </div>
        )}

        {/* Cart items */}
        {!orderPlaced && (
          <>
            <div className="min-w-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {!cart || cart.items.length === 0 ? (
                <p className="text-center text-gray-400 mt-8">Your cart is empty.</p>
              ) : (
                cart.items.map((item) => (
                  <div
                    key={item.item_id}
                    className="box-border flex w-full max-w-full min-w-0 flex-wrap items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        ${item.unit_price.toFixed(2)} each
                      </p>
                      {!item.is_available && (
                        <p className="text-xs text-red-500 mt-0.5">Unavailable</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() =>
                          item.quantity > 1
                            ? onUpdateItem(item.item_id, item.quantity - 1)
                            : onRemoveItem(item.item_id)
                        }
                        className="w-7 h-7 flex items-center justify-center rounded-full border
                                   hover:bg-gray-100 text-sm font-medium"
                        aria-label="Decrease"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateItem(item.item_id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-full border
                                   hover:bg-gray-100 text-sm font-medium"
                        aria-label="Increase"
                      >
                        +
                      </button>
                    </div>

                    <div className="w-16 shrink-0 text-right text-sm font-semibold">
                      ${item.line_total.toFixed(2)}
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.item_id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${item.name}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>

            {cart && cart.items.length > 0 && (
              <div className="space-y-3 border-t px-4 py-4">
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>

                {placeError && (
                  <p className="text-xs text-red-600 text-center">{placeError}</p>
                )}

                <button
                  onClick={handlePlaceOrder}
                  disabled={placing}
                  className="box-border min-h-10 w-full max-w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white
                             hover:bg-orange-600 transition-colors disabled:opacity-60"
                >
                  {placing ? "Placing order..." : `Place Order - $${total.toFixed(2)}`}
                </button>

                <button
                  onClick={onClearCart}
                  disabled={placing}
                  className="box-border min-h-10 w-full max-w-full rounded-lg border border-red-200 py-2 text-sm text-red-600
                             hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Clear cart
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// Main page component

export default function RoomMenu() {
  const [searchParams] = useSearchParams();
  const { restaurantId, roomNumber } = useParams<{
    restaurantId: string;
    roomNumber: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";

  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [placedOrder, setPlacedOrder] = useState<RoomOrderDetailResponse | null>(null);

  const { cart, addItem, updateItem, removeItem, clearCart, placeOrder, placing, refetch } =
    useRoomCart();

  // 1. Start (or reuse) a room session
  useEffect(() => {
    if (!restaurantId || !roomNumber) return;

    const init = async () => {
      if (!qrAccessKey) {
        setPageError("Invalid room QR link. Please scan the room QR code again.");
        return;
      }
      try {
        const session = await publicPost<RoomSessionStartResponse>(
          "/room-sessions/start",
          {
            restaurant_id: Number(restaurantId),
            room_number: roomNumber,
            qr_access_key: qrAccessKey,
          }
        );
        setRoomSession(session);
        setSessionReady(true);
      } catch {
        setPageError(
          "Could not start a room session. Please scan the QR code again."
        );
      }
    };

    void init();
  }, [restaurantId, roomNumber, qrAccessKey]);

  // 2. Fetch public menu
  useEffect(() => {
    if (!restaurantId) return;

    const fetchMenu = async () => {
      try {
        const data = await publicGet<PublicMenuResponse>(
          `/public/restaurants/${restaurantId}/menu`
        );
        setMenu(data);
        if (data.categories.length > 0) {
          setActiveCategoryId(data.categories[0].id);
        }
      } catch {
        setPageError("Failed to load the menu. Please try again.");
      }
    };

    void fetchMenu();
  }, [restaurantId]);

  // 3. Refetch cart once session is ready
  useEffect(() => {
    if (sessionReady) void refetch();
  }, [sessionReady, refetch]);

  const handleAddToCart = useCallback(
    async (itemId: number) => {
      setAddingItemId(itemId);
      try {
        await addItem(itemId, 1);
      } finally {
        setAddingItemId(null);
      }
    },
    [addItem]
  );

  const handlePlaceOrder = useCallback(async () => {
    const result = await placeOrder({});
    setPlacedOrder(result.order);
    setCartOpen(true); // keep drawer open to show confirmation
  }, [placeOrder]);

  // Render

  if (pageError) {
    return (
      <div className="box-border flex min-h-screen w-full max-w-full items-center justify-center overflow-x-hidden p-6">
        <p className="max-w-sm text-center text-red-600">{pageError}</p>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="box-border flex min-h-screen w-full max-w-full items-center justify-center overflow-x-hidden">
        <p className="animate-pulse text-gray-400">Loading menu...</p>
      </div>
    );
  }

  const activeCategory =
    menu.categories.find((c) => c.id === activeCategoryId) ?? menu.categories[0];
  const visibleSubcategories =
    activeCategory?.subcategories.filter((subcat) => subcat.items.length > 0) ?? [];
  const hasDirectItems = (activeCategory?.items.length ?? 0) > 0;
  const hasAnyItems = hasDirectItems || visibleSubcategories.length > 0;

  const renderItemCard = (item: PublicItemSummaryResponse) => {
    const cartItem = cart?.items.find((ci) => ci.item_id === item.id);
    const qtyInCart = cartItem?.quantity ?? 0;
    const isAdding = addingItemId === item.id;

    return (
      <div
        key={item.id}
        className={`box-border flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden rounded-xl border bg-white ${
          !item.is_available ? "opacity-60" : ""
        }`}
      >
        {item.image_path && (
          <img
            src={item.image_path}
            alt={item.name}
            className="h-36 w-full max-w-full object-cover"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
          <div className="min-w-0 flex-1">
            <p className="min-w-0 break-words text-sm font-bold leading-tight line-clamp-2">
              {item.name}
            </p>
            {item.description && (
              <p className="mt-0.5 min-w-0 break-words text-xs text-gray-500 line-clamp-2">
                {item.description}
              </p>
            )}
          </div>

          <div className="mt-1 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 text-sm font-bold text-orange-600">
              ${item.price.toFixed(2)}
            </span>

            {!item.is_available ? (
              <span className="text-xs text-gray-400">Unavailable</span>
            ) : qtyInCart > 0 ? (
              <div className="flex min-w-0 items-center gap-2">
                <button
                  onClick={() =>
                    qtyInCart > 1
                      ? updateItem(item.id, qtyInCart - 1)
                      : removeItem(item.id)
                  }
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border
                             hover:bg-gray-100 transition-colors text-sm font-bold"
                  aria-label="Decrease"
                >
                  -
                </button>
                <span className="text-sm font-semibold w-5 text-center">
                  {qtyInCart}
                </span>
                <button
                  onClick={() => updateItem(item.id, qtyInCart + 1)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                             bg-orange-500 text-white hover:bg-orange-600 transition-colors
                             text-sm font-bold"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                disabled={isAdding || !sessionReady}
                onClick={() => handleAddToCart(item.id)}
                className="box-border inline-flex min-h-10 w-full max-w-full items-center justify-center gap-1 bg-orange-500 px-3 py-1.5 text-white
                           rounded-full text-xs font-semibold hover:bg-orange-600
                           transition-colors disabled:opacity-50 min-[360px]:w-auto"
              >
                {isAdding ? "Adding..." : "+ Add"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="box-border flex min-h-screen w-full max-w-full min-w-0 flex-col overflow-x-hidden bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 w-full max-w-full border-b bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-[min(72rem,100%)] min-w-0 items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {menu.restaurant.logo_url && (
              <img
                src={menu.restaurant.logo_url}
                alt={menu.restaurant.name}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {menu.restaurant.name}
              </p>
              {roomNumber && (
                <p className="text-xs text-gray-500">Room {roomNumber}</p>
              )}
            </div>
          </div>

          {/* Service request link + Cart button */}
          <div className="flex shrink-0 items-center gap-2">
            {restaurantId && roomNumber && (
              <Link
                to={`/menu/${restaurantId}/room/${roomNumber}/service-request`}
                className="box-border inline-flex max-w-[6.5rem] items-center justify-center gap-1.5 truncate rounded-full border border-orange-200 px-3 py-2 text-xs font-medium text-orange-600
                           transition-colors hover:bg-orange-50"
                aria-label="Service request"
              >
                Request
              </Link>
            )}
          {/* Cart button */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative shrink-0 rounded-full p-2 transition-colors hover:bg-gray-100"
            aria-label="Open cart"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {(cart?.item_count ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold
                               rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {cart!.item_count}
              </span>
            )}
          </button>
          </div>
        </div>

        {/* Category tabs */}
        {menu.categories.length > 1 && (
          <div className="scrollbar-hide mx-auto box-border flex w-full max-w-[min(72rem,100%)] min-w-0 gap-1 overflow-x-auto px-4 pb-2">
            {menu.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`max-w-[9rem] shrink-0 truncate rounded-full px-4 py-1.5 text-sm font-medium transition-colors min-[390px]:max-w-[11.5rem] ${
                  activeCategoryId === cat.id
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Item grid */}
      <main className="mx-auto w-full max-w-[min(72rem,100%)] min-w-0 flex-1 space-y-6 px-4 py-4">
        {activeCategory && (
          <section className="min-w-0">
            {activeCategory.description && (
              <p className="mb-4 min-w-0 break-words text-sm text-gray-500">
                {activeCategory.description}
              </p>
            )}

            {!hasAnyItems ? (
              <p className="text-center text-gray-400 py-12">
                No items in this category.
              </p>
            ) : (
              <div className="space-y-6">
                {hasDirectItems && (
                  <div className="min-w-0">
                    {visibleSubcategories.length > 0 && (
                      <h2 className="mb-3 min-w-0 break-words text-sm font-semibold text-gray-700">
                        Other items
                      </h2>
                    )}
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      {activeCategory.items.map(renderItemCard)}
                    </div>
                  </div>
                )}

                {visibleSubcategories.map((subcategory) => (
                  <div key={subcategory.id} className="min-w-0">
                    <h2 className="min-w-0 break-words text-sm font-semibold text-gray-800">
                      {subcategory.name}
                    </h2>
                    {subcategory.description && (
                      <p className="mb-3 mt-1 min-w-0 break-words text-xs text-gray-500">
                        {subcategory.description}
                      </p>
                    )}
                    <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      {subcategory.items.map(renderItemCard)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Cart FAB for mobile */}
      {(cart?.item_count ?? 0) > 0 && !cartOpen && !placedOrder && (
        <div className="fixed bottom-4 left-0 right-0 z-30 box-border w-full max-w-full px-4">
          <button
            onClick={() => setCartOpen(true)}
            className="mx-auto box-border flex w-full max-w-[min(72rem,100%)] min-w-0 items-center justify-between gap-3 rounded-2xl bg-orange-500
                       px-5 py-3 text-white shadow-lg transition-colors hover:bg-orange-600"
          >
            <span className="min-w-0 truncate font-semibold">
              {cart!.item_count} item{cart!.item_count !== 1 ? "s" : ""} in cart
            </span>
            <span className="shrink-0 font-bold">${cart!.total.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Room cart drawer */}
      <RoomCartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
        onClearCart={clearCart}
        onPlaceOrder={handlePlaceOrder}
        placing={placing}
        orderPlaced={placedOrder}
      />
    </div>
  );
}
