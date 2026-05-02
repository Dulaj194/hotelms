import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  UserRound,
  UtensilsCrossed,
  X,
} from "lucide-react";
import PublicMenuDropdown from "@/components/public/PublicMenuDropdown";
import MenuBrowserRail from "@/components/public/MenuBrowserRail";
import SafeMenuAsset from "@/components/public/SafeMenuAsset";
import { useSwipeNavigation } from "@/components/public/useSwipeNavigation";
import { usePublicMenuBrowser } from "@/components/public/usePublicMenuBrowser";
import {
  clearGuestSession,
  getGuestDisplayName,
  setGuestDisplayName,
  getGuestQrAccessKey,
  setGuestQrAccessKey,
} from "@/hooks/useGuestSession";
import { useLocalTableCart } from "@/hooks/useLocalMenuCart";
import { publicGet } from "@/lib/publicApi";
import type {
  PublicItemSummaryResponse,
  PublicMenuResponse,
} from "@/types/publicMenu";

type MenuTile = {
  item: PublicItemSummaryResponse;
  categoryId: number;
  categoryName: string;
};

type FloatingCartButtonProps = {
  itemCount: number;
  onOpenCart: () => void;
};

function FloatingCartButton({ itemCount, onOpenCart }: FloatingCartButtonProps) {
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

export default function TableMenu() {
  const [searchParams] = useSearchParams();
  const { restaurantId, tableNumber } = useParams<{
    restaurantId: string;
    tableNumber: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";
  const restaurantIdNumber = restaurantId ? Number(restaurantId) : Number.NaN;
  const restaurantContextId = Number.isNaN(restaurantIdNumber) ? null : restaurantIdNumber;
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [guestNameInput, setGuestNameInput] = useState("");
  const [guestName, setGuestName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [categoryRailAutoHideEnabled, setCategoryRailAutoHideEnabled] = useState(false);
  const categoryRailShellRef = useRef<HTMLDivElement>(null);
  const lastMenuScrollYRef = useRef(0);
  const menuScrollFrameRef = useRef<number | null>(null);

  const { cart, addItem, updateItem, removeItem } = useLocalTableCart({
    restaurantId: restaurantContextId,
    tableNumber: tableNumber ?? null,
    qrAccessKey: qrAccessKey || (
      restaurantContextId && tableNumber
        ? getGuestQrAccessKey(restaurantContextId, tableNumber) ?? ""
        : ""
    ),
    menu,
    customerName: guestName,
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

  const featuredBannerPaths = useMemo(() => {
    const urls = menu?.restaurant.public_menu_banner_urls ?? [];
    return urls.filter((url) => url.trim().length > 0);
  }, [menu?.restaurant.public_menu_banner_urls]);

  useEffect(() => {
    setActiveBannerIndex(0);
  }, [featuredBannerPaths.length]);

  useEffect(() => {
    const topRevealOffset = 40;
    const scrollDeltaThreshold = 15; // Increased for better stability

    lastMenuScrollYRef.current = window.scrollY;

    if (!categoryRailAutoHideEnabled) {
      setHeaderVisible(true);
      return;
    }

    const updateHeaderVisibility = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastMenuScrollYRef.current;
      const scrollDelta = currentScrollY - lastScrollY;

      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Senior Engineer Approach: Prevent jittering when reaching the top or bottom
      if (currentScrollY <= topRevealOffset) {
        setHeaderVisible(true);
        lastMenuScrollYRef.current = currentScrollY;
        menuScrollFrameRef.current = null;
        return;
      }

      // Prevent header flip-flopping at the very bottom of the page
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
  }, [categoryRailAutoHideEnabled]);

  useEffect(() => {
    if (featuredBannerPaths.length <= 1) {
      return;
    }

    const timerId = window.setInterval(() => {
      setActiveBannerIndex((current) => (current + 1) % featuredBannerPaths.length);
    }, 60_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [featuredBannerPaths.length]);

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
    const scrollableContentBuffer = 24;
    let frameId: number | null = null;

    const updateCategoryRailMode = () => {
      const menuContent = document.getElementById("menu-content");
      const header = document.getElementById("menu-top");
      const railHeight = categoryRailShellRef.current?.offsetHeight ?? 0;
      const headerHeightWithoutRail = Math.max(0, (header?.offsetHeight ?? 0) - railHeight);
      const menuContentHeight = menuContent?.scrollHeight ?? document.documentElement.scrollHeight;
      const menuContentStyle = menuContent ? window.getComputedStyle(menuContent) : null;
      const menuBottomPadding = menuContentStyle
        ? Number.parseFloat(menuContentStyle.paddingBottom || "0")
        : 0;
      const usableContentHeight =
        headerHeightWithoutRail + Math.max(0, menuContentHeight - menuBottomPadding);
      const canAutoHide = usableContentHeight > window.innerHeight + scrollableContentBuffer;

      setCategoryRailAutoHideEnabled(canAutoHide);
      if (!canAutoHide) {
        setHeaderVisible(true);
      }

      frameId = null;
    };

    const scheduleCategoryRailModeUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateCategoryRailMode);
    };

    scheduleCategoryRailModeUpdate();
    window.addEventListener("resize", scheduleCategoryRailModeUpdate);
    window.addEventListener("orientationchange", scheduleCategoryRailModeUpdate);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleCategoryRailModeUpdate)
        : null;

    const menuContent = document.getElementById("menu-content");
    if (resizeObserver) {
      resizeObserver.observe(document.body);
      if (menuContent) {
        resizeObserver.observe(menuContent);
      }
    }

    return () => {
      window.removeEventListener("resize", scheduleCategoryRailModeUpdate);
      window.removeEventListener("orientationchange", scheduleCategoryRailModeUpdate);
      resizeObserver?.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    activeCategoryId,
    featuredBannerPaths.length,
    searchPanelOpen,
    searchQuery,
    visibleCategories.length,
    visibleTiles.length,
  ]);

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

  // 1. Preserve QR context locally. Cart mutations stay client-side until checkout.
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

    if (!qrAccessKey && !getGuestQrAccessKey(parsedRestaurantId, tableNumber)) {
      setPageError("Invalid table QR link. Please scan the table QR code again.");
      return;
    }

    setSessionReady(true);
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

  const handleOpenCart = useCallback(() => {
    if (!restaurantId || !tableNumber) return;
    const basePath = `/menu/${restaurantId}/table/${tableNumber}/cart`;
    navigate(qrAccessKey ? `${basePath}?k=${encodeURIComponent(qrAccessKey)}` : basePath);
  }, [navigate, qrAccessKey, restaurantId, tableNumber]);

  const handleNameSubmit = useCallback(() => {
    const trimmed = guestNameInput.trim();
    if (!trimmed) {
      setNameError("Please enter your name to start ordering.");
      return;
    }
    setNameError(null);
    setGuestName(trimmed);

    // Senior Engineer Approach: Persist name so it's not lost on refresh
    if (restaurantContextId && tableNumber) {
      setGuestDisplayName(restaurantContextId, tableNumber, trimmed);
    }
  }, [guestNameInput, restaurantContextId, tableNumber]);

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

  const handleContactStaff = useCallback(() => {
    const phoneNumber = menu?.restaurant.phone?.trim();
    const callablePhone = phoneNumber?.replace(/[^\d+]/g, "");
    if (callablePhone) {
      window.location.href = `tel:${callablePhone}`;
      return;
    }

    setProfileDrawerOpen(true);
  }, [menu?.restaurant.phone]);

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

  if (!guestName) {
    return (
      <div className="box-border min-h-dvh w-full overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.15),_transparent_45%),linear-gradient(180deg,#fffaf5_0%,#ffffff_35%,#f8fafc_100%)] px-4 py-6 text-slate-900 pb-[env(safe-area-inset-bottom,24px)] pt-[env(safe-area-inset-top,24px)]">
        <div className="mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-md items-center justify-center">
          <div className="w-full overflow-hidden rounded-[2.5rem] border border-orange-100 bg-white shadow-[0_32px_64px_-16px_rgba(15,23,42,0.15)] backdrop-blur-xl">
            <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 px-6 pb-10 pt-8 text-white">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
                    Table Session
                  </p>
                  <h1 className="mt-3 text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl">
                    {menu?.restaurant.name ?? "Luminous Hotel"}
                  </h1>
                </div>
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md ring-1 ring-white/30">
                  <Store className="h-7 w-7 text-white" />
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                <span className="rounded-full bg-black/10 px-3.5 py-1.5 text-[11px] font-bold backdrop-blur-md ring-1 ring-white/20">
                  Table {tableNumber}
                </span>
                <span className="rounded-full bg-black/10 px-3.5 py-1.5 text-[11px] font-bold backdrop-blur-md ring-1 ring-white/20">
                  QR Menu
                </span>
                <span className="rounded-full bg-emerald-500/20 px-3.5 py-1.5 text-[11px] font-bold text-emerald-100 backdrop-blur-md ring-1 ring-emerald-500/30">
                  Fast ordering
                </span>
              </div>
            </div>

            <div className="px-7 py-8">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
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
                  Start session
                  <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-orange-500 to-amber-500 opacity-0 transition-opacity group-hover:opacity-10" />
              </button>

              <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-center">
                <p className="text-[11px] leading-relaxed font-medium text-slate-500">
                  Enter your name once to start your digital ordering experience. 
                  Your cart and orders will be tracked for this session.
                </p>
              </div>
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
    const metaLabel = categoryName;

    return (
      <div
        key={item.id}
        className={`group box-border flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)] ${
          !item.is_available ? "opacity-55" : ""
        }`}
      >
        <SafeMenuAsset
          path={item.image_path}
          alt={item.name}
          className="block aspect-[4/3] w-full max-w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          fallbackClassName="flex aspect-[4/3] w-full max-w-full shrink-0 items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 text-orange-300"
          fallback={
            <UtensilsCrossed className="h-9 w-9" />
          }
        />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className="min-w-0 break-words text-sm font-bold leading-tight text-slate-900 line-clamp-2">
                {item.name}
              </p>
              {metaLabel && (
                <span className="min-w-0 max-w-[45%] truncate text-right text-[11px] text-slate-400">
                  {metaLabel}
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 text-sm font-black text-orange-600">
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
                  className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-slate-600 transition hover:bg-white"
                  aria-label="Decrease"
                >
                  -
                </button>
                <span className="min-w-6 text-center text-sm font-semibold text-slate-900">
                  {qtyInCart}
                </span>
                <button
                  onClick={() => updateItem(item.id, qtyInCart + 1)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-orange-500 text-sm font-bold text-white transition hover:bg-orange-600"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                disabled={isAdding || !sessionReady}
                onClick={() => handleAddToCart(item.id)}
                className="box-border inline-flex min-h-10 w-full max-w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="box-border min-h-dvh w-full max-w-full min-w-0 overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.08),_transparent_28%),linear-gradient(180deg,#fffaf5_0%,#f8fafc_38%,#f8fafc_100%)] text-slate-900 pb-[env(safe-area-inset-bottom,0px)]">
      <header id="menu-top" className={`fixed top-0 left-0 right-0 z-50 w-full border-b border-slate-200/60 bg-white/95 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_4px_6px_-2px_rgba(0,0,0,0.05)] backdrop-blur-md pt-[env(safe-area-inset-top,0px)] transition-transform duration-500 ease-in-out ${
        headerVisible ? "translate-y-0" : "-translate-y-16"
      }`}>
        <div className="mx-auto box-border flex h-16 w-full max-w-[min(72rem,100%)] min-w-0 items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SafeMenuAsset
              path={menu.restaurant.logo_url}
              alt={menu.restaurant.name}
              className="h-11 w-11 rounded-2xl object-cover ring-1 ring-slate-200"
              fallbackClassName="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white"
              fallback={
                <Store className="h-5 w-5" />
              }
            />

            <div className="min-w-0">
              <p className="truncate text-lg font-black leading-tight text-slate-900">
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
            <button
              onClick={() => setProfileDrawerOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 transition hover:bg-slate-200"
              aria-label="Open profile menu"
            >
              <UserRound className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className={`mx-auto box-border w-full max-w-[min(72rem,100%)] min-w-0 px-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          searchPanelOpen ? "pb-2" : "pb-0"
        }`}>
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

        <div
          ref={categoryRailShellRef}
          className="mx-auto box-border flex h-16 w-full max-w-[min(72rem,100%)] min-w-0 items-center px-4 py-2 sm:px-5 lg:px-6"
        >
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
      <div className="h-[calc(4rem+4rem+env(safe-area-inset-top,0px))]" />

      <main
        id="menu-content"
        className="mx-auto box-border flex w-full max-w-[min(72rem,100%)] min-w-0 touch-pan-y flex-1 flex-col gap-3 overflow-x-hidden px-4 py-3 pb-28 sm:px-5 lg:px-6"
        {...menuSwipeHandlers}
      >
        <section className="box-border w-full max-w-full min-w-0">
          <div className="relative box-border min-h-[12.75rem] w-full max-w-full min-w-0 overflow-hidden rounded-2xl bg-slate-950 px-5 py-5 text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] sm:min-h-[13.5rem] sm:px-6 sm:py-6 lg:min-h-[15rem]">
            {featuredBannerPaths.length > 0 && (
              <SafeMenuAsset
                path={featuredBannerPaths[activeBannerIndex]}
                alt="Featured menu banner"
                loading="eager"
                className="absolute inset-0 h-full w-full object-cover"
                fallbackClassName="absolute inset-0 bg-slate-950"
                fallback={null}
              />
            )}
            <div className="absolute inset-0 bg-slate-950/65" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.28),_transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.1)_0%,rgba(15,23,42,0.55)_100%)]" />
            <div className="relative z-10 flex h-full min-h-[calc(12.75rem-2.5rem)] flex-col justify-between gap-4 sm:min-h-[calc(13.5rem-3rem)] sm:gap-5 lg:min-h-[calc(15rem-3rem)]">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 sm:text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  Featured picks
                </p>
                <h2 className="mt-4 max-w-full break-words text-[1.65rem] font-black leading-tight tracking-tight sm:max-w-xl sm:text-3xl">
                  Order faster from your table.
                </h2>
                <p className="mt-2 max-w-full break-words text-sm leading-6 text-white/80 sm:max-w-2xl">
                  Choose favorites, update quantities, and place your order without leaving the menu.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-white/80 sm:text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1.5">Fast add</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">Table session</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">Live cart</span>
              </div>
            </div>
          </div>
        </section>

        <section id="menu-list" className="box-border w-full max-w-full min-w-0 space-y-3">
          <div className="flex min-w-0 items-end justify-between gap-2">
            <div className="min-w-0">
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
            <div className="grid w-full max-w-full min-w-0 grid-cols-1 gap-3 min-[380px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {visibleTiles.map(renderItemCard)}
            </div>
          )}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 box-border w-full max-w-full overflow-hidden border-t border-white/70 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl min-[360px]:px-4">
        <div className="mx-auto grid w-full max-w-[min(72rem,100%)] min-w-0 grid-cols-5 items-end gap-1 min-[360px]:gap-2">
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
            onClick={handleFocusSearch}
            className="flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 min-[360px]:rounded-2xl min-[360px]:text-[11px]"
          >
            <Search className="h-5 w-5" />
            <span className="max-w-full truncate">Search</span>
          </button>

          <FloatingCartButton itemCount={cartItemCount} onOpenCart={handleOpenCart} />

          <button
            type="button"
            onClick={() => {
              if (!restaurantId || !tableNumber) return;
              const target = qrAccessKey
                ? `/orders/my/${restaurantId}/${tableNumber}?k=${encodeURIComponent(qrAccessKey)}`
                : `/orders/my/${restaurantId}/${tableNumber}`;
              navigate(target);
            }}
            className="flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 min-[360px]:rounded-2xl min-[360px]:text-[11px]"
          >
            <Bell className="h-5 w-5" />
            <span className="max-w-full truncate">Orders</span>
          </button>

          <button
            type="button"
            onClick={handleContactStaff}
            className="flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 min-[360px]:rounded-2xl min-[360px]:text-[11px]"
            aria-label="Contact staff"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="max-w-full truncate">Chat</span>
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

      {/* Profile drawer */}
      {profileDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity animate-in fade-in-0 duration-300"
            onClick={() => setProfileDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="absolute bottom-0 right-0 top-0 box-border flex w-full max-w-[min(24rem,100%)] flex-col bg-white shadow-2xl transition-all duration-300 animate-in slide-in-from-right-40">
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
              <div className="border-b border-slate-200 px-5 py-5 sm:px-6 sm:py-6">
                <div className="mb-4 flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-2xl font-bold text-white">
                    {guestName?.charAt(0).toUpperCase() ?? "G"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-500">Guest Name</p>
                    <p className="truncate text-lg font-bold text-slate-900">{guestName ?? "Guest"}</p>
                  </div>
                </div>

                {tableNumber && restaurantId && (
                  <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
                    <p className="text-slate-600">
                      <span className="font-semibold text-slate-900">Table:</span> {tableNumber}
                    </p>
                    <p className="break-words text-slate-600">
                      <span className="font-semibold text-slate-900">Restaurant:</span> {menu?.restaurant.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Menu Items */}
              <div className="py-3">
                {restaurantId && tableNumber && (
                  <Link
                    to={
                      qrAccessKey
                        ? `/orders/my/${restaurantId}/${tableNumber}?k=${encodeURIComponent(qrAccessKey)}`
                        : `/orders/my/${restaurantId}/${tableNumber}`
                    }
                    onClick={() => setProfileDrawerOpen(false)}
                    className="flex min-h-12 items-center justify-between px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 sm:px-6"
                  >
                    <span>My Orders</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                )}

                <button
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between px-5 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50 sm:px-6"
                  onClick={() => {
                    setProfileDrawerOpen(false);
                    handleFocusSearch();
                  }}
                >
                  <span>Search menu</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between px-5 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50 sm:px-6"
                  onClick={() => {
                    setProfileDrawerOpen(false);
                    handleScrollTo("menu-top");
                  }}
                >
                  <span>Back to top</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
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
