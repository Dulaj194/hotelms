import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ActionDialog from "@/components/shared/ActionDialog";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { api } from "@/lib/api";
import type {
  QRCodeDeleteResponse,
  QRCodeListResponse,
  QRRebuildResponse,
  QRCodeResponse,
} from "@/types/publicMenu";

import {
  FeedbackAlert,
  QRCodeCard,
  getApiErrorMessage,
  sortQRCodes,
} from "./qr/shared";

type ConfirmActionState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
} | null;

export default function AllTableQRCodes() {
  const [qrcodes, setQRCodes] = useState<QRCodeResponse[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null);

  const filteredQRCodes = useMemo(() => {
    const orderedQRCodes = sortQRCodes(qrcodes);
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return orderedQRCodes;
    }

    return orderedQRCodes.filter((qr) =>
      qr.target_number.toLowerCase().includes(keyword),
    );
  }, [qrcodes, search]);

  const clearMessages = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const loadTableQRCodes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.get<QRCodeListResponse>("/qr/tables");
      setQRCodes(data.qrcodes);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Failed to load table QR codes."));
    } finally {
      setLoading(false);
    }
  }, []);

  const executeDelete = useCallback(
    async ({
      endpoint,
      fallbackErrorMessage,
    }: {
      endpoint: string;
      fallbackErrorMessage: string;
    }) => {
      setWorking(true);
      clearMessages();

      try {
        const data = await api.delete<QRCodeDeleteResponse>(endpoint);
        setNotice(data.message);
        await loadTableQRCodes();
      } catch (deleteError) {
        throw new Error(getApiErrorMessage(deleteError, fallbackErrorMessage));
      } finally {
        setWorking(false);
      }
    },
    [clearMessages, loadTableQRCodes],
  );

  const rebuildTableLinks = useCallback(async () => {
    setWorking(true);
    clearMessages();

    try {
      const data = await api.post<QRRebuildResponse>("/qr/tables/rebuild-links", {});
      setNotice(data.message);
      await loadTableQRCodes();
    } catch (rebuildError) {
      setError(getApiErrorMessage(rebuildError, "Failed to rebuild table QR links."));
    } finally {
      setWorking(false);
    }
  }, [clearMessages, loadTableQRCodes]);

  const openDeleteSingleConfirm = useCallback(
    (tableNumber: string) => {
      setConfirmError(null);
      setConfirmAction({
        title: `Delete Table ${tableNumber} QR`,
        description:
          "Guests will not be able to scan this table until the QR is generated again.",
        confirmLabel: "Delete QR",
        onConfirm: () =>
          executeDelete({
            endpoint: `/qr/table/${encodeURIComponent(tableNumber)}`,
            fallbackErrorMessage: "Failed to delete table QR.",
          }),
      });
    },
    [executeDelete],
  );

  const openDeleteAllConfirm = useCallback(() => {
    setConfirmError(null);
    setConfirmAction({
      title: "Delete All Table QR Codes",
      description:
        "This will remove every generated table QR code from the system.",
      confirmLabel: "Delete All",
      onConfirm: () =>
        executeDelete({
          endpoint: "/qr/tables",
          fallbackErrorMessage: "Failed to delete table QR codes.",
        }),
    });
  }, [executeDelete]);

  const closeConfirmDialog = useCallback(() => {
    if (working) {
      return;
    }

    setConfirmAction(null);
    setConfirmError(null);
  }, [working]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) {
      return;
    }

    setConfirmError(null);

    try {
      await confirmAction.onConfirm();
      setConfirmAction(null);
    } catch (confirmActionError) {
      setConfirmError(getApiErrorMessage(confirmActionError, "Action failed."));
    }
  }, [confirmAction]);

  useEffect(() => {
    void loadTableQRCodes();
  }, [loadTableQRCodes]);

  return (
    <DashboardLayout>
      <div className="app-page-stack mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="app-page-title text-gray-900">All Table QR Codes</h1>
            <p className="app-muted-text mt-1 text-gray-500">
              View, search, download, and retire table QR codes from one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/qr/tables/generate"
              className="app-btn-base bg-orange-500 text-white hover:bg-orange-600"
            >
              Generate Table QRs
            </Link>

            <button
              type="button"
              onClick={() => void loadTableQRCodes()}
              disabled={loading || working}
              className="app-btn-base border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={() => void rebuildTableLinks()}
              disabled={loading || working || qrcodes.length === 0}
              className="app-btn-base border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              Rebuild for Current WiFi
            </button>

            <button
              type="button"
              onClick={openDeleteAllConfirm}
              disabled={loading || working || qrcodes.length === 0}
              className="app-btn-base border border-red-200 bg-white text-red-700 hover:bg-red-50"
            >
              Delete All
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

        <div className="space-y-4 rounded-xl border bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="app-section-title text-gray-900">
                Generated Table QRs
              </h2>
              <p className="app-muted-text mt-1 text-gray-500">
                {filteredQRCodes.length} shown of {qrcodes.length} total
              </p>
            </div>

            <div className="w-full max-w-sm">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Search Table
              </label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Table number"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400">
              Loading table QR codes...
            </div>
          ) : filteredQRCodes.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              {qrcodes.length === 0
                ? "No table QR codes found. Generate table QR codes first."
                : "No table QR codes match your search."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredQRCodes.map((qr) => (
                <QRCodeCard
                  key={`${qr.qr_type}-${qr.target_number}`}
                  qr={qr}
                  labelPrefix="Table"
                  working={working}
                  onDelete={openDeleteSingleConfirm}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmAction && (
        <ActionDialog
          title={confirmAction.title}
          description={confirmAction.description}
          error={confirmError}
          busy={working}
          onClose={closeConfirmDialog}
          onConfirm={() => void handleConfirmAction()}
          confirmLabel={working ? "Deleting..." : confirmAction.confirmLabel}
          confirmTone="danger"
        />
      )}
    </DashboardLayout>
  );
}
