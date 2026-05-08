import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  Check,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  RefreshCcw,
  Search,
  ShoppingCart,
  Store,
  UserRound,
  UtensilsCrossed,
  X,
} from "lucide-react";
import PublicMenuDropdown from "@/components/public/PublicMenuDropdown";
import MenuBrowserRail from "@/components/public/MenuBrowserRail";
import QuickServiceDrawer from "@/components/public/QuickServiceDrawer";
import SafeMenuAsset from "@/components/public/SafeMenuAsset";
import { usePublicMenuBrowser } from "@/components/public/usePublicMenuBrowser";
import { getGuestToken } from "@/hooks/useGuestSession";
import {
  clearGuestSession,
  getGuestDisplayName,
  setGuestDisplayName,
  getGuestQrAccessKey,
  setGuestQrAccessKey,
} from "@/hooks/useGuestSession";
import { useLocalTableCart } from "@/hooks/useLocalMenuCart";
import { publicGet, publicPost } from "@/lib/publicApi";
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
      className="relative -mt-6 mx-auto grid h-14 w-14 place-items-center rounded-full bg-orange-500 text-white shadow-[0_20px_40px_rgba(249,115,22,0.35)] transition hover:bg-orange-600 active:scale-95 min-[360px]:-mt-7 min-[360px]:h-16 min-[360px]:w-16"
      aria-label={itemCount > 0 ? `Open cart, ${itemCount} items` : "Open cart"}
    >
      <ShoppingCart className="h-6 w-6 min-[360px]:h-7 min-[360px]:w-7" />
      {itemCount > 0 && (
        <span key={itemCount} className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white ring-2 ring-white animate-in zoom-in-50 duration-300">
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const [guestNameInput, setGuestNameInput] = useState("");
  const [guestName, setGuestName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [recentlyAddedItemId, setRecentlyAddedItemId] = useState<number | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const [isRequestingService, setIsRequestingService] = useState(false);
  const [lastRequestedService, setLastRequestedService] = useState<string | null>(null);

  const lastMenuScrollYRef = useRef(0);
  const isHeaderTransitioningRef = useRef(false);
  const headerTransitionTimeoutRef = useRef<number | null>(null);

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
    visibleCategories,
  } = usePublicMenuBrowser(menu);

  const navigationItems = useMemo(() => [null, ...visibleCategories], [visibleCategories]);



  const handleCategorySelect = (categoryId: number | null) => {
    setActiveCategoryId(categoryId);
    const index = navigationItems.findIndex((item) => (item?.id ?? null) === categoryId);
    if (scrollRef.current && index !== -1) {
      isScrollingRef.current = true;
      const width = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({
        left: width * index,
        behavior: "smooth",
      });
      // Haptic feedback for manual category selection
      if (window.navigator.vibrate) window.navigator.vibrate(5);
      
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 500);
    }
  };

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

  const handleContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (searchPanelOpen || isHeaderTransitioningRef.current) return;
    
    const currentScrollTop = e.currentTarget.scrollTop;
    const lastScrollTop = lastMenuScrollYRef.current;
    const delta = currentScrollTop - lastScrollTop;

    // Higher threshold for hiding (30px), lower for showing (10px) to stabilize momentum
    if (delta > 30 && currentScrollTop > 150) {
      if (headerVisible) {
        setHeaderVisible(false);
        isHeaderTransitioningRef.current = true;
        if (headerTransitionTimeoutRef.current) window.clearTimeout(headerTransitionTimeoutRef.current);
        headerTransitionTimeoutRef.current = window.setTimeout(() => {
          isHeaderTransitioningRef.current = false;
        }, 400); 
      }
    } else if (delta < -12 || currentScrollTop < 50) {
      if (!headerVisible) {
        setHeaderVisible(true);
        isHeaderTransitioningRef.current = true;
        if (headerTransitionTimeoutRef.current) window.clearTimeout(headerTransitionTimeoutRef.current);
        headerTransitionTimeoutRef.current = window.setTimeout(() => {
          isHeaderTransitioningRef.current = false;
        }, 400);
      }
    }

    lastMenuScrollYRef.current = currentScrollTop;
  }, [headerVisible, searchPanelOpen]);

  useEffect(() => {
    // Reset scroll tracker when switching categories to avoid jumpy behavior
    lastMenuScrollYRef.current = 0;
  }, [activeCategoryId]);

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

  const formatPrice = useCallback((price: number) => `$${price.toFixed(2)}`, []);

  const handleDecreaseQty = useCallback((itemId: number, qtyInCart: number) => {
    if (qtyInCart > 1) {
      updateItem(itemId, qtyInCart - 1);
    } else {
      removeItem(itemId);
    }
    // Haptic feedback for removal
    if (window.navigator.vibrate) window.navigator.vibrate(5);
  }, [removeItem, updateItem]);

  const handleIncreaseQty = useCallback((itemId: number, qtyInCart: number) => {
    updateItem(itemId, qtyInCart + 1);
    // Haptic feedback for addition
    if (window.navigator.vibrate) window.navigator.vibrate(10);
  }, [updateItem]);

  const handleAddToCart = useCallback(
    async (itemId: number) => {
      setAddingItemId(itemId);
      try {
        await addItem(itemId, 1);
        setRecentlyAddedItemId(itemId);
        // Haptic feedback
        if (window.navigator.vibrate) window.navigator.vibrate([10, 30, 10]);
        setTimeout(() => setRecentlyAddedItemId(null), 1500);
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
      if (window.navigator.vibrate) window.navigator.vibrate([30, 100, 30]);
      return;
    }
    setNameError(null);
    setGuestName(trimmed);

    // Haptic feedback for starting session
    if (window.navigator.vibrate) window.navigator.vibrate(20);

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

  const handleToggleSearch = useCallback(() => {
    setSearchPanelOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else {
        setSearchQuery("");
      }
      return next;
    });
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

  const handleRequestService = useCallback(async (serviceType: string, message?: string) => {
    if (!restaurantId || !tableNumber) return;
    
    const isBill = serviceType === "BILL";
    const endpoint = isBill ? "/table-sessions/my/request-bill" : "/table-sessions/my/request-service";
    const body = isBill ? {} : { service_type: serviceType, message: message?.trim() || undefined };

    setIsRequestingService(true);
    setLastRequestedService(serviceType);

    try {
      const guestToken = getGuestToken();
      if (!guestToken) {
        setPageError("Session expired. Please scan the QR code again.");
        return;
      }

      await publicPost(endpoint, body, {
        headers: { "X-Guest-Session": guestToken },
      });
      
      // Haptic feedback for successful request
      if (window.navigator.vibrate) window.navigator.vibrate(25);

      // Show success state briefly then reset
      setTimeout(() => {
        setIsRequestingService(false);
        if (isBill) {
          setServiceDrawerOpen(false);
          // Small delay before resetting the success icon state so it's visible
          setTimeout(() => setLastRequestedService(null), 500);
        } else {
          // For other services, keep it open but reset after a bit
          setTimeout(() => setLastRequestedService(null), 1500);
        }
      }, 1500);

    } catch (error: any) {
      console.error("Service request error details:", {
        error: error.message,
        service: serviceType,
        endpoint: endpoint
      });
      setIsRequestingService(false);
      setLastRequestedService(null);
    }
  }, [restaurantId, tableNumber]);

  const handleContactStaff = useCallback(() => {
    setServiceDrawerOpen(true);
  }, []);

  if (pageError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <div className="mb-6 grid h-20 w-20 place-items-center rounded-[2rem] bg-red-50 text-red-500 shadow-sm">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Something went wrong</h1>
        <p className="mt-2 max-w-xs text-sm font-medium leading-relaxed text-slate-500">
          {pageError}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-8 flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 active:scale-95"
        >
          <RefreshCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="min-h-dvh w-full bg-slate-50 pt-[env(safe-area-inset-top,24px)]">
        {/* Skeleton Header */}
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200/60" />
            </div>
          </div>
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />
        </div>

        {/* Skeleton Banner */}
        <div className="mx-4 mt-6 h-48 animate-pulse rounded-[2rem] bg-slate-200" />

        {/* Skeleton Categories */}
        <div className="mt-8 flex gap-3 overflow-hidden px-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-slate-200" />
          ))}
        </div>

        {/* Skeleton Grid */}
        <div className="mt-8 grid grid-cols-1 gap-4 px-4 min-[380px]:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-4 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-slate-100" />
              <div className="space-y-3 p-1">
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200" />
                <div className="flex justify-between">
                  <div className="h-4 w-16 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-4 w-12 animate-pulse rounded-full bg-slate-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
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
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md ring-1 ring-white/30 animate-bounce [animation-duration:3s]">
                  <Store className="h-7 w-7 text-white" />
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-black/10 px-3.5 py-1.5 text-[11px] font-bold backdrop-blur-md ring-1 ring-white/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Table {tableNumber}
                </div>
                <span className="rounded-full bg-black/10 px-3.5 py-1.5 text-[11px] font-bold backdrop-blur-md ring-1 ring-white/20">
                  QR Verified
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

    return (
      <article
        key={item.id}
        id={`item-${item.id}`}
        className="group relative flex h-full w-full flex-col overflow-hidden rounded-[24px] bg-white p-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)]"
      >
        {/* 1. Image Section */}
        <div className="relative w-full overflow-hidden rounded-[16px] bg-[#F8F9FB] h-[140px] sm:h-[160px] lg:h-[180px]">
          <SafeMenuAsset
            path={item.image_path}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            fallback={<UtensilsCrossed className="h-8 w-8 text-[#94A3B8]" />}
          />
          {!item.is_available && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#0F172A]">
                Sold Out
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col pt-4">
          {/* 2. Category Section */}
          <span className="text-[12px] font-semibold uppercase tracking-[2px] text-[#FF7A00]">
            {categoryName}
          </span>

          {/* 3. Item Name and Price Section */}
          <div className="mt-1 flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 break-words text-[18px] font-bold leading-tight text-[#0F172A] line-clamp-1 min-[380px]:text-[20px]">
              {item.name}
            </h3>
            <span className="shrink-0 text-[18px] font-extrabold text-orange-600 min-[380px]:text-[20px]">
              {formatPrice(item.price)}
            </span>
          </div>

          {/* 4. Description Section */}
          <p className="mt-2 text-[14px] font-normal leading-relaxed text-[#94A3B8] line-clamp-2">
            {item.description || "Freshly prepared with premium ingredients."}
          </p>

          {/* 5. Add Button Section */}
          <div className="mt-auto pt-4">
            {qtyInCart > 0 ? (
              <div className="flex h-[48px] w-full items-center justify-between rounded-[16px] bg-[#0F172A] p-1.5 text-white shadow-lg">
                <button
                  type="button"
                  onClick={() => handleDecreaseQty(item.id, qtyInCart)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xl transition hover:bg-white/20 active:scale-90"
                >
                  −
                </button>
                <span className="text-[16px] font-bold">{qtyInCart}</span>
                <button
                  type="button"
                  onClick={() => handleIncreaseQty(item.id, qtyInCart)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-[#FF7A00] text-xl transition hover:bg-[#FF7A00]/90 active:scale-90"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isAdding || !item.is_available || !sessionReady}
                onClick={() => handleAddToCart(item.id)}
                className={`flex h-[48px] w-full items-center justify-center gap-2 rounded-[16px] text-[16px] font-semibold transition-all duration-300 active:scale-[0.98] disabled:opacity-40 ${
                  recentlyAddedItemId === item.id
                    ? "bg-emerald-500 text-white"
                    : "bg-[#FF7A00] text-white hover:brightness-105"
                }`}
              >
                {isAdding ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : recentlyAddedItemId === item.id ? (
                  <Check className="h-5 w-5 animate-in zoom-in-50" />
                ) : (
                  <>
                    <span>Add to Cart</span>
                    <ShoppingCart className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const cartItemCount = cart?.item_count ?? 0;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-50 text-slate-900">
      <header
        id="menu-top"
        className={`absolute left-0 right-0 top-0 z-50 border-b border-slate-200/60 bg-white/95 shadow-sm backdrop-blur-md transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${
          headerVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="h-[env(safe-area-inset-top,0px)]" />
        <div className="mx-auto flex h-16 w-full max-w-[min(72rem,100%)] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
              <SafeMenuAsset
                path={menu.restaurant.logo_url}
                alt={menu.restaurant.name}
                className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200"
                fallback={<Store className="h-5 w-5" />}
              />
              <div className="min-w-0">
                <p className="truncate text-base font-black text-slate-900">{menu.restaurant.name}</p>
                <p className="text-[10px] font-bold text-slate-500">Table {displayTableNumber}</p>
              </div>
            </div>
            <button
              onClick={() => setProfileDrawerOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            >
              <UserRound className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search Panel */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
          searchPanelOpen ? "max-h-[80dvh] opacity-100" : "max-h-0 opacity-0"
        }`}>
          <div className="mx-auto w-full max-w-[min(72rem,100%)] px-4 py-3 sm:px-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchInputRef.current?.blur()}
                placeholder="Search dishes, ingredients, or category"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-12 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
              <button
                onClick={handleCloseSearch}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {searchQuery.length > 0 && (
              <div className="mt-4 max-h-[calc(70dvh-100px)] overflow-y-auto no-scrollbar pb-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Search Results ({visibleTiles.length})
                  </p>
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="text-[10px] font-bold uppercase text-orange-500 hover:text-orange-600"
                  >
                    Clear
                  </button>
                </div>
                
                {visibleTiles.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm font-medium text-slate-400">No matches for "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {visibleTiles.map((tile) => (
                      <button
                        key={tile.item.id}
                        onClick={() => {
                          handleCloseSearch();
                          setTimeout(() => handleScrollTo(`item-${tile.item.id}`), 150);
                        }}
                        className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-2 text-left transition hover:border-orange-200 hover:bg-white hover:shadow-md"
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                          <SafeMenuAsset
                            path={tile.item.image_path}
                            alt={tile.item.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
                            fallback={<UtensilsCrossed className="h-6 w-6 text-slate-300" />}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900">{tile.item.name}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-xs font-black text-orange-600">${tile.item.price.toFixed(2)}</span>
                            <span className="truncate text-[10px] font-medium text-slate-400">{tile.categoryName}</span>
                          </div>
                        </div>
                        <ChevronRight className="mr-1 h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-orange-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </header>


      <main
        id="menu-content"
        className="flex-1 overflow-y-auto no-scrollbar vertical-scroll"
        onScroll={handleContentScroll}
      >
        {/* Fixed Spacer for the Absolute Header */}
        <div className="h-[calc(4rem+env(safe-area-inset-top,0px))] shrink-0" />

        {/* Sticky Category Bar */}
        <div className="sticky top-0 z-40 w-full border-b border-slate-200/60 bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-[min(72rem,100%)] items-center px-4 sm:px-6">
            <MenuBrowserRail
              visibleCategories={visibleCategories}
              activeCategoryId={activeCategoryId}
              onSelectCategory={handleCategorySelect}
            />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[min(72rem,100%)] px-4 py-4 pb-40">
          {/* Featured Banner */}
          {activeCategoryId === null && featuredBannerPaths.length > 0 && (
            <section className="mb-8 overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
              <div className="relative aspect-[21/9] w-full overflow-hidden sm:aspect-[21/7]">
                <SafeMenuAsset
                  path={featuredBannerPaths[activeBannerIndex]}
                  alt="Featured banner"
                  className="absolute inset-0 h-full w-full object-cover"
                  fallback={null}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Deliciousness delivered.</h2>
                  <p className="mt-1 text-sm font-medium text-white/80">Select your favorites and order in seconds.</p>
                </div>
              </div>
            </section>
          )}

          {/* Product Grid */}
          <section className="space-y-8">
            {navigationItems.map((navItem) => {
              const catId = navItem?.id ?? null;
              
              // Only show the active category, or all if "All" is selected
              if (activeCategoryId !== null && catId !== activeCategoryId) return null;

              const categoryTiles = visibleCategories
                .filter((c) => catId === null || c.id === catId)
                .flatMap((c) =>
                  c.items.map((item) => ({
                    item,
                    categoryId: c.id,
                    categoryName: c.name,
                  })),
                );

              if (categoryTiles.length === 0 && catId !== null) return null;

              return (
                <div key={catId ?? "all"} id={catId ? `category-section-${catId}` : "all-section"} className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-slate-900">
                        {catId === null ? "All items" : navItem?.name}
                      </h2>
                      {navItem?.description && (
                        <p className="mt-1 text-xs font-medium text-slate-400">{navItem.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {categoryTiles.map(renderItemCard)}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </main>

      <nav className="shrink-0 border-t border-slate-200/60 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl min-[360px]:px-4">
        <div className="mx-auto grid w-full max-w-[min(72rem,100%)] min-w-0 grid-cols-5 items-end gap-1 min-[360px]:gap-2">
          <button
            type="button"
            onClick={() => setMenuDropdownOpen(true)}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition-all duration-500 ease-out min-[360px]:rounded-2xl min-[360px]:text-[11px] ${
              menuDropdownOpen 
              ? "bg-orange-500 text-white shadow-[0_8px_16px_rgba(249,115,22,0.3)] scale-105" 
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <MenuIcon className="h-5 w-5" />
            <span className="max-w-full truncate">Menu</span>
          </button>

          <button
            type="button"
            onClick={handleToggleSearch}
            className="flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold text-slate-500 transition-all duration-300 active:scale-90 hover:bg-slate-50 hover:text-slate-900 min-[360px]:rounded-2xl min-[360px]:text-[11px]"
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
            <span className="max-w-full truncate">Service</span>
          </button>
        </div>
      </nav>

      {menu && (
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
      )}

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
                    handleToggleSearch();
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
