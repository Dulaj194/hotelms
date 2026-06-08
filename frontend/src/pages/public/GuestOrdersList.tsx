import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowLeft,
  CheckCircle,
  Plus,
  Receipt,
  ChevronDown,
  ChevronUp,
  ClipboardList, 
  CheckCircle2, 
  ChefHat, 
  BellRing, 
  Utensils, 
  CreditCard,
  XCircle 
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getGuestToken,
} from "@/hooks/useGuestSession";
import { isSessionHttpError } from "@/features/public/sessionHttp";
import {
  fetchGuestSessionJson,
  resolveTableGuestName,
  resolveTableQrAccessKey,
  restoreTableGuestSession,
} from "@/features/public/tableSession";
import type { OrderHeaderResponse, OrderStatus } from "@/types/order";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/types/order";
import { toAssetUrl } from "@/lib/assets";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";


type OrdersFilterTab = "active" | "completed" | "canceled";

const TAB_TO_STATUSES: Record<OrdersFilterTab, OrderHeaderResponse["status"][]> = {
  active: ["pending", "confirmed", "processing"],
  completed: ["completed", "served", "paid"],
  canceled: ["rejected"],
};

const LIFECYCLE_STEPS: Array<{ status: OrderStatus; label: string }> = [
  { status: "pending", label: "Order placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "processing", label: "Being prepared" },
  { status: "completed", label: "Ready" },
  { status: "served", label: "Served" },
  { status: "paid", label: "Paid" },
];

function OrderTimeline({ status, t }: { status: OrderStatus; t: any }) {
  if (status === "rejected") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-700 shadow-sm backdrop-blur-md mb-4 mx-2">
        <XCircle className="h-6 w-6 text-red-500" />
        <span className="text-sm font-semibold">{t("cart:order_rejected_timeline", "Order Rejected")}</span>
      </div>
    );
  }

  const statusIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === status);
  
  const ICONS: Record<string, React.ElementType> = {
    pending: ClipboardList,
    confirmed: CheckCircle2,
    processing: ChefHat,
    completed: BellRing,
    served: Utensils,
    paid: CreditCard,
  };

  return (
    <div className="relative w-full pb-4 pt-2 mb-4 bg-white rounded-3xl border border-slate-100/60 p-4 shadow-sm">
      <div className="w-full relative">
        <div className="absolute top-[15px] sm:top-[21px] left-[1rem] right-[1rem] sm:left-[2rem] sm:right-[2rem]">
          <div className="w-full h-[2px] bg-slate-100 absolute top-0" />
          <div 
            className="absolute top-0 left-0 h-[3px] bg-gradient-to-r from-orange-400 to-emerald-400 transition-all duration-700 ease-out rounded-full" 
            style={{ width: `${(Math.max(0, statusIndex) / (LIFECYCLE_STEPS.length - 1)) * 100}%` }}
          />
        </div>
        
        <ol className="relative z-10 flex justify-between w-full">
          {LIFECYCLE_STEPS.map((step, idx) => {
            const passed = idx < statusIndex;
            const current = idx === statusIndex;
            const Icon = ICONS[step.status] || ClipboardList;
            
            let displayLabel = step.label;
            if (step.status === "pending") displayLabel = t("cart:order_placed_timeline", "Placed");
            else if (step.status === "confirmed") displayLabel = t("cart:confirmed_timeline", "Confirmed");
            else if (step.status === "processing") displayLabel = t("cart:being_prepared_timeline", "Preparing");
            else if (step.status === "completed") displayLabel = t("cart:ready_timeline", "Ready");
            else if (step.status === "served") displayLabel = t("cart:served_timeline", "Served");
            else if (step.status === "paid") displayLabel = t("cart:paid_timeline", "Paid");

            return (
              <li key={step.status} className="group flex flex-col items-center gap-1.5 sm:gap-3 relative w-10 sm:w-16">
                <div
                  className={`relative flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full transition-all duration-500 z-10 ${
                    passed
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : current
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40 ring-4 ring-orange-100 scale-110"
                      : "bg-white text-slate-400 border-2 border-slate-100"
                  }`}
                >
                  {current && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                  )}
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${current ? 'scale-110' : ''}`} strokeWidth={current ? 2.5 : 2} />
                </div>
                <span
                  className={`text-[9px] sm:text-[11px] leading-tight text-center transition-all duration-300 ${
                    current
                      ? "font-bold text-slate-900 scale-105"
                      : passed
                      ? "font-semibold text-slate-600"
                      : "font-medium text-slate-400"
                  }`}
                >
                  {displayLabel}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

const POLL_INTERVAL_MS = 5_000;

interface OrderCardProps {
  order: OrderHeaderResponse;
  tab: OrdersFilterTab;
  getItemImageUrl: (path: string | null | undefined) => string | undefined;
  t: any;
  guestSessionName: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}

function OrderCard({
  order,
  tab,
  getItemImageUrl,
  t,
  guestSessionName,
  isExpanded,
  onToggle,
}: OrderCardProps) {
  const itemCount = order.item_previews?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  
  const formatPlacedAt = (dateString: string): string => {
    return new Date(dateString).toLocaleString([], {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  };

  const previews = order.item_previews || [];
  const imagesToShow = previews.slice(0, 3);
  const extraCount = Math.max(0, previews.length - 3);

  const displayGuestName = order.customer_name || guestSessionName;

  return (
    <div className={`overflow-hidden rounded-3xl border transition-all duration-300 shadow-sm ${isExpanded ? 'border-orange-300 ring-4 ring-orange-50/50' : 'border-slate-200 hover:border-orange-200 hover:shadow-md'} bg-white`}>
      <div 
        onClick={onToggle}
        className={`cursor-pointer p-4 transition-colors ${isExpanded ? 'bg-white' : 'hover:bg-slate-50/50'} flex flex-col gap-3 relative`}
      >
        <div className="absolute top-4 right-4 text-slate-400">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>

        <div className="flex items-start gap-3 pr-6">
          <div className="shrink-0 flex items-center pt-0.5">
            {imagesToShow.length > 0 ? (
              <div className="flex -space-x-3">
                {imagesToShow.map((preview, idx) => (
                  <div key={idx} className="relative h-12 w-12 rounded-2xl ring-2 ring-white overflow-hidden bg-slate-100 shadow-sm" style={{ zIndex: 3 - idx }}>
                    {preview.item_image_snapshot ? (
                      <img
                        src={getItemImageUrl(preview.item_image_snapshot)}
                        alt={preview.item_name_snapshot}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f1f5f9' width='100' height='100'/%3E%3C/svg%3E";
                        }}
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[8px] font-semibold text-slate-400">
                        {t("cart:no_img")}
                      </div>
                    )}
                  </div>
                ))}
                {extraCount > 0 && (
                  <div className="relative h-12 w-12 rounded-2xl ring-2 ring-white bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm z-0">
                    +{extraCount}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-slate-100 ring-2 ring-white flex items-center justify-center text-[9px] font-semibold text-slate-400 shadow-sm">
                {t("cart:no_img")}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col">
              <p className="text-sm font-black text-slate-900 sm:text-[15px]">
                Order #{order.order_number}
              </p>
              {displayGuestName && (
                <p className="text-xs font-bold text-orange-600 mt-0.5 line-clamp-1">
                  {displayGuestName}
                </p>
              )}
            </div>
            
            <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ORDER_STATUS_COLOR[order.status]}`}>
                {ORDER_STATUS_LABEL[order.status]}
              </span>
              <span className="font-medium">{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400 font-medium">
              {formatPlacedAt(order.placed_at)}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end">
             <p className="text-sm font-extrabold text-orange-600">
               ${order.total_amount.toFixed(2)}
             </p>
          </div>
        </div>

        {(tab === "completed" || tab === "canceled") && (
          <div className="flex flex-wrap gap-2 mt-2">
            {tab === "completed" && (
              <button 
                onClick={(e) => { e.stopPropagation(); }}
                className="rounded-full bg-orange-100 px-4 py-1.5 text-[12px] font-bold text-orange-600 hover:bg-orange-200 transition"
              >
                {t("cart:leave_review_btn")}
              </button>
            )}
            {tab === "canceled" && (
              <span className="rounded-full bg-orange-100 px-4 py-1.5 text-[12px] font-semibold text-orange-600">
                {t("cart:order_canceled_btn")}
              </span>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
          <OrderTimeline status={order.status} t={t} />

          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 pl-1">
            Order Items
          </p>
          <div className="flex flex-col gap-2.5">
            {previews.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/60">
                {item.item_image_snapshot ? (
                  <img 
                    src={getItemImageUrl(item.item_image_snapshot)} 
                    alt={item.item_name_snapshot}
                    className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-slate-100"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f1f5f9' width='100' height='100'/%3E%3C/svg%3E";
                    }}
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 ring-1 ring-slate-100 flex items-center justify-center text-[8px] text-slate-400 font-medium">
                    {t("cart:no_img")}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-slate-800">
                    {item.item_name_snapshot_localized || item.item_name_snapshot}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    {item.quantity} × ${(item.unit_price_snapshot).toFixed(2)}
                  </p>
                </div>
                <div className="shrink-0 text-[13px] font-black text-slate-800 pr-1">
                  ${(item.quantity * item.unit_price_snapshot).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 border-t border-slate-200/60 pt-3 flex items-center justify-between px-1">
             <span className="text-xs font-bold text-slate-500">Tax</span>
             <span className="text-xs font-bold text-slate-700">${order.tax_amount.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between px-1">
             <span className="text-sm font-black text-slate-900">Total</span>
             <span className="text-sm font-black text-orange-600">${order.total_amount.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuestOrdersList() {
  const { t, i18n } = useTranslation(["common", "menu", "cart"]);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

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
  const { restaurantId, tableNumber } = useParams<{
    restaurantId: string;
    tableNumber: string;
  }>();
  const qrAccessKey = searchParams.get("k")?.trim() ?? "";
  const effectiveQrAccessKey = resolveTableQrAccessKey(restaurantId, tableNumber, qrAccessKey);
  const [sessionReady, setSessionReady] = useState(Boolean(getGuestToken()));
  const guestName = resolveTableGuestName(restaurantId, tableNumber);

  const [orders, setOrders] = useState<OrderHeaderResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingBill, setRequestingBill] = useState(false);
  const [billRequested, setBillRequested] = useState(false);
  const [activeTab, setActiveTab] = useState<OrdersFilterTab>("active");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const [showBillPopup, setShowBillPopup] = useState(false);

  const restoreGuestSession = useCallback(async (): Promise<boolean> => {
    const restored = await restoreTableGuestSession({
      restaurantId,
      tableNumber,
      qrAccessKey: effectiveQrAccessKey,
      guestName,
    });
    if (restored) {
      setSessionReady(true);
      setError(null);
    }
    return restored;
  }, [effectiveQrAccessKey, guestName, restaurantId, tableNumber]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchGuestSessionJson<{ orders: OrderHeaderResponse[]; total: number }>(
        "/orders/my",
      );
      setOrders(data.orders);
    } catch (err) {
      if (isSessionHttpError(err, 401)) {
        const restored = await restoreGuestSession();
        if (restored) {
          try {
            const retried = await fetchGuestSessionJson<{
              orders: OrderHeaderResponse[];
              total: number;
            }>("/orders/my");
            setOrders(retried.orders);
            return;
          } catch (retryErr) {
            setError(retryErr instanceof Error ? retryErr.message : "Could not load orders.");
            return;
          }
        }

        setError(t("cart:session_expired_checkout"));
        return;
      }

      setError(err instanceof Error ? err.message : t("cart:failed_place_order"));
    } finally {
      setLoading(false);
    }
  }, [restoreGuestSession, t]);

  useEffect(() => {
    if (getGuestToken()) {
      setSessionReady(true);
      return;
    }

    if (!restaurantId || !tableNumber || !effectiveQrAccessKey || !guestName) {
      setError(t("cart:session_expired_checkout"));
      return;
    }

    const restoreSession = async () => {
      const restored = await restoreGuestSession();
      if (!restored) {
        setError(t("cart:invalid_table_context"));
      }
    };

    void restoreSession();
  }, [effectiveQrAccessKey, guestName, restaurantId, restoreGuestSession, tableNumber, t]);

  // Initial load
  useEffect(() => {
    if (!sessionReady) return;
    void load();
  }, [load, sessionReady, currentLanguage]);

  // Poll for updates
  useEffect(() => {
    if (!sessionReady) return;
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load, sessionReady]);

  const handleRequestBill = async () => {
    setRequestingBill(true);
    try {
      await fetchGuestSessionJson("/table-sessions/my/request-bill", {
        method: "POST",
      });
      setBillRequested(true);
    } catch (err) {
      console.error("Failed to request bill:", err);
      // Even if it fails, we might want to show a message, but for now we keep it simple
    } finally {
      setRequestingBill(false);
    }
  };

  const totals = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        if (order.status !== "rejected") {
          acc.total += order.total_amount;
          acc.items += (order.item_previews ?? []).reduce((sum: number, item: any) => sum + item.quantity, 0);
        }
        return acc;
      },
      { total: 0, items: 0 },
    );
  }, [orders]);

  const aggregatedBill = useMemo(() => {
    const itemsMap = new Map<string, {
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>();

    let totalTax = 0;
    let totalAmount = 0;

    orders.filter(o => o.status !== 'rejected').forEach(order => {
      totalTax += order.tax_amount || 0;
      totalAmount += order.total_amount || 0;
      
      order.item_previews?.forEach(item => {
        const key = `${item.item_name_snapshot}-${item.unit_price_snapshot}`; 
        if (itemsMap.has(key)) {
          const existing = itemsMap.get(key)!;
          existing.quantity += item.quantity;
          existing.totalPrice += item.quantity * item.unit_price_snapshot;
        } else {
          itemsMap.set(key, {
            name: item.item_name_snapshot_localized || item.item_name_snapshot,
            quantity: item.quantity,
            unitPrice: item.unit_price_snapshot,
            totalPrice: item.quantity * item.unit_price_snapshot,
          });
        }
      });
    });

    return {
      items: Array.from(itemsMap.values()),
      totalTax,
      totalAmount,
      subtotal: totalAmount - totalTax,
    };
  }, [orders]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        // Recent first
        return new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime();
      }),
    [orders]
  );

  const tabCounts = useMemo(() => {
    return {
      active: sortedOrders.filter((order) => TAB_TO_STATUSES.active.includes(order.status)).length,
      completed: sortedOrders.filter((order) => TAB_TO_STATUSES.completed.includes(order.status)).length,
      canceled: sortedOrders.filter((order) => TAB_TO_STATUSES.canceled.includes(order.status)).length,
    };
  }, [sortedOrders]);

  const groupedOrders = useMemo(() => {
    return {
      active: sortedOrders.filter((order) => TAB_TO_STATUSES.active.includes(order.status)),
      completed: sortedOrders.filter((order) => TAB_TO_STATUSES.completed.includes(order.status)),
      canceled: sortedOrders.filter((order) => TAB_TO_STATUSES.canceled.includes(order.status)),
    };
  }, [sortedOrders]);

  const tabs: OrdersFilterTab[] = ["active", "completed", "canceled"];

  const initialTabSelectedRef = useRef(false);

  useEffect(() => {
    if (!loading && !initialTabSelectedRef.current) {
      initialTabSelectedRef.current = true;
      let targetTab: OrdersFilterTab = "active";
      if (tabCounts.active > 0) {
        targetTab = "active";
      } else if (tabCounts.completed > 0) {
        targetTab = "completed";
      } else if (tabCounts.canceled > 0) {
        targetTab = "canceled";
      }

      if (targetTab !== "active") {
        setActiveTab(targetTab);
        setTimeout(() => {
          if (scrollRef.current) {
            const targetIndex = targetTab === "completed" ? 1 : 2;
            isScrollingRef.current = true;
            scrollRef.current.scrollTo({
              left: scrollRef.current.clientWidth * targetIndex,
              behavior: "auto",
            });
            setTimeout(() => {
              isScrollingRef.current = false;
            }, 100);
          }
        }, 10);
      }
    }
  }, [loading, tabCounts.active, tabCounts.completed, tabCounts.canceled]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isScrollingRef.current) return;
    const { scrollLeft, clientWidth } = e.currentTarget;
    if (clientWidth <= 0) return;

    const index = Math.round(scrollLeft / clientWidth);
    const targetTab = tabs[index];
    if (targetTab && targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
  };

  const handleTabClick = (tab: OrdersFilterTab) => {
    const index = tabs.indexOf(tab);
    if (index === -1) return;

    setActiveTab(tab);
    setExpandedOrderId(null); // Close any expanded card when switching tabs

    if (scrollRef.current) {
      isScrollingRef.current = true;
      const width = scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({
        left: width * index,
        behavior: "smooth",
      });

      // Use a slightly longer timeout to ensure smooth scroll finishes
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 600);
    }
  };

  const emptyTabMessage: Record<OrdersFilterTab, string> = {
    active: t("cart:no_active_orders"),
    completed: t("cart:no_completed_orders"),
    canceled: t("cart:no_canceled_orders"),
  };

  const getItemImageUrl = (imagePath: string | null | undefined): string | undefined => {
    return toAssetUrl(imagePath);
  };

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <p className="animate-pulse text-sm text-slate-500">{t("cart:loading_orders")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#fff7ed_0%,#f8fafc_35%,#f8fafc_100%)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-orange-100/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-lg px-4 pb-4 pt-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const menuPath = effectiveQrAccessKey
                    ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                    : `/menu/${restaurantId}/table/${tableNumber}`;
                  navigate(menuPath);
                }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-900 transition hover:bg-slate-200"
                aria-label="Back to menu"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-xl font-black tracking-tight text-slate-900">{t("cart:my_orders")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {tableNumber && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">{t("cart:table_label", { table: tableNumber })}</span>
                  )}
                  {guestName && (
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 font-semibold text-orange-600">
                      {guestName}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <LanguageSwitcher />
          </div>


          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-orange-100 bg-white p-1.5 shadow-sm">
            {tabs.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabClick(tab)}
                  className={`rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${isActive
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-slate-600 hover:bg-orange-50 hover:text-orange-600"
                    }`}
                >
                  {t(`cart:${tab}_orders`)} ({tabCounts[tab]})
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg pb-32">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="no-scrollbar flex overflow-x-auto snap-x snap-mandatory pt-4 sm:pt-5"
        >
          {tabs.map((tab) => (
            <div key={tab} className="w-full shrink-0 snap-start px-4 sm:px-5">
              <div className="flex flex-col gap-3 pb-12 min-h-[60dvh]">
                {groupedOrders[tab].length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <p className={`text-sm font-medium text-slate-500 ${tab === 'active' && orders.length === 0 ? 'mb-4' : ''}`}>
                      {tab === 'active' && orders.length === 0 ? t("cart:no_orders_yet") : emptyTabMessage[tab]}
                    </p>
                    {tab === 'active' && orders.length === 0 && restaurantId && tableNumber && (
                      <Link
                        to={
                          effectiveQrAccessKey
                            ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                            : `/menu/${restaurantId}/table/${tableNumber}`
                        }
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-600"
                      >
                        {t("cart:place_an_order")}
                      </Link>
                    )}
                  </div>
                ) : (
                  groupedOrders[tab].map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      tab={tab}
                      getItemImageUrl={getItemImageUrl}
                      t={t}
                      guestSessionName={guestName}
                      isExpanded={expandedOrderId === order.id}
                      onToggle={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </main>


      {/* Senior Engineer Billing Dashboard - Sticky Footer */}
      {orders.length > 0 ? (
        <>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/95 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            {tabCounts.completed === 0 && (
              <div className="bg-slate-900 py-1.5 px-4">
                <p className="text-center text-[9px] font-black uppercase tracking-[0.12em] text-orange-500">
                  {t("cart:wait_bill_notice")}
                </p>
              </div>
            )}
            <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3">
              <div className="min-w-0 shrink-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {t("cart:running_bill")}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-slate-900">{formatCurrency(totals.total)}</span>
                </div>
              </div>

              <div className="flex flex-1 items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const menuPath = effectiveQrAccessKey
                      ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                      : `/menu/${restaurantId}/table/${tableNumber}`;
                    navigate(menuPath);
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-orange-100 px-3 text-xs font-black text-orange-600 transition hover:bg-orange-200 active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("cart:add_items_btn", "Add Item")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBillPopup(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-4 text-xs font-black text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 active:scale-95"
                >
                  <ChevronUp className="h-4 w-4" />
                  {t("cart:view_bill_btn", "View Bill")}
                </button>
              </div>
            </div>
          </div>

          {showBillPopup && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm sm:items-center sm:justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                  <h2 className="text-lg font-black text-slate-900">{t("cart:your_bill_title", "Your Bill")}</h2>
                  <button 
                    onClick={() => setShowBillPopup(false)}
                    className="p-2 -mr-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="overflow-y-auto p-5 space-y-4 flex-1">
                  {aggregatedBill.items.length > 0 ? (
                    <div className="space-y-3">
                      {aggregatedBill.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-slate-800">{item.quantity}x</span>
                            <span className="font-medium text-slate-600 line-clamp-2">
                              {item.name}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 shrink-0 ml-4">
                            ${item.totalPrice.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      {t("cart:no_active_orders", "No active orders right now")}
                    </div>
                  )}

                  {aggregatedBill.items.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>Subtotal</span>
                        <span>${aggregatedBill.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>Tax</span>
                        <span>${aggregatedBill.totalTax.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-5 bg-slate-50 border-t border-slate-100 space-y-4 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-900">Total Due</span>
                    <span className="text-xl font-black text-orange-600">{formatCurrency(aggregatedBill.totalAmount)}</span>
                  </div>
                  
                  <button
                    type="button"
                    disabled={requestingBill || billRequested || tabCounts.completed === 0}
                    onClick={async () => {
                      await handleRequestBill();
                      setTimeout(() => setShowBillPopup(false), 2000);
                    }}
                    className={`flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black transition-all duration-300 active:scale-95 ${billRequested
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        : tabCounts.completed === 0
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-slate-900 text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] hover:bg-slate-800"
                      }`}
                  >
                    {requestingBill ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        {t("cart:processing_btn")}
                      </span>
                    ) : billRequested ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        {t("cart:bill_requested_btn")}
                      </>
                    ) : (
                      <>
                        <Receipt className="h-4 w-4" />
                        {t("cart:request_bill_btn", "Request Bill")}
                      </>
                    )}
                  </button>
                  {tabCounts.completed === 0 && totals.total > 0 && (
                    <p className="text-center text-[11px] text-slate-500 font-medium">
                      {t("cart:wait_bill_notice", "You can request the bill after your orders are completed.")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        restaurantId && tableNumber && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-orange-100 bg-white/95 px-4 py-3 backdrop-blur sm:mx-auto sm:w-full sm:max-w-lg sm:px-5">
            <Link
              to={
                effectiveQrAccessKey
                  ? `/menu/${restaurantId}/table/${tableNumber}?k=${encodeURIComponent(effectiveQrAccessKey)}`
                  : `/menu/${restaurantId}/table/${tableNumber}`
              }
              className="block w-full rounded-2xl bg-slate-900 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
            >
              {t("cart:back_to_menu_btn")}
            </Link>
          </div>
        )
      )}
    </div>
  );
}
