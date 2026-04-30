import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import CartDrawer from "@/components/shared/CartDrawer";
import { useCart } from "@/hooks/useCart";
import { setGuestSession } from "@/hooks/useGuestSession";
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
  const [sessionReady, setSessionReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);

  const { cart, addItem, updateItem, removeItem, clearCart, placeOrder, refetch } =
    useCart();

  // 1. Start a guest session using signed table QR credential
  useEffect(() => {
    if (!restaurantId || !tableNumber) return;

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
  }, [restaurantId, tableNumber, qrAccessKey]);

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
    menu.categories.find((c) => c.id === activeCategoryId) ??
    menu.categories[0];
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
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors hover:bg-gray-100"
                  aria-label="Decrease"
                >
                  -
                </button>
                <span className="w-5 text-center text-sm font-semibold">
                  {qtyInCart}
                </span>
                <button
                  onClick={() => updateItem(item.id, qtyInCart + 1)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white transition-colors hover:bg-orange-600"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                disabled={isAdding || !sessionReady}
                onClick={() => handleAddToCart(item.id)}
                className="box-border inline-flex min-h-10 w-full max-w-full items-center justify-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50 min-[360px]:w-auto"
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
              {tableNumber && (
                <p className="text-xs text-gray-500">Table {tableNumber}</p>
              )}
            </div>
          </div>

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
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {cart!.item_count}
              </span>
            )}
          </button>
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
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        <div className="fixed bottom-4 left-0 right-0 z-30 box-border w-full max-w-full px-4">
          <button
            onClick={() => setCartOpen(true)}
            className="mx-auto box-border flex w-full max-w-[min(72rem,100%)] min-w-0 items-center justify-between gap-3 rounded-2xl bg-orange-500 px-5 py-3 text-white shadow-lg transition-colors hover:bg-orange-600"
          >
            <span className="min-w-0 truncate font-semibold">
              {cart!.item_count} item{cart!.item_count !== 1 ? "s" : ""} in cart
            </span>
            <span className="shrink-0 font-bold">${cart!.total.toFixed(2)}</span>
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
