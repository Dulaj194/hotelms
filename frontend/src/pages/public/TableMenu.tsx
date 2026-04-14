import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import CartDrawer from "@/components/shared/CartDrawer";
import { useCart } from "@/hooks/useCart";
import { getGuestDisplayName, hasGuestSession, setGuestSession } from "@/hooks/useGuestSession";
import { publicGet, publicPost } from "@/lib/publicApi";
import type {
  PublicItemSummaryResponse,
  PublicMenuResponse,
} from "@/types/publicMenu";
import type { TableSessionStartResponse } from "@/types/session";

export default function TableMenu() {
  const [searchParams] = useSearchParams();
  const { restaurantId, tableNumber } = useParams<{
    restaurantId: string;
    tableNumber: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";
  const navigate = useNavigate();

  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [guestNameInput, setGuestNameInput] = useState("");
  const [guestName, setGuestName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);

  const { cart, addItem, updateItem, removeItem, clearCart, placeOrder, refetch } =
    useCart();

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

    // Allow returning from other pages (e.g. orders list) without requiring QR query param again
    // when a valid guest session token is already in storage for this context.
    if (hasGuestSession()) {
      setSessionReady(true);
      return;
    }

    const init = async () => {
      if (!qrAccessKey) {
        setPageError("Invalid table QR link. Please scan the table QR code again.");
        return;
      }
      try {
        const session = await publicPost<TableSessionStartResponse>(
          "/table-sessions/start",
          {
            restaurant_id: Number(restaurantId),
            table_number: tableNumber,
            customer_name: guestName,
            qr_access_key: qrAccessKey,
          }
        );
        setGuestSession(session);
        setSessionReady(true);
      } catch {
        setPageError("Could not start a guest session. Please scan the QR code again.");
      }
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

  const activeCategory =
    menu.categories.find((c) => c.id === activeCategoryId) ??
    menu.categories[0];
  const visibleSubcategories =
    activeCategory?.subcategories.filter((subcat) => subcat.items.length > 0) ?? [];
  const hasDirectItems = (activeCategory?.items.length ?? 0) > 0;
  const hasAnyItems = hasDirectItems || visibleSubcategories.length > 0;

  if (!guestName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-3xl border border-orange-100 bg-white p-5 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">Table Session</p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">Welcome to Table {tableNumber}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Enter your name to start your session and place orders.
          </p>

          <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
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
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
          {nameError && <p className="mt-2 text-xs text-red-600">{nameError}</p>}

          <button
            type="button"
            onClick={handleNameSubmit}
            className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Start session
          </button>
        </div>
      </div>
    );
  }

  const renderItemCard = (item: PublicItemSummaryResponse) => {
    const cartItem = cart?.items.find((ci) => ci.item_id === item.id);
    const qtyInCart = cartItem?.quantity ?? 0;
    const isAdding = addingItemId === item.id;

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
          <div className="flex-1">
            <p className="font-semibold text-sm">{item.name}</p>
            {item.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                {item.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-1">
            <span className="font-bold text-sm text-orange-600">
              ${item.price.toFixed(2)}
            </span>

            {!item.is_available ? (
              <span className="text-xs text-gray-400">Unavailable</span>
            ) : qtyInCart > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    qtyInCart > 1
                      ? updateItem(item.id, qtyInCart - 1)
                      : removeItem(item.id)
                  }
                  className="w-7 h-7 flex items-center justify-center rounded-full border hover:bg-gray-100 transition-colors text-sm font-bold"
                  aria-label="Decrease"
                >
                  -
                </button>
                <span className="text-sm font-semibold w-5 text-center">
                  {qtyInCart}
                </span>
                <button
                  onClick={() => updateItem(item.id, qtyInCart + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors text-sm font-bold"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                disabled={isAdding || !sessionReady}
                onClick={() => handleAddToCart(item.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-full text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {menu.restaurant.logo_url && (
              <img
                src={menu.restaurant.logo_url}
                alt={menu.restaurant.name}
                className="h-9 w-9 rounded-full object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-sm leading-tight">
                {menu.restaurant.name}
              </p>
              {tableNumber && (
                <p className="text-xs text-gray-500">Table {tableNumber}</p>
              )}
            </div>
          </div>

          <div className="ml-2 flex items-center gap-2">
            {guestName && (
              <div className="max-w-[120px] text-right sm:max-w-[180px]">
                <p className="truncate text-sm font-extrabold leading-tight text-orange-600 sm:text-base">
                  {guestName}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Guest
                </p>
              </div>
            )}

            <button
              onClick={() => setCartOpen(true)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-gray-100"
              aria-label="Open cart"
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
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {(cart?.item_count ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-xs font-bold text-white">
                  {cart!.item_count}
                </span>
              )}
            </button>

            {restaurantId && tableNumber && (
              <Link
                to={
                  qrAccessKey
                    ? `/orders/my/${restaurantId}/${tableNumber}?k=${encodeURIComponent(qrAccessKey)}`
                    : `/orders/my/${restaurantId}/${tableNumber}`
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-orange-600 transition-colors hover:bg-orange-100"
                aria-label="View my orders"
                title="View my orders"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Category tabs */}
        {menu.categories.length > 1 && (
          <div className="max-w-2xl mx-auto flex gap-1 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {menu.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
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
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-6">
        {activeCategory && (
          <section>
            {activeCategory.description && (
              <p className="text-sm text-gray-500 mb-4">
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
                  <div>
                    {visibleSubcategories.length > 0 && (
                      <h2 className="text-sm font-semibold text-gray-700 mb-3">
                        Other items
                      </h2>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeCategory.items.map(renderItemCard)}
                    </div>
                  </div>
                )}

                {visibleSubcategories.map((subcategory) => (
                  <div key={subcategory.id}>
                    <h2 className="text-sm font-semibold text-gray-800">
                      {subcategory.name}
                    </h2>
                    {subcategory.description && (
                      <p className="text-xs text-gray-500 mt-1 mb-3">
                        {subcategory.description}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
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
      {(cart?.item_count ?? 0) > 0 && !cartOpen && (
        <div className="fixed bottom-4 left-0 right-0 px-4 z-30">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full max-w-2xl mx-auto flex items-center justify-between bg-orange-500 text-white px-5 py-3 rounded-2xl shadow-lg hover:bg-orange-600 transition-colors"
          >
            <span className="font-semibold">
              {cart!.item_count} item{cart!.item_count !== 1 ? "s" : ""} in cart
            </span>
            <span className="font-bold">${cart!.total.toFixed(2)}</span>
          </button>
        </div>
      )}

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
    </div>
  );
}
