import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { ApiError, api } from "@/lib/api";
import type { BillingTransactionListResponse } from "@/types/payment";
import type { SubscriptionStatusResponse } from "@/types/subscription";

export default function SubscriptionPaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Confirming payment...");

  useEffect(() => {
    async function load() {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1200));

        const [statusRes, historyRes] = await Promise.all([
          api.get<SubscriptionStatusResponse>("/subscriptions/me/status"),
          api.get<BillingTransactionListResponse>("/payments/history?limit=5&offset=0"),
        ]);

        const paidRecord = historyRes.items.find((item) => item.status === "paid");
        if (statusRes.is_active || paidRecord) {
          setMessage("Payment successful. Your subscription is active.");
        } else {
          setMessage("Payment received. Activation is being finalized, please refresh shortly.");
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setMessage(err.message);
        } else {
          setMessage("Payment status check failed. Please check billing history.");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const sessionId = searchParams.get("session_id");

  return (
    <DashboardLayout>
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Payment Success</h1>
        {sessionId && <p className="mt-2 text-xs text-gray-500">Session: {sessionId}</p>}
        <p className="mt-4 text-sm text-gray-700">{message}</p>
        {!loading && (
          <Link
            to="/admin/subscription"
            className="mt-6 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Back to Subscription
          </Link>
        )}
      </div>
    </DashboardLayout>
  );
}
