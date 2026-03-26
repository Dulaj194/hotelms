import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CartDrawer from "@/components/shared/CartDrawer";
import { useCart } from "@/hooks/useCart";
import { getGuestToken, setGuestSession } from "@/hooks/useGuestSession";
import { publicGet, publicPost } from "@/lib/publicApi";
import type {
  PublicItemSummaryResponse,
  PublicMenuResponse,
} from "@/types/publicMenu";
import type { TableSessionStartResponse } from "@/types/session";

export default function TableMenu() {
  const { restaurantId, tableNumber } = useParams<{
    restaurantId: string;
    tableNumber: string;
  }>();
  const navigate = useNavigate();

  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);

  const { cart, addItem, updateItem, removeItem, clearCart, placeOrder, refetch } =
    useCart();

  // 1. Start (or reuse) a guest session
  useEffect(() => {
    if (!restaurantId || !tableNumber) return;

    const init = async () => {
      try {
        // Re-use existing token if already present
        if (!getGuestToken()) {
          const session = await publicPost<TableSessionStartResponse>(
            "/table-sessions/start",
            {
              restaurant_id: Number(restaurantId),
              table_number: tableNumber,
            }
          );
          setGuestSession(session);
        }
        setSessionReady(true);
      } catch {
        setPageError("Could not start a guest session. Please scan the QR code again.");
      }
    };

    void init();
  }, [restaurantId, tableNumber]);

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
    navigate(`/menu/${restaurantId}/table/${tableNumber}/order/${orderId}`);
    return orderId;
  }, [placeOrder, navigate, restaurantId, tableNumber]);

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
              {tableNumber && (
                <p className="text-xs text-gray-500">Table {tableNumber}</p>
              )}
            </div>
          </div>

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
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {cart!.item_count}
              </span>
            )}
          </button>
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
