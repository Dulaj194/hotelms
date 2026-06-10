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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, ChefHat, Plus, Minus, Menu as MenuIcon, Search, ShoppingCart } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicMenuDropdown from "@/components/public/PublicMenuDropdown";
import MenuBrowserRail from "@/components/public/MenuBrowserRail";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translateError } from "@/lib/errorHelper";
import { usePublicMenuBrowser } from "@/components/public/usePublicMenuBrowser";
import { useSwipeNavigation } from "@/components/public/useSwipeNavigation";
import { useLocalRoomCart } from "@/hooks/useLocalMenuCart";
import { toAssetUrl } from "@/lib/assets";
import { publicGet, publicPost } from "@/lib/publicApi";
import SafeMenuAsset from "@/components/public/SafeMenuAsset";
import ItemDetailSheet from "@/components/public/ItemDetailSheet";
import QuickServiceDrawer, { type QuickServiceItem } from "@/components/public/QuickServiceDrawer";
import { getRoomToken, getRoomGuestDisplayName, setRoomGuestDisplayName } from "@/hooks/useRoomSession";
import type { PublicItemSummaryResponse, PublicMenuResponse } from "@/types/publicMenu";

// ─── Local Components ──────────────────────────────────────────────────────────

function FloatingCartButton({ itemCount, onOpenCart }: { itemCount: number; onOpenCart: () => void }) {
  const { t } = useTranslation("cart");
  return (
    <button
      type="button"
      onClick={onOpenCart}
      className="relative -mt-6 mx-auto grid h-14 w-14 place-items-center rounded-full bg-orange-500 text-white shadow-[0_20px_40px_rgba(249,115,22,0.35)] transition hover:bg-orange-600 min-[360px]:-mt-7 min-[360px]:h-16 min-[360px]:w-16"
      aria-label={itemCount > 0 ? t("open_cart_items", { count: itemCount }) : t("open_cart")}
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

// Main page component

export default function RoomMenu() {
  const { t, i18n } = useTranslation(["common", "menu", "cart"]);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  useEffect(() => {
    const handleLangChange = (lng: string) => {
      setCurrentLanguage(lng);
    };
    i18n.on("languageChanged", handleLangChange);
    return () => {
      i18n.off("languageChanged", handleLangChange);
    };
  }, [i18n]);

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
  const [guestNameInput, setGuestNameInput] = useState("");
  const [guestName, setGuestName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [recentlyAddedItemId, setRecentlyAddedItemId] = useState<number | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const lastMenuScrollYRef = useRef(0);
  const [activeOfferIndex, setActiveOfferIndex] = useState(0);

  
  const [isRequestingService, setIsRequestingService] = useState(false);
  const [lastRequestedServiceId, setLastRequestedServiceId] = useState<number | null>(null);
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PublicItemSummaryResponse | null>(null);
  const [quickServices, setQuickServices] = useState<QuickServiceItem[]>([]);

  const { cart, addItem, updateItem, removeItem } =
    useLocalRoomCart({
      restaurantId: restaurantContextId,
      roomId: null,
      roomNumber: roomNumber ?? null,
      qrAccessKey,
      menu,
      customerName: guestName,
    });

  const {
    activeCategoryId,
    setActiveCategoryId,
    selectNextCategory,
    selectPreviousCategory,
    visibleCategories,
  } = usePublicMenuBrowser(menu);

  const navigationItems = useMemo(() => [null, ...visibleCategories], [visibleCategories]);

  const menuSwipeHandlers = useSwipeNavigation<HTMLDivElement>({
    onSwipeLeft: selectNextCategory,
    onSwipeRight: selectPreviousCategory,
  });

  useEffect(() => {
    if (!restaurantId || !roomNumber) return;
    const parsedRestaurantId = Number(restaurantId);
    if (Number.isNaN(parsedRestaurantId)) return;
    const existingName = getRoomGuestDisplayName(parsedRestaurantId, roomNumber);
    if (existingName) {
      setGuestName(existingName);
      setGuestNameInput(existingName);
    }
  }, [restaurantId, roomNumber]);

  // 1. Preserve QR context locally. Cart mutations stay client-side until checkout.
  useEffect(() => {
    if (!restaurantId || !roomNumber || !guestName) return;
    if (!qrAccessKey) {
      setPageError(t("menu:invalid_qr"));
      return;
    }
    setSessionReady(true);
  }, [restaurantId, roomNumber, qrAccessKey, guestName]);

  const handleNameSubmit = useCallback(() => {
    const trimmed = guestNameInput.trim();
    if (!trimmed) {
      setNameError(translateError(t("menu:name_error")));
      if (window.navigator.vibrate) window.navigator.vibrate([30, 100, 30]);
      return;
    }
    setNameError(null);
    setGuestName(trimmed);

    if (window.navigator.vibrate) window.navigator.vibrate(20);

    if (restaurantContextId && roomNumber) {
      setRoomGuestDisplayName(restaurantContextId, roomNumber, trimmed);
    }
  }, [guestNameInput, restaurantContextId, roomNumber, t]);

  // 2. Fetch public menu
  useEffect(() => {
    if (!restaurantId) return;

    const fetchMenu = async () => {
      try {
        const data = await publicGet<PublicMenuResponse>(
          `/public/restaurants/${restaurantId}/menu`
        );
        setMenu(data);
      } catch (error: any) {
        setPageError(translateError(error.message || t("menu:load_error")));
      }
    };

    void fetchMenu();
  }, [restaurantId, currentLanguage]);

  // 2.1 Fetch quick services
  useEffect(() => {
    if (!restaurantId) return;

    const fetchQuickServices = async () => {
      try {
        const data = await publicGet<QuickServiceItem[]>(
          `/public/quick-services/${restaurantId}`
        );
        setQuickServices(data);
      } catch (err) {
        console.error("Failed to load quick services:", err);
      }
    };

    void fetchQuickServices();
  }, [restaurantId, currentLanguage]);

  // 3. Scroll visibility logic
  const handleContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    const lastScrollTop = lastMenuScrollYRef.current;
    const delta = currentScrollTop - lastScrollTop;

    if (currentScrollTop <= 40) {
      setHeaderVisible(true);
      lastMenuScrollYRef.current = currentScrollTop;
      return;
    }

    if (Math.abs(delta) >= 20) {
      setHeaderVisible(delta < 0);
      lastMenuScrollYRef.current = currentScrollTop;
    }
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
  
  const handleAddToCartWithQty = useCallback(
    async (itemId: number, quantity: number, note?: string) => {
      setAddingItemId(itemId);
      try {
        await addItem(itemId, quantity, note);
        setRecentlyAddedItemId(itemId);
        if (window.navigator.vibrate) window.navigator.vibrate([10, 30, 10]);
        setTimeout(() => setRecentlyAddedItemId(null), 1500);
      } finally {
        setAddingItemId(null);
      }
    },
    [addItem]
  );

  const handleOpenCart = useCallback(() => {
    if (!restaurantId || !roomNumber) return;
    const basePath = `/menu/${restaurantId}/room/${roomNumber}/cart`;
    navigate(qrAccessKey ? `${basePath}?k=${encodeURIComponent(qrAccessKey)}` : basePath);
  }, [navigate, qrAccessKey, restaurantId, roomNumber]);

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

        // Find the service ID if available to show success state
        const service = quickServices.find(s => s.label === type);
        if (service) setLastRequestedServiceId(service.id);
        
        setTimeout(() => {
          setServiceDrawerOpen(false);
          setLastRequestedServiceId(null);
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
        <p className="text-gray-400 animate-pulse">{t("menu:loading_menu")}</p>
      </div>
    );
  }

  if (!guestName) {
    return (
      <div className="box-border min-h-dvh w-full overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.15),_transparent_45%),linear-gradient(180deg,#fffaf5_0%,#ffffff_35%,#f8fafc_100%)] px-4 py-6 text-slate-900 pb-[env(safe-area-inset-bottom,24px)] pt-[env(safe-area-inset-top,24px)]">
        <div className="mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-md items-center justify-center">
          <div className="w-full overflow-hidden rounded-[2.5rem] border border-orange-100 bg-white shadow-[0_32px_64px_-16px_rgba(15,23,42,0.15)] backdrop-blur-xl">
            <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 px-6 pb-10 pt-8 text-white">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
                    {t("menu:room_session", "Room Session")}
                  </p>
                  <h1 className="mt-3 text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl">
                    {menu?.restaurant.name ?? "Luminous Hotel"}
                  </h1>
                </div>
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md ring-1 ring-white/30 animate-bounce [animation-duration:3s]">
                  <ChefHat className="h-7 w-7 text-white" />
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-black/10 px-3.5 py-1.5 text-[11px] font-bold backdrop-blur-md ring-1 ring-white/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {t("menu:room")} {roomNumber}
                </div>
                <span className="rounded-full bg-black/10 px-3.5 py-1.5 text-[11px] font-bold backdrop-blur-md ring-1 ring-white/20">
                  {t("menu:qr_verified")}
                </span>
                <span className="rounded-full bg-emerald-500/20 px-3.5 py-1.5 text-[11px] font-bold text-emerald-100 backdrop-blur-md ring-1 ring-emerald-500/30">
                  {t("menu:fast_ordering")}
                </span>
              </div>
            </div>

            <div className="px-7 py-8">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  {t("menu:your_name")}
                </label>
                <input
                  value={guestNameInput}
                  onChange={(event) => setGuestNameInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleNameSubmit();
                    }
                  }}
                  placeholder={t("menu:name_placeholder")}
                  className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-5 py-4 text-base font-medium outline-none transition-all placeholder:text-slate-300 focus:border-orange-500/30 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                />
                {nameError && (
                  <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-red-500">
                    <span className="h-1 w-1 rounded-full bg-red-500" />
                    {nameError}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleNameSubmit}
                className="mt-8 group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-900 py-4 text-base font-bold text-white transition-all active:scale-[0.98] hover:bg-slate-800"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {t("menu:start_session")}
                </span>
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-orange-500 to-amber-500 opacity-0 transition-opacity group-hover:opacity-10" />
              </button>

              <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-center">
                <p className="text-[11px] leading-relaxed font-medium text-slate-500">
                  {t("menu:name_hint")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }



  const renderItemCard = (item: PublicItemSummaryResponse) => {
    const cartItem = cart?.items.find((ci) => ci.item_id === item.id);
    const qtyInCart = cartItem?.quantity ?? 0;
    const isAdding = addingItemId === item.id;
    const activeOffer = menu?.offers?.find(o => o.product_type === "item" && o.product_id === item.id);
    const displayName = item.name;
    const displayDesc = item.description || "";

    return (
      <div
        key={item.id}
        onClick={() => setSelectedItem(item)}
        className={`box-border flex h-full w-full max-w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md ${
          !item.is_available ? "opacity-60" : ""
        } ${activeOffer ? "ring-2 ring-orange-500/30 border-orange-200" : ""}`}
      >
        <div className="relative aspect-[16/9] sm:aspect-[4/3] w-full overflow-hidden bg-slate-50">
          <SafeMenuAsset
            path={item.image_path}
            alt={displayName}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            fallback={
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <ChefHat className="h-8 w-8" />
              </div>
            }
          />
          {activeOffer && (
            <div className="absolute top-2 left-2 z-10">
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm">
                <span className="h-1 w-1 rounded-full bg-amber-300 animate-pulse" />
                {t("menu:offer")}
              </span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-semibold leading-tight line-clamp-2">{displayName}</p>
            {displayDesc && (
              <span className="min-w-0 max-w-[45%] truncate text-right text-[11px] text-gray-400">
                {displayDesc}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col leading-none">
              {activeOffer ? (
                <>
                  <span className="text-[11px] font-bold text-slate-400 line-through mb-0.5">
                    ${(item.price * 1.25).toFixed(2)}
                  </span>
                  <span className="min-w-0 text-sm font-bold text-orange-600">
                    ${item.price.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="min-w-0 text-sm font-bold text-orange-600">
                  ${item.price.toFixed(2)}
                </span>
              )}
            </div>
            {item.is_available ? (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                {t("menu:available")}
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {t("menu:sold_out")}
              </span>
            )}
          </div>

          <div className="mt-auto pt-2">
            {qtyInCart > 0 ? (
              <div className="box-border flex h-10 w-[120px] ml-auto items-center justify-between rounded-full border border-slate-200 bg-slate-50 p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    qtyInCart > 1
                      ? updateItem(item.id, qtyInCart - 1)
                      : removeItem(item.id);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-600 shadow-sm transition hover:bg-red-50 hover:text-red-500 active:scale-95"
                  aria-label="Decrease"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[20px] text-center text-sm font-bold text-slate-800">
                  {qtyInCart}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateItem(item.id, qtyInCart + 1);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-white shadow-sm transition hover:bg-orange-600 hover:shadow-md active:scale-95"
                  aria-label="Increase"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                disabled={isAdding || !sessionReady}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart(item.id);
                }}
                className={`box-border flex h-10 w-full items-center justify-center gap-2 rounded-full border text-xs font-semibold transition-all duration-300 active:scale-[0.98] disabled:opacity-50 ${
                  recentlyAddedItemId === item.id
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                    : "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:border-orange-300"
                }`}
              >
                {isAdding ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                ) : recentlyAddedItemId === item.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 animate-in zoom-in-50" />
                    <span>Added!</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>{t("menu:add_to_cart")}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-gray-50">
      {/* Top bar */}
      <header
        id="menu-top"
        className={`absolute left-0 right-0 top-0 z-50 border-b bg-white/95 shadow-sm backdrop-blur-md transition-transform duration-500 ease-in-out ${
          headerVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="h-[env(safe-area-inset-top,0px)]" />
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
                <p className="text-xs text-gray-500">{t("menu:room")} {roomNumber}</p>
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
            <LanguageSwitcher />
          <button
            onClick={handleOpenCart}
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

      </header>



      {/* Item grid */}
      <main
        id="menu-list"
        onScroll={handleContentScroll}
        className="flex-1 overflow-y-auto px-4 py-4 pb-40 no-scrollbar vertical-scroll"
        {...menuSwipeHandlers}
      >
        {/* Fixed Spacer for the Absolute Header */}
        <div className="h-[calc(4rem+env(safe-area-inset-top,0px))] shrink-0" />

        {/* Sticky Category Bar */}
        <div className="sticky -mx-4 -mt-4 top-0 z-40 mb-6 w-[calc(100%+2rem)] border-b bg-white/95 backdrop-blur-md px-4">
          <div className="mx-auto flex h-16 w-full max-w-[min(42rem,100%)] items-center">
            <MenuBrowserRail
              visibleCategories={visibleCategories}
              activeCategoryId={activeCategoryId}
              onSelectCategory={setActiveCategoryId}
            />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[min(42rem,100%)] space-y-8">
          {/* Featured Picks Section */}
          {activeCategoryId === null && menu.offers && menu.offers.length > 0 && (() => {
            const displayedOffers = menu.offers.some(o => o.is_featured) ? menu.offers.filter(o => o.is_featured) : menu.offers;
            if (displayedOffers.length === 0) return null;

            return (
              <section className="space-y-4 overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-orange-600">
                      <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                      {t("menu:featured_picks")}
                    </div>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                      {t("menu:handcrafted_specials")}
                    </h2>
                  </div>
                </div>
                <div 
                  onScroll={(e) => {
                    const container = e.currentTarget;
                    const scrollLeft = container.scrollLeft;
                    const width = container.clientWidth;
                    const children = container.children;
                    let closestIndex = 0;
                    let minDistance = Infinity;
                    const containerCenter = scrollLeft + width / 2;

                    for (let i = 0; i < children.length; i++) {
                      const child = children[i] as HTMLElement;
                      const childCenter = child.offsetLeft + child.clientWidth / 2;
                      const distance = Math.abs(containerCenter - childCenter);
                      if (distance < minDistance) {
                        minDistance = distance;
                        closestIndex = i;
                      }
                    }
                    setActiveOfferIndex(closestIndex);
                  }}
                  className="flex gap-4 overflow-x-auto pb-2 pt-1 px-1 -mx-1 no-scrollbar snap-x snap-mandatory scroll-smooth"
                >
                  {displayedOffers.map((offer) => (
                    <div
                      key={offer.id}
                      onClick={() => {
                        if (offer.product_type === "item") {
                          const item = visibleCategories.flatMap(c => c.items).find(i => i.id === offer.product_id);
                          if (item) setSelectedItem(item);
                        } else if (offer.product_type === "category") {
                          setActiveCategoryId(offer.product_id);
                        }
                      }}
                      className="shrink-0 w-[85%] sm:w-[65%] snap-center cursor-pointer transition-transform duration-300 active:scale-[0.98]"
                    >
                      <div className="flex h-44 sm:h-48 w-full overflow-hidden rounded-[24px] bg-[#EBE7E0] shadow-sm hover:shadow-md transition-shadow border border-slate-200/60 text-slate-900">
                        {/* Left Info Area */}
                        <div className="flex flex-1 flex-col justify-between p-4 sm:p-5 min-w-0">
                          <div className="min-w-0">
                            <span className="inline-flex w-fit items-center gap-1 rounded bg-slate-900/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-700">
                              {t("menu:offer")}
                            </span>
                            <h3 className="mt-2 text-base sm:text-lg font-black leading-tight text-slate-900 line-clamp-2">
                              {offer.title}
                            </h3>
                            <p className="mt-1 text-xs font-medium text-slate-600 line-clamp-2">
                              {offer.description}
                            </p>
                          </div>
                          <div className="pt-2">
                            <button className="rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800">
                              {offer.product_type === "item" ? t("menu:order_now") : t("menu:explore")}
                            </button>
                          </div>
                        </div>
                        {/* Right Image Area */}
                        {offer.image_path && (
                          <div className="relative w-[45%] shrink-0 h-full overflow-hidden bg-slate-100">
                            <SafeMenuAsset
                              path={offer.image_path}
                              alt={offer.title}
                              className="h-full w-full object-cover"
                              fallback={<div className="flex h-full w-full items-center justify-center text-slate-400"><ChefHat className="h-6 w-6" /></div>}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Active Scroll Dot Indicators */}
                {displayedOffers.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-2">
                    {displayedOffers.map((_, index) => (
                      <span
                        key={index}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          index === activeOfferIndex
                            ? "w-6 bg-orange-600"
                            : "w-1.5 bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })()}

          {navigationItems.map((navItem: any) => {
            const catId = navItem?.id ?? null;

            // Only show the active category, or all if "All" is selected
            if (activeCategoryId !== null && catId !== activeCategoryId) return null;

            const category = visibleCategories.find((c) => c.id === catId);
            const items = catId === null 
              ? visibleCategories.flatMap(c => c.items) 
              : category?.items ?? [];

            if (items.length === 0 && catId !== null) return null;

            return (
              <div key={catId ?? "all"} className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {catId === null ? t("menu:all_items") : navItem?.name}
                </h2>
                
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-12 text-center">
                    <ChefHat className="mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-400">{t("menu:no_items_found")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3">
                    {items.map(renderItemCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <nav className="shrink-0 border-t border-slate-200/60 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl min-[360px]:px-4">
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
            <span className="max-w-full truncate">{t("menu:title")}</span>
          </button>

          <button
            type="button"
            onClick={() => handleScrollTo("menu-top")}
            className="flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 min-[360px]:rounded-2xl min-[360px]:text-[11px]"
          >
            <Search className="h-5 w-5" />
            <span className="max-w-full truncate">{t("common:search")}</span>
          </button>

          <FloatingCartButton 
            itemCount={cart?.item_count ?? 0} 
            onOpenCart={handleOpenCart} 
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
            <span className="max-w-full truncate">{t("menu:orders")}</span>
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
            <span className="max-w-full truncate">{t("common:request")}</span>
          </button>
        </div>
      </nav>

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
        onClose={() => setServiceDrawerOpen(false)}
        onRequestService={handleRequestService}
        isSubmitting={isRequestingService}
        lastRequestedId={lastRequestedServiceId}
        services={quickServices}
      />

      <ItemDetailSheet
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleAddToCartWithQty}
        qtyInCart={cart?.items.find((i) => i.item_id === selectedItem?.id)?.quantity ?? 0}
        formatPrice={(p) => `$${p.toFixed(2)}`}
      />

    </div>
  );
}
