import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Minus,
  Pencil,
  Plus,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  UtensilsCrossed,
  MessageSquareText,
  AlertTriangle,
} from "lucide-react";

import { useTranslation } from "react-i18next";
import {
  getRoomGuestDisplayName,
  getRoomToken,
  setRoomSessionToken,
} from "@/hooks/useRoomSession";
import { useLocalRoomCart } from "@/hooks/useLocalMenuCart";
import SafeMenuAsset from "@/components/public/SafeMenuAsset";
import ItemDetailSheet from "@/components/public/ItemDetailSheet";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { publicGet, publicPost } from "@/lib/publicApi";
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


export default function RoomCartCheckout() {
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

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [editMode, setEditMode] = useState(false);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PublicItemSummaryResponse | null>(null);

  const customerName =
    restaurantContextId && roomNumber
      ? getRoomGuestDisplayName(restaurantContextId, roomNumber)
      : null;
  const effectiveQrAccessKey =
    qrAccessKey || (
      restaurantContextId && roomNumber
        ? getRoomToken(restaurantContextId, roomNumber) ?? ""
        : ""
    );
  const { cart, addItem, updateItem, removeItem, clearCart, placeOrder, placing } =
    useLocalRoomCart({
      restaurantId: restaurantContextId,
      roomId: null,
      roomNumber: roomNumber ?? null,
      qrAccessKey: effectiveQrAccessKey,
      menu,
      customerName,
    });

  const menuItems = useMemo(() => buildMenuItems(menu), [menu]);
  const itemById = useMemo(() => {
    return new Map(menuItems.map((item) => [item.id, item]));
  }, [menuItems]);

  const cartItems = cart?.items ?? [];
  const hasUnavailableItems = useMemo(() => {
    return cartItems.some((item) => !item.is_available);
  }, [cartItems]);
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
    if (!restaurantId || !roomNumber) return "/";
    const base = `/menu/${restaurantId}/room/${roomNumber}`;
    return qrAccessKey ? `${base}?k=${encodeURIComponent(qrAccessKey)}` : base;
  }, [qrAccessKey, restaurantId, roomNumber]);

  useEffect(() => {
    if (!restaurantId || !roomNumber) {
      setPageError(t("cart:invalid_room_context"));
      return;
    }

    const parsedRestaurantId = Number(restaurantId);
    if (Number.isNaN(parsedRestaurantId)) {
      setPageError(t("cart:invalid_restaurant_context"));
      return;
    }

    if (qrAccessKey) {
      setRoomSessionToken(qrAccessKey);
    }

    if (!qrAccessKey && !getRoomToken()) {
      setPageError(t("cart:could_not_restore_session"));
      return;
    }

    setSessionReady(true);
  }, [qrAccessKey, restaurantId, roomNumber]);

  useEffect(() => {
    if (!restaurantId) return;

    const loadMenu = async () => {
      try {
        const data = await publicGet<PublicMenuResponse>(
          `/public/restaurants/${restaurantId}/menu`,
        );
        setMenu(data);
      } catch {
        setPageError(t("menu:load_error"));
      }
    };

    void loadMenu();
  }, [restaurantId, currentLanguage]);

  useEffect(() => {
    if (itemCount === 0) {
      setAppliedCoupon(null);
      setCouponError(null);
    }
  }, [itemCount]);


  const handleApplyCoupon = useCallback(async () => {
    const code = couponInput.trim();
    if (!code) {
      setCouponError(t("cart:enter_coupon_error"));
      setAppliedCoupon(null);
      return;
    }

    if (!restaurantId) {
      setCouponError(t("cart:invalid_restaurant_context"));
      return;
    }

    setApplyingCoupon(true);
    setCouponError(null);
    try {
      type PromoCodeValidationResponse = {
        valid: boolean;
        message: string;
        code?: string;
        discount_percent?: number;
      };

      const result = await publicPost<PromoCodeValidationResponse>(
        `/public/restaurants/${restaurantId}/coupon/validate`,
        { code },
      );

      if (result.valid) {
        setAppliedCoupon({
          code: result.code ?? code,
          discountPercent: result.discount_percent ?? 0,
        });
        setCouponInput(result.code ?? code);
      } else {
        setCouponError(result.message || t("cart:invalid_coupon"));
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : t("cart:failed_apply_coupon"));
      setAppliedCoupon(null);
    } finally {
      setApplyingCoupon(false);
    }
  }, [couponInput, restaurantId, t]);

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
    if (!restaurantId || !roomNumber || itemCount <= 0) return;

    if (hasUnavailableItems) {
      setPlaceError(t("cart:remove_unavailable_items_error", "Please remove unavailable items from your cart before placing the order."));
      return;
    }

    try {
      await placeOrder();
      
      setShowSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("cart:failed_place_order");
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
        setPlaceError(t("cart:session_expired_checkout"));
      } else {
        setPlaceError(msg);
      }
    }
  }, [appliedCoupon, itemCount, placeOrder, restaurantId, roomNumber, hasUnavailableItems, t]);

  const renderImage = (path: string | undefined | null, name: string) => {
    return (
      <SafeMenuAsset
        path={path}
        alt={name}
        className="h-full w-full object-cover"
        fallback={
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-orange-50 via-white to-emerald-50 text-orange-300">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
        }
      />
    );
  };

  const renderCartItem = (item: CartItemResponse) => {
    const menuItem = itemById.get(item.item_id);

    return (
      <article
        key={item.item_id}
        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.06)]"
      >
        <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-3">
          <div className="h-[5.25rem] w-[5.25rem] overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
            {renderImage(item.image_path, item.name)}
          </div>

          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="line-clamp-2 text-sm font-bold leading-tight text-slate-900">
                  {item.name}
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {formatCurrency(item.unit_price)} {t("cart:each")}
                </p>
                {item.note && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium leading-relaxed text-orange-600 bg-orange-50/50 p-2 rounded-lg border border-orange-100/50">
                    <MessageSquareText className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{t("cart:note")}: {item.note}</span>
                  </p>
                )}
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
                {t("cart:unavailable")}
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
          onClick={() => setSelectedItem(menuItem ?? null)}
          className="mt-3 flex min-h-10 w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
        >
          {t("cart:view_details")}
          <ChevronRight className="h-4 w-4" />
        </button>
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
            <h2 className="text-2xl font-black text-slate-900">{t("cart:order_placed")}</h2>
            <p className="mt-4 text-slate-500">{t("cart:order_sent")}</p>
            <button
              type="button"
              onClick={() => {
                const path = `/orders/my/${restaurantId}/${roomNumber}`;
                navigate(qrAccessKey ? `${path}?k=${encodeURIComponent(qrAccessKey)}` : path);
              }}
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-8 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-95"
            >
              {t("cart:okay")}
            </button>
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

          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => setEditMode((current) => !current)}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              {editMode ? "Done" : "Edit"}
            </button>
          </div>
        </div>

        {editMode && itemCount > 0 && (
          <div className="mx-auto flex w-full max-w-md justify-end px-4 pb-3">
            <button
              type="button"
              onClick={clearCart}
              className="min-h-9 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-bold text-red-600 transition hover:bg-red-100"
            >
              {t("cart:clear_cart")}
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4 pb-40">
        {hasUnavailableItems && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4 shadow-[0_10px_26px_rgba(220,38,38,0.06)] animate-in slide-in-from-top-4 duration-300">
            <div className="mt-0.5 grid h-6 w-6 place-items-center rounded-lg bg-red-100 text-red-600">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-red-900">{t("cart:unavailable_items_title", "Action Required")}</h3>
              <p className="mt-1 text-xs font-semibold text-red-600 leading-relaxed">
                {t("cart:unavailable_items_desc", "Some items in your cart are currently out of stock or unavailable. Please remove them to proceed with your order.")}
              </p>
            </div>
          </div>
        )}
        <section className="space-y-3">
          {cartItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-bold text-slate-900">{t("cart:empty")}</p>
              <button
                type="button"
                onClick={() => navigate(menuPath)}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600"
              >
                {t("cart:continue_browsing")}
              </button>
            </div>
          ) : (
            cartItems.map(renderCartItem)
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">{t("cart:frequently_bought_together")}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{t("cart:quick_addons")}</p>
            </div>
            <Sparkles className="h-5 w-5 text-orange-500" />
          </div>

          {recommendations.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs font-semibold text-slate-500">
              {t("cart:no_addons")}
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
                      {renderImage(item.image_path, item.name)}
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
                        {addingItemId === item.id ? t("cart:adding") : t("cart:add")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Coupon section removed as it's not supported for rooms yet */}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
          <h2 className="mb-3 text-base font-black text-slate-900">{t("cart:order_summary")}</h2>
          <div className="space-y-2 text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span>{t("cart:subtotal")}</span>
              <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{t("cart:discount")}</span>
              <span className="font-semibold text-emerald-700">-{formatCurrency(discount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{t("cart:taxes_charges")}</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(taxesAndCharges)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-base font-black text-slate-900">
            <span>{t("cart:grand_total")}</span>
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
              {t("cart:payable")}
            </p>
            <p key={grandTotal} className="text-lg font-black text-slate-900 animate-pop-in">{formatCurrency(grandTotal)}</p>
          </div>
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={placing || itemCount === 0 || hasUnavailableItems}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-orange-500 px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(249,115,22,0.28)] transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
          >
            {placing ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {t("cart:placing_order")}
              </span>
            ) : (
              t("cart:place_order")
            )}
          </button>
        </div>
      </div>

      <ItemDetailSheet
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onAddToCart={async (id, qty, note) => {
          await addItem(id, qty, note);
        }}
        qtyInCart={cart?.items.find(i => i.item_id === selectedItem?.id)?.quantity ?? 0}
        formatPrice={formatCurrency}
      />
    </div>
  );
}
