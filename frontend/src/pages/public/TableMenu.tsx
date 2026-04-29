import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  UserRound,
  UtensilsCrossed,
  X,
} from "lucide-react";
import CartDrawer from "@/components/shared/CartDrawer";
import MenuBrowserRail from "@/components/public/MenuBrowserRail";
import { useSwipeNavigation } from "@/components/public/useSwipeNavigation";
import { usePublicMenuBrowser } from "@/components/public/usePublicMenuBrowser";
import { useCart } from "@/hooks/useCart";
import {
  clearGuestSession,
  getGuestDisplayName,
  getGuestQrAccessKey,
  hasGuestSessionForContext,
  setGuestQrAccessKey,
} from "@/hooks/useGuestSession";
import { fetchGuestSessionJson, restoreTableGuestSession } from "@/features/public/tableSession";
import { publicGet } from "@/lib/publicApi";
import { toAssetUrl } from "@/lib/assets";
import type {
  PublicItemSummaryResponse,
  PublicMenuResponse,
} from "@/types/publicMenu";

type MenuTile = {
  item: PublicItemSummaryResponse;
  categoryId: number;
  categoryName: string;
};

export default function TableMenu() {
  const [searchParams] = useSearchParams();
  const { restaurantId, tableNumber } = useParams<{
    restaurantId: string;
    tableNumber: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [guestNameInput, setGuestNameInput] = useState("");
  const [guestName, setGuestName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  const { cart, addItem, updateItem, removeItem, clearCart, placeOrder, refetch } =
    useCart();

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

  const flattenedTiles = useMemo<MenuTile[]>(() => {
    if (!menu) return [];

    const categorySource =
      activeCategoryId === null
        ? visibleCategories
        : visibleCategories.filter((category) => category.id === activeCategoryId);

    return categorySource.flatMap((category) => {
      return category.items.map((item) => ({
        item,
        categoryId: category.id,
        categoryName: category.name,
      }));
    });
  }, [activeCategoryId, menu, visibleCategories]);

  const featuredBannerUrls = useMemo(() => {
    const urls = menu?.restaurant.public_menu_banner_urls ?? [];
    return urls
      .map((url) => toAssetUrl(url) ?? "")
      .filter((url) => url.length > 0);
  }, [menu?.restaurant.public_menu_banner_urls]);

  useEffect(() => {
    setActiveBannerIndex(0);
  }, [featuredBannerUrls.length]);

  useEffect(() => {
    if (featuredBannerUrls.length <= 1) {
      return;
    }

    const timerId = window.setInterval(() => {
      setActiveBannerIndex((current) => (current + 1) % featuredBannerUrls.length);
    }, 60_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [featuredBannerUrls.length]);

  const visibleTiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return flattenedTiles;

    return flattenedTiles.filter(({ item, categoryName }) => {
      return [item.name, item.description ?? "", categoryName].some(
        (value) => value.toLowerCase().includes(query),
      );
    });
  }, [flattenedTiles, searchQuery]);

  useEffect(() => {
    if (!restaurantId || !tableNumber) return;
    const parsedRestaurantId = Number(restaurantId);
    if (Number.isNaN(parsedRestaurantId)) return;
    const existingName = getGuestDisplayName(parsedRestaurantId, tableNumber);
    if (existingName) {
      setGuestName(existingName);
      setGuestNameInput(existingName);
    }
  }, [restaurantId, tableNumber]);

  // 1. Start a guest session only after customer name is available.
  useEffect(() => {
    if (!restaurantId || !tableNumber || !guestName) return;
    const parsedRestaurantId = Number(restaurantId);
    if (Number.isNaN(parsedRestaurantId)) {
      setPageError("Invalid restaurant context. Please scan the table QR code again.");
      return;
    }

    if (qrAccessKey) {
      setGuestQrAccessKey(parsedRestaurantId, tableNumber, qrAccessKey);
    }

    const restoredQrAccessKey = getGuestQrAccessKey(parsedRestaurantId, tableNumber);
    const effectiveQrAccessKey = qrAccessKey || restoredQrAccessKey || "";

    const startFreshSession = async () => {
      const restored = await restoreTableGuestSession({
        restaurantId,
        tableNumber,
        qrAccessKey: effectiveQrAccessKey,
        guestName,
      });

      if (restored) {
        setSessionReady(true);
        return;
      }

      setPageError(
        effectiveQrAccessKey
          ? "Could not start a guest session. Please scan the QR code again."
          : "Invalid table QR link. Please scan the table QR code again.",
      );
    };

    const canReuseExistingSession = async (): Promise<boolean> => {
      try {
        await fetchGuestSessionJson("/cart");
        return true;
      } catch {
        return false;
      }
    };

    // Reuse an existing same-table guest session to keep cart/orders continuity.
    // Starting a new session would hide previous orders because guest endpoints are session-scoped.
    const init = async () => {
      if (hasGuestSessionForContext(parsedRestaurantId, tableNumber)) {
        const reusable = await canReuseExistingSession();
        if (reusable) {
          setSessionReady(true);
          return;
        }
      }

      await startFreshSession();
    };

    void init();
  }, [restaurantId, tableNumber, qrAccessKey, guestName]);

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

  const handlePlaceOrder = useCallback(async (): Promise<number> => {
    const result = await placeOrder({});
    const orderId = result.order.id;
    setCartOpen(false);
    const basePath = `/menu/${restaurantId}/table/${tableNumber}/order/${orderId}`;
    const nextPath = qrAccessKey ? `${basePath}?k=${encodeURIComponent(qrAccessKey)}` : basePath;
    navigate(nextPath);
    return orderId;
  }, [placeOrder, navigate, restaurantId, tableNumber, qrAccessKey]);

  const handleNameSubmit = useCallback(() => {
    const trimmed = guestNameInput.trim();
    if (!trimmed) {
      setNameError("Please enter your name to start ordering.");
      return;
    }
    setNameError(null);
    setGuestName(trimmed);
  }, [guestNameInput]);

  const handleScrollTo = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleFocusSearch = useCallback(() => {
    setSearchPanelOpen(true);
    searchInputRef.current?.focus();
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchPanelOpen(false);
    setSearchQuery("");
  }, []);

  const handleLogout = useCallback(() => {
    clearGuestSession();
    setProfileDrawerOpen(false);
    window.location.replace("/");
  }, []);

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

  if (!guestName) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.12),_transparent_34%),linear-gradient(180deg,#fff8f1_0%,#ffffff_28%,#f8fafc_100%)] px-4 py-6 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center">
          <div className="w-full overflow-hidden rounded-[2rem] border border-orange-100 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="bg-gradient-to-br from-orange-500 via-orange-500 to-amber-500 px-6 pb-8 pt-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
                Table Session
              </p>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-3xl font-black leading-tight tracking-tight">
                    {menu?.restaurant.name ?? "Welcome"}
                  </h1>
                  <p className="mt-2 text-sm text-white/85">
                    Enter your name once and continue to menu, cart, and order tracking.
                  </p>
                </div>
                {menu?.restaurant.logo_url ? (
                  <img
                    src={toAssetUrl(menu.restaurant.logo_url)}
                    alt={menu.restaurant.name}
                    className="h-14 w-14 shrink-0 rounded-2xl bg-white/15 object-cover ring-4 ring-white/20"
                  />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 ring-4 ring-white/20">
                    <Store className="h-6 w-6" />
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white/15 px-3 py-1.5">Table {tableNumber}</span>
                <span className="rounded-full bg-white/15 px-3 py-1.5">QR Menu</span>
                <span className="rounded-full bg-white/15 px-3 py-1.5">Fast ordering</span>
              </div>
            </div>

            <div className="px-6 py-6">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Your name
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
                placeholder="e.g. Kasun"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
              {nameError && <p className="mt-2 text-xs text-red-600">{nameError}</p>}

              <button
                type="button"
                onClick={handleNameSubmit}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Start session
                <ChevronRight className="h-4 w-4" />
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                By continuing, you will get a mobile menu, cart, and order tracking flow.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayTableNumber =
    tableNumber && /^\d+$/.test(tableNumber) ? tableNumber.padStart(2, "0") : tableNumber;

  const renderItemCard = ({ item, categoryName }: MenuTile) => {
    const cartItem = cart?.items.find((ci) => ci.item_id === item.id);
    const qtyInCart = cartItem?.quantity ?? 0;
    const isAdding = addingItemId === item.id;
    const imageUrl = toAssetUrl(item.image_path);
    const metaLabel = categoryName;

    return (
      <div
        key={item.id}
        className={`group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)] ${
          !item.is_available ? "opacity-55" : ""
        }`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="h-28 w-full object-cover transition duration-300 group-hover:scale-[1.03] sm:h-36"
          />
        ) : (
          <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 text-orange-300 sm:h-36">
            <UtensilsCrossed className="h-10 w-10" />
          </div>
        )}
          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-slate-900 leading-tight line-clamp-2">
                {item.name}
              </p>
              {metaLabel && (
                <span className="max-w-[40%] truncate text-right text-[11px] text-slate-400">
                  {metaLabel}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-orange-600">
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
                  className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-slate-600 transition hover:bg-white"
                  aria-label="Decrease"
                >
                  -
                </button>
                <span className="min-w-6 text-center text-sm font-semibold text-slate-900">
                  {qtyInCart}
                </span>
                <button
                  onClick={() => updateItem(item.id, qtyInCart + 1)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-xs font-bold text-white transition hover:bg-orange-600"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                disabled={isAdding || !sessionReady}
                onClick={() => handleAddToCart(item.id)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAdding ? "Adding..." : "Add to Cart"}
                {!isAdding && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
      </div>
    );
  };

  const cartItemCount = cart?.item_count ?? 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.08),_transparent_28%),linear-gradient(180deg,#fffaf5_0%,#f8fafc_38%,#f8fafc_100%)] text-slate-900">
      <header id="menu-top" className="sticky top-0 z-30 border-b border-white/60 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {menu.restaurant.logo_url ? (
              <img
                src={toAssetUrl(menu.restaurant.logo_url)}
                alt={menu.restaurant.name}
                className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
                <Store className="h-5 w-5" />
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-base font-black leading-tight text-slate-900">
                {menu.restaurant.name}
              </p>
              {(guestName || displayTableNumber) && (
                <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-500">
                  {guestName && <span className="min-w-0 truncate">{guestName}</span>}
                  {displayTableNumber && (
                    <span className="shrink-0 text-slate-400">Table {displayTableNumber}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {restaurantId && tableNumber && (
              <Link
                to={
                  qrAccessKey
                    ? `/orders/my/${restaurantId}/${tableNumber}?k=${encodeURIComponent(qrAccessKey)}`
                    : `/orders/my/${restaurantId}/${tableNumber}`
                }
                className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
              >
                <Bell className="h-4 w-4 text-orange-500" />
                Orders
              </Link>
            )}

            <button
              onClick={() => setCartOpen(true)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">
                  {cartItemCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setProfileDrawerOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 transition hover:bg-slate-200"
              aria-label="Open profile menu"
            >
              <UserRound className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className={`mx-auto max-w-6xl px-4 sm:px-5 lg:px-6 ${searchPanelOpen ? "pb-2" : "pb-0"}`}>
          <div
            className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ${
              searchPanelOpen ? "max-h-24 opacity-100" : "max-h-0 border-transparent opacity-0"
            }`}
          >
            <div className="p-3 sm:p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search dishes, ingredients, or category"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
                <button
                  type="button"
                  onClick={handleCloseSearch}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-5 lg:px-6">
          <MenuBrowserRail
            visibleCategories={visibleCategories}
            activeCategoryId={activeCategoryId}
            onSelectCategory={setActiveCategoryId}
          />
        </div>
      </header>

      <main
        id="menu-content"
        className="mx-auto flex w-full max-w-6xl touch-pan-y flex-1 flex-col gap-3 px-4 py-3 pb-28 sm:px-5 lg:px-6"
        {...menuSwipeHandlers}
      >
        <section>
          <div className="relative overflow-hidden rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] sm:px-5">
            {featuredBannerUrls.length > 0 && (
              <img
                src={featuredBannerUrls[activeBannerIndex]}
                alt="Featured menu banner"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-slate-950/65" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.24),_transparent_34%)]" />
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  <Sparkles className="h-3 w-3" />
                  Featured picks
                </p>
                <h2 className="mt-1 truncate text-base font-black leading-tight tracking-tight sm:text-lg">
                  Order faster from your table.
                </h2>
              </div>

              <span className="hidden shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/75 sm:inline-flex">
                Fast add
              </span>
            </div>
          </div>
        </section>

        <section id="menu-list" className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900">
                {searchQuery ? "Search results" : selectedCategory?.name ?? "All items"}
              </h2>
              {selectedCategory?.description && !searchQuery && (
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                  {selectedCategory.description}
                </p>
              )}
            </div>

            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>

          {visibleTiles.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
              No items match the current filter.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTiles.map(renderItemCard)}
            </div>
          )}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl grid-cols-5 items-end gap-2">
          <button
            type="button"
            onClick={() => handleScrollTo("menu-list")}
            className="flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Menu className="h-5 w-5" />
            Menu
          </button>

          <button
            type="button"
            onClick={handleFocusSearch}
            className="flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Search className="h-5 w-5" />
            Search
          </button>

          <button
            type="button"
            onClick={() => handleScrollTo("menu-top")}
            className="-mt-7 mx-auto grid h-16 w-16 place-items-center rounded-full bg-orange-500 text-white shadow-[0_20px_40px_rgba(249,115,22,0.35)] transition hover:bg-orange-600"
            aria-label="Go to home"
          >
            <Home className="h-7 w-7" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!restaurantId || !tableNumber) return;
              const target = qrAccessKey
                ? `/orders/my/${restaurantId}/${tableNumber}?k=${encodeURIComponent(qrAccessKey)}`
                : `/orders/my/${restaurantId}/${tableNumber}`;
              navigate(target);
            }}
            className="flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Bell className="h-5 w-5" />
            Orders
          </button>

          <button
            type="button"
            onClick={() => setProfileDrawerOpen(true)}
            className="flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <MessageCircle className="h-5 w-5" />
            Chat
          </button>
        </div>
      </div>

      {/* Cart drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
        onClearCart={clearCart}
        onPlaceOrder={handlePlaceOrder}
      />

      {/* Profile drawer */}
      {profileDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity animate-in fade-in-0 duration-300"
            onClick={() => setProfileDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="absolute bottom-0 right-0 top-0 flex w-full max-w-sm flex-col bg-white shadow-2xl transition-all duration-300 animate-in slide-in-from-right-40">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Profile</h2>
              <button
                onClick={() => setProfileDrawerOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close profile menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Guest Info Section */}
              <div className="border-b border-slate-200 px-6 py-6">
                <div className="mb-4 flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-2xl font-bold text-white">
                    {guestName?.charAt(0).toUpperCase() ?? "G"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Guest Name</p>
                    <p className="text-lg font-bold text-slate-900">{guestName ?? "Guest"}</p>
                  </div>
                </div>

                {tableNumber && restaurantId && (
                  <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
                    <p className="text-slate-600">
                      <span className="font-semibold text-slate-900">Table:</span> {tableNumber}
                    </p>
                    <p className="text-slate-600">
                      <span className="font-semibold text-slate-900">Restaurant:</span> {menu?.restaurant.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Menu Items */}
              <div className="py-4">
                {restaurantId && tableNumber && (
                  <Link
                    to={
                      qrAccessKey
                        ? `/orders/my/${restaurantId}/${tableNumber}?k=${encodeURIComponent(qrAccessKey)}`
                        : `/orders/my/${restaurantId}/${tableNumber}`
                    }
                    onClick={() => setProfileDrawerOpen(false)}
                    className="flex items-center justify-between px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    <span>My Orders</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                )}

                <button
                  className="w-full px-6 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  onClick={() => setProfileDrawerOpen(false)}
                  disabled
                >
                  <div className="flex items-center justify-between">
                    <span>My Profile</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>

                <button
                  className="w-full px-6 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  onClick={() => setProfileDrawerOpen(false)}
                  disabled
                >
                  <div className="flex items-center justify-between">
                    <span>Payment Methods</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>

                <button
                  className="w-full px-6 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  onClick={() => setProfileDrawerOpen(false)}
                  disabled
                >
                  <div className="flex items-center justify-between">
                    <span>Contact Us</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>

                <button
                  className="w-full px-6 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  onClick={() => setProfileDrawerOpen(false)}
                  disabled
                >
                  <div className="flex items-center justify-between">
                    <span>Settings</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>

                <button
                  className="w-full px-6 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  onClick={() => setProfileDrawerOpen(false)}
                  disabled
                >
                  <div className="flex items-center justify-between">
                    <span>Help & FAQs</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>
              </div>
            </div>

            {/* Footer - Logout Button */}
            <div className="border-t border-slate-200 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100"
              >
                <LogOut className="h-4 w-4" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
