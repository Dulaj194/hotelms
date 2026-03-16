import { useEffect, useMemo, useState } from "react";

import { ApiError, api } from "@/lib/api";
import type { BulkQRCodeResponse } from "@/types/publicMenu";
import type { SubscriptionPrivilegeResponse } from "@/types/subscription";

const API_ORIGIN =
  import.meta.env.VITE_BACKEND_URL ??
  (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(/\/api\/v1\/?$/, "");

export default function Tables() {
  const [start, setStart] = useState("1");
  const [end, setEnd] = useState("10");
  const [loadingPrivileges, setLoadingPrivileges] = useState(true);
  const [qrEnabled, setQrEnabled] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkQRCodeResponse | null>(null);

  useEffect(() => {
    async function loadPrivileges() {
      setLoadingPrivileges(true);
      setError(null);
      try {
        const data = await api.get<SubscriptionPrivilegeResponse>(
          "/subscriptions/me/privileges"
        );
        const privileges = new Set(data.privileges.map((item) => item.toUpperCase()));
        setQrEnabled(privileges.has("QR_MENU"));
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.detail || "Failed to load subscription privileges.");
        } else {
          setError("Failed to load subscription privileges.");
        }
      } finally {
        setLoadingPrivileges(false);
      }
    }

    void loadPrivileges();
  }, []);

  const parsedRange = useMemo(() => {
    const startNumber = Number(start);
    const endNumber = Number(end);
    const valid = Number.isInteger(startNumber) && Number.isInteger(endNumber);
    return {
      start: startNumber,
      end: endNumber,
      valid,
    };
  }, [end, start]);

  async function handleGenerate() {
    if (!qrEnabled) {
      setError("Your subscription does not include QR Menu access.");
      return;
    }

    if (!parsedRange.valid || parsedRange.start < 1 || parsedRange.end < parsedRange.start) {
      setError("Enter a valid table range.");
      return;
    }

    setWorking(true);
    setError(null);
    try {
      const data = await api.post<BulkQRCodeResponse>("/qr/tables/bulk", {
        start: parsedRange.start,
        end: parsedRange.end,
      });
      setResult(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to generate table QR codes.");
      } else {
        setError("Failed to generate table QR codes.");
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Table QR Codes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate guest QR codes for restaurant tables. Each code opens the table menu directly.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-semibold text-red-500">
            ×
          </button>
        </div>
      )}

      {loadingPrivileges ? (
        <div className="bg-white border rounded-xl p-6 text-sm text-gray-400 animate-pulse">
          Checking QR access…
        </div>
      ) : !qrEnabled ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-amber-900">QR Menu privilege required</h2>
          <p className="text-sm text-amber-800 mt-1">
            Table QR generation is available only when the restaurant subscription includes the QR Menu feature.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white border rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Bulk Generate</h2>
              <p className="text-sm text-gray-500 mt-1">
                Generate or reuse QR codes for a continuous table range.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Table</label>
                <input
                  type="number"
                  min="1"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Table</label>
                <input
                  type="number"
                  min="1"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={working}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {working ? "Generating…" : "Generate QR Codes"}
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-white border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Generated QRs</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {result.count} table QR code{result.count !== 1 ? "s" : ""} ready.
                  </p>
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.generated.map((qr) => (
                  <div key={`${qr.qr_type}-${qr.target_number}`} className="border rounded-xl p-4 bg-gray-50">
                    <img
                      src={`${API_ORIGIN}${qr.qr_image_url}`}
                      alt={`QR for Table ${qr.target_number}`}
                      className="w-40 h-40 mx-auto border rounded bg-white"
                    />
                    <div className="mt-4 space-y-2 text-sm">
                      <p className="font-semibold text-gray-900">Table {qr.target_number}</p>
                      <p className="text-xs text-gray-500 break-all">{qr.frontend_url}</p>
                      <div className="flex items-center gap-2">
                        <a
                          href={`${API_ORIGIN}${qr.qr_image_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 text-xs border rounded hover:bg-white transition-colors"
                        >
                          Open
                        </a>
                        <a
                          href={`${API_ORIGIN}${qr.qr_image_url}`}
                          download
                          className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-black transition-colors"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
