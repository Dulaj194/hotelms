import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";
import type {
  BulkQRCodeResponse,
  QRCodeListResponse,
} from "@/types/publicMenu";

import {
  FeedbackAlert,
  QRCodeCard,
  getApiErrorMessage,
  sortQRCodes,
} from "./qr/shared";

export default function GenerateTableQRCodes() {
  const [start, setStart] = useState("1");
  const [end, setEnd] = useState("10");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [existingTotal, setExistingTotal] = useState(0);
  const [highestTable, setHighestTable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<BulkQRCodeResponse | null>(null);

  const parsedRange = useMemo(() => {
    const startNumber = Number(start);
    const endNumber = Number(end);
    const valid =
      Number.isInteger(startNumber) &&
      Number.isInteger(endNumber) &&
      startNumber >= 1 &&
      endNumber >= startNumber;

    return {
      start: startNumber,
      end: endNumber,
      valid,
      count: valid ? endNumber - startNumber + 1 : 0,
    };
  }, [end, start]);

  const loadExistingSummary = useCallback(async () => {
    setLoading(true);

    try {
      const data = await api.get<QRCodeListResponse>("/qr/tables");
      const orderedQRCodes = sortQRCodes(data.qrcodes);
      const lastTable = orderedQRCodes.at(-1)?.target_number ?? null;

      setExistingTotal(data.total);
      setHighestTable(lastTable);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load current table QR summary."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExistingSummary();
  }, [loadExistingSummary]);

  const handleGenerate = useCallback(async () => {
    if (!parsedRange.valid) {
      setError("Enter a valid table range.");
      return;
    }

    setWorking(true);
    setError(null);
    setNotice(null);

    try {
      const data = await api.post<BulkQRCodeResponse>("/qr/tables/bulk", {
        start: parsedRange.start,
        end: parsedRange.end,
      });

      setResult(data);
      setNotice(
        `${data.count} table QR code${data.count === 1 ? "" : "s"} ready for print or download.`,
      );
      await loadExistingSummary();
    } catch (generateError) {
      setError(getApiErrorMessage(generateError, "Failed to generate table QR codes."));
    } finally {
      setWorking(false);
    }
  }, [loadExistingSummary, parsedRange]);

  return (
    <DashboardLayout>
      <div className="app-page-stack mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="app-page-title text-gray-900">
              Generate Table QR Codes
            </h1>
            <p className="app-muted-text mt-1 text-gray-500">
              Create or reuse a clean table QR range for dine-in ordering and guest onboarding.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/qr/tables"
              className="app-btn-base border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              Manage Existing
            </Link>

            <button
              type="button"
              onClick={() => void loadExistingSummary()}
              disabled={loading || working}
              className="app-btn-base border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              Refresh Summary
            </button>
          </div>
        </div>

        {error && (
          <FeedbackAlert
            type="error"
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {notice && (
          <FeedbackAlert
            type="success"
            message={notice}
            onClose={() => setNotice(null)}
          />
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-4 rounded-xl border bg-white p-6">
            <div>
              <h2 className="app-section-title text-gray-900">Bulk Generate</h2>
              <p className="app-muted-text mt-1 text-gray-500">
                Use a continuous range when your floor uses numeric table numbering.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Start Table
                </label>
                <input
                  type="number"
                  min="1"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  End Table
                </label>
                <input
                  type="number"
                  min="1"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={working}
                className="app-btn-base bg-orange-500 text-white hover:bg-orange-600"
              >
                {working ? "Generating..." : "Generate QR Codes"}
              </button>
            </div>

            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-900">
              <p className="font-semibold">Current request</p>
              <p className="mt-1">
                {parsedRange.valid
                  ? `Tables ${parsedRange.start} to ${parsedRange.end} (${parsedRange.count} total)`
                  : "Enter a valid start and end table number."}
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border bg-white p-6">
            <div>
              <h2 className="app-section-title text-gray-900">Current Coverage</h2>
              <p className="app-muted-text mt-1 text-gray-500">
                Snapshot of the QR codes already generated for this restaurant.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-xl border bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Generated tables</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {loading ? "..." : existingTotal}
                </p>
              </div>

              <div className="rounded-xl border bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Highest table currently available</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {loading ? "..." : highestTable ?? "Not generated yet"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <div className="space-y-4 rounded-xl border bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="app-section-title text-gray-900">Generated QRs</h2>
                <p className="app-muted-text mt-1 text-gray-500">
                  {result.count} table QR code{result.count !== 1 ? "s" : ""} ready.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortQRCodes(result.generated).map((qr) => (
                <QRCodeCard
                  key={`${qr.qr_type}-${qr.target_number}`}
                  qr={qr}
                  labelPrefix="Table"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
