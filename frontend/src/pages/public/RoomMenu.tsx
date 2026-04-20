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
import { ChevronRight } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import MenuBrowserRail from "@/components/public/MenuBrowserRail";
import { usePublicMenuBrowser } from "@/components/public/usePublicMenuBrowser";
import { setRoomSession } from "@/hooks/useRoomSession";
import { useRoomCart } from "@/hooks/useRoomCart";
import { publicGet, publicPost } from "@/lib/publicApi";
import type { PublicItemSummaryResponse, PublicMenuResponse } from "@/types/publicMenu";
import type { RoomSessionStartResponse, RoomOrderDetailResponse } from "@/types/roomSession";

// Sub-component: Cart Drawer (inline, room-specific)

interface RoomCartDrawerProps {
  open: boolean;
  onClose: () => void;
  onContinueBrowsing: () => void;
  onTrackOrder: () => void;
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
  onContinueBrowsing,
  onTrackOrder,
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
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-xl z-50 flex flex-col
          transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Room cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">
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
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
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
            <div className="bg-gray-50 rounded-lg px-4 py-3 w-full mb-4">
              <p className="text-xs text-gray-500 mb-1">Order number</p>
              <p className="font-bold text-gray-900">{orderPlaced.order_number}</p>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Total: ${orderPlaced.total_amount.toFixed(2)}
            </p>
            <div className="w-full space-y-2">
              <button
                onClick={onTrackOrder}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold
                           hover:bg-orange-600 transition-colors"
              >
                Track Order
              </button>
              <button
                onClick={onContinueBrowsing}
                className="w-full py-2 border border-orange-200 text-orange-600 rounded-xl text-sm font-semibold
                           hover:bg-orange-50 transition-colors"
              >
                Continue Browsing
              </button>
            </div>
          </div>
        )}

        {/* Cart items */}
        {!orderPlaced && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {!cart || cart.items.length === 0 ? (
                <p className="text-center text-gray-400 mt-8">Your cart is empty.</p>
              ) : (
                cart.items.map((item) => (
                  <div
                    key={item.item_id}
                    className="p-2 rounded-lg border space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm break-words">{item.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          ${item.unit_price.toFixed(2)} each
                        </p>
                        {!item.is_available && (
                          <p className="text-xs text-red-500 mt-0.5">Unavailable</p>
                        )}
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => onRemoveItem(item.item_id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
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

                    <div className="flex items-center justify-between gap-2">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            item.quantity > 1
                              ? onUpdateItem(item.item_id, item.quantity - 1)
                              : onRemoveItem(item.item_id)
                          }
                          className="w-5 h-5 flex items-center justify-center rounded border
                                     hover:bg-gray-100 text-[11px] font-medium"
                          aria-label="Decrease"
                        >
                          -
                        </button>
                        <span className="w-4 text-center text-[11px] font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateItem(item.item_id, item.quantity + 1)}
                          className="w-5 h-5 flex items-center justify-center rounded border
                                     hover:bg-gray-100 text-[11px] font-medium"
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>

                      {/* Line total */}
                      <div className="text-xs font-semibold">
                        ${item.line_total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart && cart.items.length > 0 && (
              <div className="px-4 py-4 border-t space-y-3">
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
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold text-sm
                             hover:bg-orange-600 transition-colors disabled:opacity-60"
                >
                  {placing ? "Placing order..." : `Place Order - $${total.toFixed(2)}`}
                </button>

                <button
                  onClick={onClearCart}
                  disabled={placing}
                  className="w-full py-2 text-sm text-red-600 border border-red-200 rounded-lg
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
  const navigate = useNavigate();
  const { restaurantId, roomNumber } = useParams<{
    restaurantId: string;
    roomNumber: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";

  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [placedOrder, setPlacedOrder] = useState<RoomOrderDetailResponse | null>(null);

  const { cart, addItem, updateItem, removeItem, clearCart, placeOrder, placing, refetch } =
    useRoomCart();

  const {
    activeCategoryId,
    setActiveCategoryId,
    visibleCategories,
    selectedCategory,
  } = usePublicMenuBrowser(menu);

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

  const handleTrackOrder = useCallback(() => {
    if (!restaurantId || !roomNumber || !placedOrder) return;
    const basePath = `/menu/${restaurantId}/room/${roomNumber}/order/${placedOrder.id}`;
    const nextPath = qrAccessKey
      ? `${basePath}?k=${encodeURIComponent(qrAccessKey)}`
      : basePath;
    navigate(nextPath);
  }, [navigate, placedOrder, qrAccessKey, restaurantId, roomNumber]);

  const handleContinueBrowsing = useCallback(() => {
    setPlacedOrder(null);
    setCartOpen(false);
  }, []);

  // Render

  if (pageError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-red-600 text-center max-w-sm">{pageError}</p>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading menu...</p>
      </div>
    );
  }

  const renderedCategories =
    activeCategoryId === null ? visibleCategories : selectedCategory ? [selectedCategory] : [];

  const renderItemCard = (item: PublicItemSummaryResponse) => {
    const cartItem = cart?.items.find((ci) => ci.item_id === item.id);
    const qtyInCart = cartItem?.quantity ?? 0;
    const isAdding = addingItemId === item.id;
    const metaLabel = item.description ?? "";

    return (
      <div
        key={item.id}
        className={`bg-white rounded-xl border overflow-hidden flex flex-col ${
          !item.is_available ? "opacity-60" : ""
        }`}
      >
        {item.image_path && (
          <img
            src={item.image_path}
            alt={item.name}
            className="w-full h-36 object-cover"
          />
        )}
        <div className="p-3 flex flex-col gap-2 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm leading-tight line-clamp-2">{item.name}</p>
            {metaLabel && (
              <span className="max-w-[40%] truncate text-right text-[11px] text-gray-400">
                {metaLabel}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-orange-600">
              ${item.price.toFixed(2)}
            </span>
            {item.is_available ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                Available
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Sold out
              </span>
            )}
          </div>

          {qtyInCart > 0 ? (
            <div className="flex items-center justify-between rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              <button
                onClick={() =>
                  qtyInCart > 1
                    ? updateItem(item.id, qtyInCart - 1)
                    : removeItem(item.id)
                }
                className="w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold text-gray-600 transition-colors hover:bg-white"
                aria-label="Decrease"
              >
                -
              </button>
              <span className="text-sm font-semibold w-6 text-center">{qtyInCart}</span>
              <button
                onClick={() => updateItem(item.id, qtyInCart + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors text-xs font-bold"
                aria-label="Increase"
              >
                +
              </button>
            </div>
          ) : (
            <button
              disabled={isAdding || !sessionReady}
              onClick={() => handleAddToCart(item.id)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-3 py-2 text-[11px] font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {isAdding ? "Adding..." : "Add to Cart"}
              {!isAdding && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {menu.restaurant.logo_url && (
              <img
                src={menu.restaurant.logo_url}
                alt={menu.restaurant.name}
                className="h-9 w-9 rounded-full object-cover"
              />
            )}
            <div>
              <p className="font-semibold text-sm leading-tight">
                {menu.restaurant.name}
              </p>
              {roomNumber && (
                <p className="text-xs text-gray-500">Room {roomNumber}</p>
              )}
            </div>
          </div>

          {/* Service request link + Cart button */}
          <div className="flex items-center gap-2">
            {restaurantId && roomNumber && (
              <Link
                to={`/menu/${restaurantId}/room/${roomNumber}/service-request`}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-orange-600
                           border border-orange-200 rounded-full hover:bg-orange-50 transition-colors"
                aria-label="Service request"
              >
                Request
              </Link>
            )}
          {/* Cart button */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
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
        <div className="max-w-2xl mx-auto px-4 pb-2">
          <MenuBrowserRail
            visibleCategories={visibleCategories}
            activeCategoryId={activeCategoryId}
            onSelectCategory={setActiveCategoryId}
          />
        </div>
      </header>

      {/* Item grid */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-6">
        {renderedCategories.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No categories available.</p>
        ) : (
          renderedCategories.map((category) => {
            const visibleSubcategories = category.subcategories.filter(
              (subcat) => subcat.items.length > 0,
            );
            const hasDirectItems = category.items.length > 0;
            const hasAnyItems = hasDirectItems || visibleSubcategories.length > 0;

            return (
              <section key={category.id}>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{category.name}</h2>
                {category.description && (
                  <p className="text-sm text-gray-500 mb-4">{category.description}</p>
                )}

                {!hasAnyItems ? (
                  <p className="text-center text-gray-400 py-10">No items in this category.</p>
                ) : (
                  <div className="space-y-6">
                    {hasDirectItems && (
                      <div>
                        {visibleSubcategories.length > 0 && (
                          <h3 className="text-sm font-semibold text-gray-700 mb-3">Other items</h3>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          {category.items.map(renderItemCard)}
                        </div>
                      </div>
                    )}

                    {visibleSubcategories.map((subcategory) => (
                      <div key={subcategory.id}>
                        <h3 className="text-sm font-semibold text-gray-800">{subcategory.name}</h3>
                        {subcategory.description && (
                          <p className="text-xs text-gray-500 mt-1 mb-3">
                            {subcategory.description}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          {subcategory.items.map(renderItemCard)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </main>

      {/* Cart FAB for mobile */}
      {(cart?.item_count ?? 0) > 0 && !cartOpen && !placedOrder && (
        <div className="fixed bottom-4 left-0 right-0 px-4 z-30">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full max-w-2xl mx-auto flex items-center justify-between bg-orange-500
                       text-white px-5 py-3 rounded-2xl shadow-lg hover:bg-orange-600 transition-colors"
          >
            <span className="font-semibold">
              {cart!.item_count} item{cart!.item_count !== 1 ? "s" : ""} in cart
            </span>
            <span className="font-bold">${cart!.total.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Room cart drawer */}
      <RoomCartDrawer
        open={cartOpen}
        onClose={handleContinueBrowsing}
        onContinueBrowsing={handleContinueBrowsing}
        onTrackOrder={handleTrackOrder}
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
