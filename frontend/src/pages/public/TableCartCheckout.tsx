import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  Pencil,
  Plus,
  Receipt,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";

import {
  getGuestDisplayName,
  getGuestQrAccessKey,
  setGuestQrAccessKey,
} from "@/hooks/useGuestSession";
import {
  fetchGuestSessionJson,
} from "@/features/public/tableSession";
import { useLocalTableCart } from "@/hooks/useLocalMenuCart";
import { toAssetUrl } from "@/lib/assets";
import { publicGet } from "@/lib/publicApi";
import type { CartItemResponse } from "@/types/cart";
import type { PublicItemSummaryResponse, PublicMenuResponse } from "@/types/publicMenu";

type MenuItemWithCategory = PublicItemSummaryResponse & {
  categoryName: string | null;
};

type AppliedCoupon = {
  code: string;
  discountPercent: number;
};

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildMenuItems(menu: PublicMenuResponse | null): MenuItemWithCategory[] {
  if (!menu) return [];

  return menu.categories.flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      categoryName: category.name,
    })),
  );
}

function getItemImage(item: MenuItemWithCategory | undefined): string | undefined {
  return toAssetUrl(item?.image_path);
}

export default function TableCartCheckout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { restaurantId, tableNumber } = useParams<{
    restaurantId: string;
    tableNumber: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";
  const restaurantIdNumber = restaurantId ? Number(restaurantId) : Number.NaN;
  const restaurantContextId = Number.isNaN(restaurantIdNumber) ? null : restaurantIdNumber;

  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(() => new Set());
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);
  const [billRequested, setBillRequested] = useState(false);

  const customerName =
    restaurantContextId && tableNumber
      ? getGuestDisplayName(restaurantContextId, tableNumber)
      : null;
  const effectiveQrAccessKey =
    qrAccessKey || (
      restaurantContextId && tableNumber
        ? getGuestQrAccessKey(restaurantContextId, tableNumber) ?? ""
        : ""
    );
  const { cart, addItem, updateItem, removeItem, clearCart, placeOrder, placing } =
    useLocalTableCart({
      restaurantId: restaurantContextId,
      tableNumber: tableNumber ?? null,
      qrAccessKey: effectiveQrAccessKey,
      menu,
      customerName,
    });

  const menuItems = useMemo(() => buildMenuItems(menu), [menu]);
  const itemById = useMemo(() => {
    return new Map(menuItems.map((item) => [item.id, item]));
  }, [menuItems]);

  const cartItems = cart?.items ?? [];
  const itemCount = cart?.item_count ?? 0;
  const subtotal = cart?.total ?? 0;
  const discount = appliedCoupon
    ? roundCurrency(subtotal * appliedCoupon.discountPercent / 100)
    : 0;
  const taxesAndCharges = 0;
  const grandTotal = Math.max(roundCurrency(subtotal + taxesAndCharges - discount), 0);

  const recommendations = useMemo(() => {
    const cartItemIds = new Set(cartItems.map((item) => item.item_id));
    return menuItems
      .filter((item) => item.is_available && !cartItemIds.has(item.id))
      .slice(0, 10);
  }, [cartItems, menuItems]);

  const menuPath = useMemo(() => {
    if (!restaurantId || !tableNumber) return "/";
    const base = `/menu/${restaurantId}/table/${tableNumber}`;
    return qrAccessKey ? `${base}?k=${encodeURIComponent(qrAccessKey)}` : base;
  }, [qrAccessKey, restaurantId, tableNumber]);

  useEffect(() => {
    if (!restaurantId || !tableNumber) {
      setPageError("Invalid table context. Please scan the table QR code again.");
      return;
    }

    const parsedRestaurantId = Number(restaurantId);
    if (Number.isNaN(parsedRestaurantId)) {
      setPageError("Invalid restaurant context. Please scan the table QR code again.");
      return;
    }

    if (qrAccessKey) {
      setGuestQrAccessKey(parsedRestaurantId, tableNumber, qrAccessKey);
    }

    if (!qrAccessKey && !getGuestQrAccessKey(parsedRestaurantId, tableNumber)) {
      setPageError("Could not load your cart. Please go back to the menu and scan again.");
      return;
    }

    setSessionReady(true);
  }, [qrAccessKey, restaurantId, tableNumber]);

  useEffect(() => {
    if (!restaurantId) return;

    const loadMenu = async () => {
      try {
        const data = await publicGet<PublicMenuResponse>(
          `/public/restaurants/${restaurantId}/menu`,
        );
        setMenu(data);
      } catch {
        setPageError("Failed to load menu details. Please try again.");
      }
    };

    void loadMenu();
  }, [restaurantId]);

  useEffect(() => {
    if (itemCount === 0) {
      setAppliedCoupon(null);
      setCouponError(null);
    }
  }, [itemCount]);

  const toggleDetails = useCallback((itemId: number) => {
    setExpandedItems((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleApplyCoupon = useCallback(async () => {
    const code = couponInput.trim();
    if (!code) {
      setCouponError("Enter a coupon code.");
      setAppliedCoupon(null);
      return;
    }

    setApplyingCoupon(true);
    setCouponError(null);
    setAppliedCoupon({ code, discountPercent: 0 });
    setCouponInput(code);
    setApplyingCoupon(false);
  }, [couponInput]);

  const handleAddRecommendation = useCallback(
    async (itemId: number) => {
      setAddingItemId(itemId);
      try {
        await addItem(itemId, 1);
      } finally {
        setAddingItemId(null);
      }
    },
    [addItem],
  );

  const handlePlaceOrder = useCallback(async () => {
    if (!restaurantId || !tableNumber || itemCount <= 0) return;

    try {
      await placeOrder(
        appliedCoupon ? { promo_code: appliedCoupon.code } : {},
      );
      
      setShowSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to place order.";
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
        setPlaceError("Your session has expired. Please go back to the menu or scan the QR code again.");
      } else {
        setPlaceError(msg);
      }
    }
  }, [appliedCoupon, itemCount, placeOrder, restaurantId, tableNumber]);

  const handleRequestBill = useCallback(async () => {
    setRequestingBill(true);
    try {
      await fetchGuestSessionJson("/table-sessions/my/request-bill", {
        method: "POST",
      });
      setBillRequested(true);
    } catch (err) {
      console.error("Failed to request bill:", err);
      // For now, don't show error to user, just log
    } finally {
      setRequestingBill(false);
    }
  }, []);

  const renderImage = (item: MenuItemWithCategory | undefined, name: string) => {
    const imageUrl = getItemImage(item);
    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      );
    }

    return (
      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-orange-50 via-white to-emerald-50 text-orange-300">
        <UtensilsCrossed className="h-6 w-6" />
      </div>
    );
  };

  const renderCartItem = (item: CartItemResponse) => {
    const menuItem = itemById.get(item.item_id);
    const expanded = expandedItems.has(item.item_id);

    return (
      <article
        key={item.item_id}
        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.06)]"
      >
        <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-3">
          <div className="h-[5.25rem] w-[5.25rem] overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
            {renderImage(menuItem, item.name)}
          </div>

          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="line-clamp-2 text-sm font-bold leading-tight text-slate-900">
                  {item.name}
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {formatCurrency(item.unit_price)} each
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.item_id)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-500 transition hover:bg-red-100"
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {!item.is_available && (
              <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600">
                Currently unavailable
              </p>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() =>
                    item.quantity > 1
                      ? updateItem(item.item_id, item.quantity - 1)
                      : removeItem(item.item_id)
                  }
                  className="grid h-8 w-8 place-items-center rounded-full text-slate-600 transition hover:bg-white"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-7 text-center text-sm font-bold text-slate-900">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateItem(item.item_id, item.quantity + 1)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="text-sm font-black text-slate-900">
                {formatCurrency(item.line_total)}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleDetails(item.item_id)}
          className="mt-3 flex min-h-10 w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
        >
          Product details
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="mt-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
            <p>{menuItem?.description?.trim() || "No additional details available."}</p>
            {menuItem?.categoryName && (
              <p className="mt-1 font-semibold text-slate-500">Category: {menuItem.categoryName}</p>
            )}
          </div>
        )}
      </article>
    );
  };

  if (pageError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-5 text-center">
        <div className="w-full max-w-sm rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-red-600">{pageError}</p>
          <button
            type="button"
            onClick={() => navigate(menuPath)}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white"
          >
            Back to menu
          </button>
        </div>
      </div>
    );
  }

  if (!menu || !sessionReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <p className="animate-pulse text-sm text-slate-500">Loading cart...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#fffaf5_0%,#f8fafc_34%,#eef7f3_100%)] text-slate-900">
      {/* Success Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="mx-auto w-full max-w-sm px-4 text-center animate-in zoom-in-95 duration-500">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200">
              <Check className="h-10 w-10 stroke-[3]" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Order Confirmed!</h2>
            <p className="mt-2 text-slate-500">Your order has been placed successfully.</p>
            
            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={requestingBill || billRequested}
                onClick={handleRequestBill}
                className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black transition-all duration-300 active:scale-95 ${
                  billRequested
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    : "bg-slate-900 text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] hover:bg-slate-800"
                }`}
              >
                {requestingBill ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Processing...
                  </span>
                ) : billRequested ? (
                  <>
                    <Check className="h-4 w-4" />
                    Bill Requested
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4" />
                    Request Bill
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  if (!restaurantId || !tableNumber) {
                    navigate("/");
                    return;
                  }
                  const base = `/orders/my/${restaurantId}/${tableNumber}`;
                  const finalPath = effectiveQrAccessKey 
                    ? `${base}?k=${encodeURIComponent(effectiveQrAccessKey)}` 
                    : base;
                  navigate(finalPath);
                }}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-black text-white shadow-[0_14px_28px_rgba(249,115,22,0.28)] transition hover:bg-orange-600 active:scale-95"
              >
                View My Orders
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-md items-center gap-3 px-4 py-2">
          <button
            type="button"
            onClick={() => navigate(menuPath)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-900 transition hover:bg-slate-200"
            aria-label="Back to menu"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-900">
              {itemCount} item{itemCount === 1 ? "" : "s"} in cart
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              Payable {formatCurrency(grandTotal)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setEditMode((current) => !current)}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editMode ? "Done" : "Edit"}
          </button>
        </div>

        {editMode && itemCount > 0 && (
          <div className="mx-auto flex w-full max-w-md justify-end px-4 pb-3">
            <button
              type="button"
              onClick={clearCart}
              className="min-h-9 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-bold text-red-600 transition hover:bg-red-100"
            >
              Clear cart
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4 pb-40">
        <section className="space-y-3">
          {cartItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-bold text-slate-900">Your cart is empty</p>
              <button
                type="button"
                onClick={() => navigate(menuPath)}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600"
              >
                Browse menu
              </button>
            </div>
          ) : (
            cartItems.map(renderCartItem)
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Frequently Bought Together</h2>
              <p className="mt-0.5 text-xs text-slate-500">Quick add-ons for this order</p>
            </div>
            <Sparkles className="h-5 w-5 text-orange-500" />
          </div>

          {recommendations.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs font-semibold text-slate-500">
              No add-ons available right now.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 pb-1">
              <div className="grid auto-cols-[9.75rem] grid-flow-col gap-3">
                {recommendations.map((item) => (
                  <article
                    key={item.id}
                    className="flex min-h-[14.5rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
                  >
                    <div className="h-24 bg-slate-50">
                      {renderImage(item, item.name)}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <h3 className="line-clamp-2 min-h-9 text-xs font-bold leading-4 text-slate-900">
                        {item.name}
                      </h3>
                      <p className="mt-2 text-sm font-black text-orange-600">
                        {formatCurrency(item.price)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAddRecommendation(item.id)}
                        disabled={addingItemId === item.id}
                        className="mt-auto inline-flex min-h-9 w-full items-center justify-center rounded-xl bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        {addingItemId === item.id ? "ADDING" : "ADD"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-[0_10px_26px_rgba(120,53,15,0.06)]">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-amber-600 shadow-sm">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Apply coupon</h2>
              {appliedCoupon && (
                <p className="text-xs font-semibold text-emerald-700">
                  {appliedCoupon.discountPercent > 0
                    ? `${appliedCoupon.code} gives ${appliedCoupon.discountPercent}% off`
                    : `${appliedCoupon.code} will be validated at checkout`}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={couponInput}
              onChange={(event) => {
                setCouponInput(event.target.value.toUpperCase());
                setCouponError(null);
              }}
              className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 text-sm font-semibold uppercase text-slate-900 outline-none transition placeholder:normal-case placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              placeholder="Coupon code"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={applyingCoupon || itemCount === 0}
              className="min-h-11 rounded-xl bg-amber-500 px-4 text-xs font-black text-white transition hover:bg-amber-600 disabled:opacity-60"
            >
              {applyingCoupon ? "..." : "Apply"}
            </button>
          </div>

          {couponError && <p className="mt-2 text-xs font-semibold text-red-600">{couponError}</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
          <h2 className="mb-3 text-base font-black text-slate-900">Order Summary</h2>
          <div className="space-y-2 text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span>Sub total</span>
              <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Discount</span>
              <span className="font-semibold text-emerald-700">-{formatCurrency(discount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Taxes / charges</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(taxesAndCharges)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-base font-black text-slate-900">
            <span>Grand total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
        </section>

        {placeError && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600">
            {placeError}
          </p>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/95 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Payable
            </p>
            <p key={grandTotal} className="text-lg font-black text-slate-900 animate-pop-in">{formatCurrency(grandTotal)}</p>
          </div>
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={placing || itemCount === 0}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-orange-500 px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(249,115,22,0.28)] transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
          >
            {placing ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Placing...
              </span>
            ) : (
              "Place Order"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
