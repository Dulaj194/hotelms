import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  ClipboardList,
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
  ArrowUp,
} from "lucide-react";
import MenuBrowserRail from "@/components/public/MenuBrowserRail";
import SafeMenuAsset from "@/components/public/SafeMenuAsset";
import { useSwipeNavigation } from "@/components/public/useSwipeNavigation";
import { usePublicMenuBrowser } from "@/components/public/usePublicMenuBrowser";
import {
  clearGuestSession,
  getGuestDisplayName,
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
        <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white ring-2 ring-white">
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
  const [searchQuery, setSearchQuery] = useState("");
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [categoryRailVisible, setCategoryRailVisible] = useState(true);
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
    const topRevealOffset = 16;
    const scrollDeltaThreshold = 8;

    lastMenuScrollYRef.current = window.scrollY;

    if (!categoryRailAutoHideEnabled) {
      setCategoryRailVisible(true);
      return;
    }

    const updateCategoryRailVisibility = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastMenuScrollYRef.current;
      const scrollDelta = currentScrollY - lastScrollY;

      if (currentScrollY <= topRevealOffset) {
        setCategoryRailVisible(true);
        lastMenuScrollYRef.current = currentScrollY;
        menuScrollFrameRef.current = null;
        return;
      }

      if (Math.abs(scrollDelta) >= scrollDeltaThreshold) {
        setCategoryRailVisible(scrollDelta < 0);
        lastMenuScrollYRef.current = currentScrollY;
      }

      menuScrollFrameRef.current = null;
    };

    const handleWindowScroll = () => {
      if (menuScrollFrameRef.current !== null) return;
      menuScrollFrameRef.current = window.requestAnimationFrame(updateCategoryRailVisibility);
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
    if (featuredBannerPaths.length <= 1) return;
    const timerId = window.setInterval(() => {
      setActiveBannerIndex((current) => (current + 1) % featuredBannerPaths.length);
    }, 60_000);
    return () => window.clearInterval(timerId);
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
      const usableContentHeight = headerHeightWithoutRail + Math.max(0, menuContentHeight);
      const canAutoHide = usableContentHeight > window.innerHeight + scrollableContentBuffer;

      setCategoryRailAutoHideEnabled(canAutoHide);
      if (!canAutoHide) setCategoryRailVisible(true);
      frameId = null;
    };

    const scheduleCategoryRailModeUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateCategoryRailMode);
    };

    scheduleCategoryRailModeUpdate();
    window.addEventListener("resize", scheduleCategoryRailModeUpdate);
    return () => {
      window.removeEventListener("resize", scheduleCategoryRailModeUpdate);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [activeCategoryId, featuredBannerPaths.length, searchPanelOpen, searchQuery, visibleCategories.length]);

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

  useEffect(() => {
    if (!restaurantId || !tableNumber || !guestName) return;
    const parsedRestaurantId = Number(restaurantId);
    if (Number.isNaN(parsedRestaurantId)) {
      setPageError("Invalid restaurant context. Please scan the QR code again.");
      return;
    }
    if (qrAccessKey) setGuestQrAccessKey(parsedRestaurantId, tableNumber, qrAccessKey);
    setSessionReady(true);
  }, [restaurantId, tableNumber, qrAccessKey, guestName]);

  useEffect(() => {
    if (!restaurantId) return;
    const fetchMenu = async () => {
      try {
        const data = await publicGet<PublicMenuResponse>(`/public/restaurants/${restaurantId}/menu`);
        setMenu(data);
      } catch {
        setPageError("Failed to load the menu.");
      }
    };
    void fetchMenu();
  }, [restaurantId]);

  const handleAddToCart = useCallback(async (itemId: number) => {
    setAddingItemId(itemId);
    try { await addItem(itemId, 1); } finally { setAddingItemId(null); }
  }, [addItem]);

  const handleOpenCart = useCallback(() => {
    if (!restaurantId || !tableNumber) return;
    const basePath = `/menu/${restaurantId}/table/${tableNumber}/cart`;
    navigate(qrAccessKey ? `${basePath}?k=${encodeURIComponent(qrAccessKey)}` : basePath);
  }, [navigate, qrAccessKey, restaurantId, tableNumber]);

  const handleNameSubmit = useCallback(() => {
    const trimmed = guestNameInput.trim();
    if (!trimmed) { setNameError("Please enter your name."); return; }
    setNameError(null);
    setGuestName(trimmed);
  }, [guestNameInput]);

  const handleScrollTo = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleFocusSearch = useCallback(() => {
    setSearchPanelOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
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
    if (callablePhone) { window.location.href = `tel:${callablePhone}`; }
    else { setProfileDrawerOpen(true); }
  }, [menu?.restaurant.phone]);

  if (pageError) return <div className="p-6 text-center text-red-600">{pageError}</div>;
  if (!menu) return <div className="p-12 text-center animate-pulse text-gray-400">Loading...</div>;

  if (!guestName) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.12),_transparent_34%),linear-gradient(180deg,#fff8f1_0%,#ffffff_28%,#f8fafc_100%)] px-4 py-6 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center">
          <div className="w-full overflow-hidden rounded-[2rem] border border-orange-100 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="bg-gradient-to-br from-orange-500 via-orange-500 to-amber-500 px-6 pb-8 pt-6 text-white text-center">
              <h1 className="text-3xl font-black">{menu.restaurant.name}</h1>
              <p className="mt-2 text-sm opacity-90">Enter your name to start ordering at Table {tableNumber}.</p>
            </div>
            <div className="px-6 py-8">
              <input
                value={guestNameInput}
                onChange={(e) => setGuestNameInput(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-orange-400 focus:bg-white"
              />
              {nameError && <p className="mt-2 text-xs text-red-600">{nameError}</p>}
              <button onClick={handleNameSubmit} className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white">
                Start Ordering
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayTableNumber = tableNumber && /^\d+$/.test(tableNumber) ? tableNumber.padStart(2, "0") : tableNumber;

  const renderItemCard = ({ item, categoryName }: MenuTile) => {
    const cartItem = cart?.items.find((ci) => ci.item_id === item.id);
    const qtyInCart = cartItem?.quantity ?? 0;
    const isAdding = addingItemId === item.id;

    return (
      <div key={item.id} className="group box-border flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5">
        <SafeMenuAsset path={item.image_path} alt={item.name} className="block aspect-[4/3] w-full object-cover" />
        <div className="flex flex-1 flex-col gap-2.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-bold leading-tight text-slate-900 line-clamp-2">{item.name}</p>
            <span className="shrink-0 text-[11px] text-slate-400">{categoryName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-orange-600">${item.price.toFixed(2)}</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${item.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {item.is_available ? 'Available' : 'Sold out'}
            </span>
          </div>
          {qtyInCart > 0 ? (
            <div className="box-border flex min-h-10 items-center justify-between rounded-full border bg-slate-50 p-1">
              <button onClick={() => updateItem(item.id, qtyInCart - 1)} className="grid h-8 w-8 place-items-center rounded-full bg-white">-</button>
              <span className="text-sm font-bold">{qtyInCart}</span>
              <button onClick={() => updateItem(item.id, qtyInCart + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-white">+</button>
            </div>
          ) : (
            <button
              disabled={isAdding || !sessionReady || !item.is_available}
              onClick={() => handleAddToCart(item.id)}
              className="box-border inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              {isAdding ? "Adding..." : "Add to Cart"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="box-border min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.08),_transparent_28%),linear-gradient(180deg,#fffaf5_0%,#f8fafc_38%,#f8fafc_100%)] text-slate-900">
      <header id="menu-top" className="sticky top-0 z-30 w-full bg-white/90 backdrop-blur-xl border-b border-white/60">
        <div className="mx-auto flex max-w-[min(72rem,100%)] items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <SafeMenuAsset path={menu.restaurant.logo_url} alt={menu.restaurant.name} className="h-11 w-11 rounded-2xl object-cover ring-1 ring-slate-200" fallback={<Store className="h-5 w-5" />} />
            <div className="min-w-0">
              <p className="truncate text-lg font-black">{menu.restaurant.name}</p>
              <p className="text-[10px] font-semibold text-slate-500">{guestName} • Table {displayTableNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setProfileDrawerOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 transition hover:bg-slate-200">
              <UserRound className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className={`mx-auto max-w-[min(72rem,100%)] px-4 transition-all duration-300 ${searchPanelOpen ? "pb-3 opacity-100" : "h-0 opacity-0 overflow-hidden"}`}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full rounded-2xl border bg-slate-50 py-3 pl-11 pr-12 text-sm outline-none focus:border-orange-400"
            />
            <button onClick={handleCloseSearch} className="absolute right-2 top-1/2 -translate-y-1/2 p-2"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div ref={categoryRailShellRef} className={`mx-auto max-w-[min(72rem,100%)] px-4 pb-2 transition-all duration-300 ${categoryRailVisible ? "max-h-20" : "max-h-0 opacity-0 pointer-events-none"}`}>
          <MenuBrowserRail visibleCategories={visibleCategories} activeCategoryId={activeCategoryId} onSelectCategory={setActiveCategoryId} />
        </div>
      </header>

      <main id="menu-content" className="mx-auto max-w-[min(72rem,100%)] w-full flex-1 touch-pan-y space-y-6 px-4 py-6 pb-28" {...menuSwipeHandlers}>
        <section className="relative overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-lg min-h-[160px] flex flex-col justify-center">
          {featuredBannerPaths.length > 0 && (
            <SafeMenuAsset path={featuredBannerPaths[activeBannerIndex]} alt="Banner" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          )}
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest"><Sparkles className="h-3 w-3" /> Featured picks</p>
            <h2 className="mt-3 text-2xl font-black">Order faster from your table.</h2>
          </div>
        </section>

        <section id="menu-list" className="space-y-4">
          <h2 className="text-xl font-black">{searchQuery ? "Search results" : selectedCategory?.name ?? "All items"}</h2>
          {visibleTiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-slate-500">No items found.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {visibleTiles.map(renderItemCard)}
            </div>
          )}
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-lg backdrop-blur-xl">
        <div className="mx-auto grid max-w-[min(72rem,100%)] grid-cols-5 items-end gap-1">
          <button onClick={() => handleScrollTo("menu-list")} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-500"><Menu className="h-5 w-5" /> Menu</button>
          <button onClick={handleFocusSearch} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-500"><Search className="h-5 w-5" /> Search</button>
          <FloatingCartButton itemCount={cartItemCount} onOpenCart={handleOpenCart} />
          <button onClick={() => navigate(`/orders/my/${restaurantId}/${tableNumber}`)} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-500"><Bell className="h-5 w-5" /> Orders</button>
          <button onClick={handleContactStaff} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-500"><MessageCircle className="h-5 w-5" /> Chat</button>
        </div>
      </nav>

      {profileDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setProfileDrawerOpen(false)} />
          <div className="absolute bottom-0 right-0 top-0 w-full max-w-[min(24rem,100%)] flex flex-col bg-white shadow-2xl animate-in slide-in-from-right-40">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold">Profile</h2>
              <button onClick={() => setProfileDrawerOpen(false)} className="p-2"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-2xl font-bold text-white">
                  {guestName?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-500">Guest Name</p>
                  <p className="truncate text-lg font-bold">{guestName}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm space-y-2">
                <p><span className="font-semibold">Table:</span> {tableNumber}</p>
                <p><span className="font-semibold">Restaurant:</span> {menu.restaurant.name}</p>
              </div>
              <div className="space-y-1">
                <Link to={`/orders/my/${restaurantId}/${tableNumber}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-sm font-semibold">
                  <div className="flex items-center gap-3"><ClipboardList className="h-5 w-5 text-slate-400" /> My Orders</div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
                <button onClick={() => { setProfileDrawerOpen(false); handleFocusSearch(); }} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-sm font-semibold text-left">
                  <div className="flex items-center gap-3"><Search className="h-5 w-5 text-slate-400" /> Search Menu</div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
                <button onClick={() => { setProfileDrawerOpen(false); handleScrollTo("menu-top"); }} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-sm font-semibold text-left">
                  <div className="flex items-center gap-3"><ArrowUp className="h-5 w-5 text-slate-400" /> Back to top</div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="border-t p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3 font-bold text-red-600 hover:bg-red-100 transition">
                <LogOut className="h-4 w-4" /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}