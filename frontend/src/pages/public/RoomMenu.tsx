/**
 * Room Menu - public guest-facing room ordering page.
 *
 * Route: /menu/:restaurantId/room/:roomNumber
 *
 * Flow:
 * 1. On mount: restore QR context from URL/sessionStorage.
 * 2. Fetch the public menu (same menu endpoint as table flow).
 * 3. Guest browses categories and items.
 * 4. Guest adds items to the client-side room cart.
 * 5. Guest places the order with X-Room-Key or X-Room-Session.
 * 6. Confirmation shown with order number.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ChevronRight, Menu as MenuIcon, Search, ShoppingCart } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import PublicMenuDropdown from "@/components/public/PublicMenuDropdown";
import MenuBrowserRail from "@/components/public/MenuBrowserRail";
import { usePublicMenuBrowser } from "@/components/public/usePublicMenuBrowser";
import { useSwipeNavigation } from "@/components/public/useSwipeNavigation";
import { useLocalRoomCart } from "@/hooks/useLocalMenuCart";
import { toAssetUrl } from "@/lib/assets";
import { publicGet, publicPost } from "@/lib/publicApi";
import QuickServiceDrawer from "@/components/public/QuickServiceDrawer";
import { getRoomToken } from "@/hooks/useRoomSession";
import type { PublicItemSummaryResponse, PublicMenuResponse } from "@/types/publicMenu";
import type { RoomOrderDetailResponse } from "@/types/roomSession";

function FloatingCartButton({ itemCount, onOpenCart }: { itemCount: number; onOpenCart: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpenCart}
      className="relative -mt-6 mx-auto grid h-14 w-14 place-items-center rounded-full bg-orange-500 text-white shadow-[0_20px_40px_rgba(249,115,22,0.35)] transition hover:bg-orange-600 min-[360px]:-mt-7 min-[360px]:h-16 min-[360px]:w-16"
      aria-label={itemCount > 0 ? `Open cart, ${itemCount} items` : "Open cart"}
    >
      <ShoppingCart className="h-6 w-6 min-[360px]:h-7 min-[360px]:w-7" />
      {itemCount > 0 && (
        <span key={itemCount} className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white ring-2 ring-white animate-pop-in">
          {itemCount}
        </span>
      )}
    </button>
  );
}

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
        className={`fixed top-0 right-0 z-50 box-border flex h-full w-full max-w-[min(24rem,100%)] flex-col bg-white shadow-xl
          transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Room cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">
            Cart{itemCount > 0 ? ` (${itemCount})` : ""}
          </h2>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-gray-100"
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
                className="min-h-11 w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white
                           hover:bg-orange-600 transition-colors"
              >
                Track Order
              </button>
              <button
                onClick={onContinueBrowsing}
                className="min-h-11 w-full rounded-xl border border-orange-200 py-2 text-sm font-semibold text-orange-600
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
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {!cart || cart.items.length === 0 ? (
                <p className="text-center text-gray-400 mt-8">Your cart is empty.</p>
              ) : (
                cart.items.map((item) => (
                  <div
                    key={item.item_id}
                    className="space-y-2 rounded-xl border p-3"
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
                        className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
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
                      <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 p-1">
                        <button
                          onClick={() =>
                            item.quantity > 1
                              ? onUpdateItem(item.item_id, item.quantity - 1)
                              : onRemoveItem(item.item_id)
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors hover:bg-white"
                          aria-label="Decrease"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateItem(item.item_id, item.quantity + 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
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
              <div className="space-y-3 border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
                  className="min-h-12 w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white
                             hover:bg-orange-600 transition-colors disabled:opacity-60"
                >
                  {placing ? "Placing order..." : `Place Order - $${total.toFixed(2)}`}
                </button>

                <button
                  onClick={onClearCart}
                  disabled={placing}
                  className="min-h-11 w-full rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600
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
  const restaurantIdNumber = restaurantId ? Number(restaurantId) : Number.NaN;
  const restaurantContextId = Number.isNaN(restaurantIdNumber) ? null : restaurantIdNumber;

  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [placedOrder, setPlacedOrder] = useState<RoomOrderDetailResponse | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const lastMenuScrollYRef = useRef(0);
  const menuScrollFrameRef = useRef<number | null>(null);
  
  const [isRequestingService, setIsRequestingService] = useState(false);
  const [lastRequestedService, setLastRequestedService] = useState<string | null>(null);
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);

  const { cart, addItem, updateItem, removeItem, clearCart, placeOrder, placing } =
    useLocalRoomCart({
      restaurantId: restaurantContextId,
      roomId: null,
      roomNumber: roomNumber ?? null,
      qrAccessKey,
      menu,
    });

  const {
    activeCategoryId,
    setActiveCategoryId,
    selectNextCategory,
    selectPreviousCategory,
    visibleCategories,
    selectedCategory,
  } = usePublicMenuBrowser(menu);

  const menuSwipeHandlers = useSwipeNavigation<HTMLDivElement>({
    onSwipeLeft: selectNextCategory,
    onSwipeRight: selectPreviousCategory,
  });

  // 1. Preserve QR context locally. Cart mutations stay client-side until checkout.
  useEffect(() => {
    if (!restaurantId || !roomNumber) return;
    if (!qrAccessKey) {
      setPageError("Invalid room QR link. Please scan the room QR code again.");
      return;
    }
    setSessionReady(true);
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

  // 3. Scroll visibility logic
  useEffect(() => {
    const topRevealOffset = 40;
    const scrollDeltaThreshold = 15;

    lastMenuScrollYRef.current = window.scrollY;

    const updateHeaderVisibility = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastMenuScrollYRef.current;
      const scrollDelta = currentScrollY - lastScrollY;

      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      if (currentScrollY <= topRevealOffset) {
        setHeaderVisible(true);
        lastMenuScrollYRef.current = currentScrollY;
        menuScrollFrameRef.current = null;
        return;
      }

      // Prevent header jitter at the bottom
      if (currentScrollY + windowHeight >= documentHeight - 50) {
        menuScrollFrameRef.current = null;
        return;
      }

      if (Math.abs(scrollDelta) >= scrollDeltaThreshold) {
        setHeaderVisible(scrollDelta < 0);
        lastMenuScrollYRef.current = currentScrollY;
      }

      menuScrollFrameRef.current = null;
    };

    const handleWindowScroll = () => {
      if (menuScrollFrameRef.current !== null) return;
      menuScrollFrameRef.current = window.requestAnimationFrame(updateHeaderVisibility);
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
      if (menuScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(menuScrollFrameRef.current);
      }
    };
  }, []);

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

  const handleScrollTo = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleRequestService = useCallback(
    async (type: string, message?: string) => {
      if (!restaurantId || !roomNumber) return;
      setIsRequestingService(true);
      try {
        const path = type === "BILL" ? "/room-orders/request-bill" : "/room-orders/request-service";
        const payload = type === "BILL" ? {} : { service_type: type, message };

        const token = getRoomToken();
        await publicPost(path, payload, {
          headers: { "X-Room-Session": token || "" },
        });

        setLastRequestedService(type);
        setTimeout(() => {
          setServiceDrawerOpen(false);
          setLastRequestedService(null);
        }, 2000);
      } catch (err) {
        console.error("Failed to request service:", err);
      } finally {
        setIsRequestingService(false);
      }
    },
    [restaurantId, roomNumber],
  );

  // Render

  if (pageError) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <p className="text-red-600 text-center max-w-sm">{pageError}</p>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
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
        className={`box-border flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden rounded-xl border bg-white ${
          !item.is_available ? "opacity-60" : ""
        }`}
      >
        {item.image_path && (
          <img
            src={toAssetUrl(item.image_path)}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="block aspect-[4/3] w-full max-w-full object-cover"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-semibold leading-tight line-clamp-2">{item.name}</p>
            {metaLabel && (
              <span className="min-w-0 max-w-[45%] truncate text-right text-[11px] text-gray-400">
                {metaLabel}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 text-sm font-bold text-orange-600">
              ${item.price.toFixed(2)}
            </span>
            {item.is_available ? (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                Available
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Sold out
              </span>
            )}
          </div>

          {qtyInCart > 0 ? (
            <div className="box-border flex min-h-10 w-full max-w-full items-center justify-between rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1">
              <button
                onClick={() =>
                  qtyInCart > 1
                    ? updateItem(item.id, qtyInCart - 1)
                    : removeItem(item.id)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-gray-600 transition-colors hover:bg-white"
                aria-label="Decrease"
              >
                -
              </button>
              <span className="text-sm font-semibold w-6 text-center">{qtyInCart}</span>
              <button
                onClick={() => updateItem(item.id, qtyInCart + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white transition-colors hover:bg-orange-600"
                aria-label="Increase"
              >
                +
              </button>
            </div>
          ) : (
            <button
              disabled={isAdding || !sessionReady}
              onClick={() => handleAddToCart(item.id)}
              className="box-border flex min-h-10 w-full max-w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
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
    <div className="box-border flex min-h-dvh w-full max-w-full min-w-0 flex-col overflow-x-hidden bg-gray-50 pb-28">
      {/* Top bar */}
      <header id="menu-top" className={`fixed top-0 left-0 right-0 z-50 w-full border-b bg-white/95 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_4px_6px_-2px_rgba(0,0,0,0.05)] pt-[env(safe-area-inset-top,0px)] backdrop-blur-md transition-transform duration-500 ease-in-out ${
        headerVisible ? "translate-y-0" : "-translate-y-16"
      }`}>
        <div className="mx-auto box-border flex h-16 w-full max-w-[min(42rem,100%)] min-w-0 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            {menu.restaurant.logo_url && (
              <img
                src={toAssetUrl(menu.restaurant.logo_url) ?? undefined}
                alt={menu.restaurant.name}
                decoding="async"
                className="h-9 w-9 rounded-full object-cover"
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
                to={
                  qrAccessKey
                    ? `/menu/${restaurantId}/room/${roomNumber}/service-request?k=${encodeURIComponent(qrAccessKey)}`
                    : `/menu/${restaurantId}/room/${roomNumber}/service-request`
                }
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

        {/* Category rail */}
        <div className="mx-auto box-border flex h-16 w-full max-w-[min(42rem,100%)] min-w-0 items-center px-4 py-2">
          <div className="w-full">
            <MenuBrowserRail
              visibleCategories={visibleCategories}
              activeCategoryId={activeCategoryId}
              onSelectCategory={setActiveCategoryId}
            />
          </div>
        </div>
      </header>

      {/* Fixed-height Spacer: Prevents jittering by never changing its layout height */}
      <div className="h-[calc(4rem+3.5rem+env(safe-area-inset-top,0px))]" />

      {/* Item grid */}
      <main
        id="menu-list"
        className="mx-auto box-border w-full max-w-[min(42rem,100%)] min-w-0 flex-1 touch-pan-y space-y-6 overflow-x-hidden px-4 py-4"
        {...menuSwipeHandlers}
      >
        {renderedCategories.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No categories available.</p>
        ) : (
          renderedCategories.map((category) => (
            <section key={category.id} className="box-border w-full max-w-full min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{category.name}</h2>
              {category.description && (
                <p className="text-sm text-gray-500 mb-4">{category.description}</p>
              )}

              {category.items.length === 0 ? (
                <p className="text-center text-gray-400 py-10">No items in this category.</p>
              ) : (
                <div className="grid w-full max-w-full min-w-0 grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                  {category.items.map(renderItemCard)}
                </div>
              )}
              </section>
          ))
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 box-border w-full max-w-full overflow-hidden border-t border-white/70 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl min-[360px]:px-4">
        <div className="mx-auto grid w-full max-w-[min(42rem,100%)] min-w-0 grid-cols-5 items-end gap-1 min-[360px]:gap-2">
          <button
            type="button"
            onClick={() => setMenuDropdownOpen(true)}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition-all duration-300 min-[360px]:rounded-2xl min-[360px]:text-[11px] ${
              menuDropdownOpen 
              ? "bg-orange-500 text-white shadow-md scale-105" 
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <MenuIcon className="h-5 w-5" />
            <span className="max-w-full truncate">Menu</span>
          </button>

          <button
            type="button"
            onClick={() => handleScrollTo("menu-top")}
            className="flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 min-[360px]:rounded-2xl min-[360px]:text-[11px]"
          >
            <Search className="h-5 w-5" />
            <span className="max-w-full truncate">Search</span>
          </button>

          <FloatingCartButton 
            itemCount={cart?.item_count ?? 0} 
            onOpenCart={() => setCartOpen(true)} 
          />

          <button
            type="button"
            onClick={() => {
              if (!restaurantId || !roomNumber) return;
              const target = qrAccessKey
                ? `/menu/${restaurantId}/room/${roomNumber}/orders?k=${encodeURIComponent(qrAccessKey)}`
                : `/menu/${restaurantId}/room/${roomNumber}/orders`;
              navigate(target);
            }}
            className="flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 min-[360px]:rounded-2xl min-[360px]:text-[11px]"
          >
            <Bell className="h-5 w-5" />
            <span className="max-w-full truncate">Orders</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setServiceDrawerOpen(true);
            }}
            className="flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 min-[360px]:rounded-2xl min-[360px]:text-[11px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="max-w-full truncate">Request</span>
          </button>
        </div>
      </div>

      <PublicMenuDropdown
        menu={menu}
        activeCategoryId={activeCategoryId}
        onSelectCategory={(id) => {
          setActiveCategoryId(id);
          if (id === null) {
            handleScrollTo("menu-top");
          } else {
            handleScrollTo("menu-list");
          }
        }}
        isOpen={menuDropdownOpen}
        onClose={() => setMenuDropdownOpen(false)}
      />

      <QuickServiceDrawer
        isOpen={serviceDrawerOpen}
        onClose={() => {
          setServiceDrawerOpen(false);
          setLastRequestedService(null);
        }}
        onRequestService={handleRequestService}
        isSubmitting={isRequestingService}
        lastRequestedType={lastRequestedService}
      />

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
