import { useEffect, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";

interface DiagnosticData {
  user?: { id: number; email: string; role: string; restaurant_id: number };
  restaurant?: { id: number; name: string };
  data_sample?: { menus_count: number; categories_count: number };
  backend?: { status: string; database: string; redis: string };
}

export default function DiagnosticsPanel() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const loadDiagnostics = async () => {
    setLoading(true);
    setError(null);
    console.log("[🔧 Diagnostics] Loading...");
    try {
      const result = await api.get<DiagnosticData>("/health/diagnostic");
      console.log("[🔧 Diagnostics] ✅ Loaded:", result);
      setData(result);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load diagnostics";
      console.error("[🔧 Diagnostics] ❌ Error:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">System Diagnostics</h1>
        <button
          onClick={loadDiagnostics}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
        >
          {loading ? "Refreshing..." : "🔄 Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg">
          <p className="text-red-600 text-sm font-medium">Error: {error}</p>
        </div>
      )}

      {!loading && data && (
        <div className="grid gap-6">
          {/* User Context */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">👤 Current User</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-medium">ID</p>
                <p className="text-sm font-mono text-gray-900">{data.user?.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Email</p>
                <p className="text-sm font-mono text-gray-900 truncate">{data.user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Role</p>
                <p className="text-sm font-mono text-gray-900">{data.user?.role}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Restaurant ID</p>
                <p className="text-sm font-mono text-gray-900">{data.user?.restaurant_id}</p>
              </div>
            </div>
          </div>

          {/* Restaurant Context */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">🏨 Restaurant</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-medium">ID</p>
                <p className="text-sm font-mono text-gray-900">{data.restaurant?.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Name</p>
                <p className="text-sm font-mono text-gray-900">{data.restaurant?.name}</p>
              </div>
            </div>
          </div>

          {/* Data Sample */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Data Sample</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 font-medium">Menus Count</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{data.data_sample?.menus_count}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-xs text-orange-600 font-medium">Categories Count</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">{data.data_sample?.categories_count}</p>
              </div>
            </div>
          </div>

          {/* Backend Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">🖥️ Backend Status</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  ✅ {data.backend?.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  ✅ {data.backend?.database}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Redis Cache</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  ✅ {data.backend?.redis}
                </span>
              </div>
            </div>
          </div>

          {/* Debug Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">🐛 Debug Info</h2>
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Last refresh: <span className="font-mono">{lastRefresh}</span></p>
              <p className="text-xs text-gray-500">Browser console: Open DevTools (F12) → Console tab</p>
              <p className="text-xs text-gray-500">Search logs: Filter for <span className="font-mono font-bold">[🔧 Diagnostics]</span></p>
              <button
                onClick={() => copyToClipboard(JSON.stringify(data, null, 2))}
                className="mt-3 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 transition-colors"
              >
                📋 Copy as JSON
              </button>
            </div>
          </div>

          {/* Quick Checklist */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">✅ Troubleshooting Checklist</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm text-gray-600">
                  User ID matches your login (auth working)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm text-gray-600">
                  Menus count &gt; 0? Check /admin/menus for data
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm text-gray-600">
                  All backends green? System is healthy
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600">i</span>
                <span className="text-sm text-gray-600">
                  If any count is 0, data needs to be created via admin UI
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
