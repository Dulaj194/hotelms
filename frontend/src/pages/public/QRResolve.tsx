import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { publicGet } from "@/lib/publicApi";
import type { QRResolveResponse } from "@/types/qr";

type QRResolveProps = {
  mode: "table" | "room";
};

export default function QRResolve({ mode }: QRResolveProps) {
  const { tableKey, roomKey } = useParams<{ tableKey?: string; roomKey?: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = mode === "room" ? roomKey : tableKey;
    if (!key) {
      setError("Invalid QR link. Please scan again.");
      return;
    }

    let cancelled = false;

    const resolveQr = async () => {
      try {
        const encodedKey = encodeURIComponent(key);
        const path =
          mode === "room"
            ? `/qr/room/resolve/${encodedKey}`
            : `/qr/resolve/${encodedKey}`;
        const context = await publicGet<QRResolveResponse>(path);

        if (cancelled) return;

        if (mode === "room" && context.room_number) {
          navigate(
            `/menu/${context.restaurant_id}/room/${encodeURIComponent(
              context.room_number,
            )}?k=${encodedKey}`,
            { replace: true },
          );
          return;
        }

        if (mode === "table" && context.table_number) {
          navigate(
            `/menu/${context.restaurant_id}/table/${encodeURIComponent(
              context.table_number,
            )}?k=${encodedKey}`,
            { replace: true },
          );
          return;
        }

        setError("This QR code could not be resolved. Please scan again.");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not resolve QR code.");
        }
      }
    };

    void resolveQr();

    return () => {
      cancelled = true;
    };
  }, [mode, navigate, roomKey, tableKey]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-5 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-700">
          {error ?? "Opening menu..."}
        </p>
      </div>
    </div>
  );
}
