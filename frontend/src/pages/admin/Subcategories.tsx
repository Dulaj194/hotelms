import DashboardLayout from "@/components/shared/DashboardLayout";

/**
 * Subcategories page - DEPRECATED
 * This feature has been removed. Items are now organized only by category.
 * This file is kept for backwards compatibility but is no longer routed.
 */
export default function Subcategories() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subcategories</h1>
          <p className="text-sm text-gray-500 mt-2">This feature has been removed.</p>
          <p className="text-xs text-gray-400 mt-1">
            Items are now organized only by category. Please use the Categories page to manage your menu structure.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}