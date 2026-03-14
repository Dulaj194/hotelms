import DashboardLayout from "@/components/shared/DashboardLayout";

export default function SubscriptionPaymentCancel() {
  return (
    <DashboardLayout>
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Payment Cancelled</h1>
        <p className="mt-4 text-sm text-gray-700">
          The checkout was cancelled. You can select a package and try again.
        </p>
        <a
          href="/admin/subscription"
          className="mt-6 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Back to Subscription
        </a>
      </div>
    </DashboardLayout>
  );
}
