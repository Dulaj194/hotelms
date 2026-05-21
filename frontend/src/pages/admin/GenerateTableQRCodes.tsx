import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Layers, 
  RefreshCw, 
  ArrowLeft, 
  Download, 
  Printer, 
  ChevronRight,
  CheckCircle2
} from "lucide-react";

import { api } from "@/lib/api";
import type {
  BulkQRCodeResponse,
  QRCodeListResponse,
  QRCodeResponse,
} from "@/types/publicMenu";

import {
  FeedbackAlert,
  QRCodeCard,
  getApiErrorMessage,
  sortQRCodes,
} from "./qr/shared";

type ActiveTab = "bulk" | "single";

export default function GenerateTableQRCodes() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("bulk");
  const [singleTableNumber, setSingleTableNumber] = useState("");
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
        `${data.count} table QR codes generated successfully.`
      );
      await loadExistingSummary();
    } catch (generateError) {
      setError(getApiErrorMessage(generateError, "Failed to generate table QR codes."));
    } finally {
      setWorking(false);
    }
  }, [loadExistingSummary, parsedRange]);

  const handleGenerateSingle = useCallback(async () => {
    const normalizedTable = singleTableNumber.trim();
    if (!normalizedTable) {
      setError("Enter a table number.");
      return;
    }

    setWorking(true);
    setError(null);
    setNotice(null);

    try {
      const qr = await api.post<QRCodeResponse>("/qr/table", {
        target_number: normalizedTable,
      });

      setResult({ generated: [qr], count: 1 });
      setNotice(`Table ${normalizedTable} QR code generated.`);
      setSingleTableNumber("");
      await loadExistingSummary();
    } catch (generateError) {
      setError(getApiErrorMessage(generateError, "Failed to generate table QR code."));
    } finally {
      setWorking(false);
    }
  }, [loadExistingSummary, singleTableNumber]);

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-8 pb-12">
        {/* Modern Header */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-orange-500">
              <Link to="/admin/qr/tables" className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] hover:text-orange-600">
                <ArrowLeft className="h-3 w-3" />
                Back to Tables
              </Link>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">
              QR Generation Studio
            </h1>
            <p className="text-sm font-medium text-slate-500 max-w-lg">
              Create premium, branded QR codes with your hotel logo and modern rounded modules. 
              Optimized for high-quality printing.
            </p>
          </div>

          <div className="flex items-center gap-3">
             <div className="hidden rounded-2xl bg-white border border-slate-100 p-3 shadow-sm md:flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Active</p>
                  <p className="text-xl font-black text-slate-900">{loading ? "..." : existingTotal}</p>
                </div>
                <div className="h-8 w-px bg-slate-100" />
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Last Table</p>
                  <p className="text-xl font-black text-slate-900">{loading ? "..." : highestTable ?? "None"}</p>
                </div>
             </div>
             <button
                type="button"
                onClick={() => void loadExistingSummary()}
                disabled={loading || working}
                className="grid h-12 w-12 place-items-center rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-orange-500 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
              </button>
          </div>
        </div>

        {/* Global Feedback */}
        <div className="space-y-4">
          {error && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <FeedbackAlert type="error" message={error} onClose={() => setError(null)} />
            </div>
          )}
          {notice && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <FeedbackAlert type="success" message={notice} onClose={() => setNotice(null)} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Configuration Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-2xl shadow-slate-200/50">
              <div className="flex border-b border-slate-100 p-2">
                <button
                  onClick={() => setActiveTab("bulk")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                    activeTab === "bulk" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  Bulk Range
                </button>
                <button
                  onClick={() => setActiveTab("single")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                    activeTab === "single" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Single Table
                </button>
              </div>

              <div className="p-8">
                {activeTab === "bulk" ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Start Table</label>
                        <input
                          type="number"
                          min="1"
                          value={start}
                          onChange={(e) => setStart(e.target.value)}
                          className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-orange-500/20 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">End Table</label>
                        <input
                          type="number"
                          min="1"
                          value={end}
                          onChange={(e) => setEnd(e.target.value)}
                          className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-orange-500/20 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl bg-orange-50/50 border border-orange-100 p-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500 text-white">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-orange-900">
                            {parsedRange.valid ? `${parsedRange.count} Codes Ready` : "Invalid Range"}
                          </p>
                          <p className="text-[10px] font-bold text-orange-700/60 uppercase tracking-widest">
                            From Table {parsedRange.start} to {parsedRange.end}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleGenerate}
                      disabled={working || !parsedRange.valid}
                      className="group w-full flex items-center justify-center gap-3 rounded-[1.5rem] bg-slate-900 py-4 text-sm font-black text-white shadow-xl transition-all hover:bg-black active:scale-[0.98] disabled:opacity-40"
                    >
                      {working ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Download className="h-5 w-5 transition-transform group-hover:-translate-y-1" />
                          Generate Range
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Table Number / Label</label>
                      <input
                        type="text"
                        value={singleTableNumber}
                        onChange={(e) => setSingleTableNumber(e.target.value)}
                        placeholder="e.g. VIP-01"
                        className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-orange-500/20 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                      />
                    </div>

                    <p className="text-[11px] font-medium text-slate-400 leading-relaxed italic">
                      Individual QR generation is useful for replacing lost stickers or adding custom VIP zones.
                    </p>

                    <button
                      onClick={handleGenerateSingle}
                      disabled={working || !singleTableNumber.trim()}
                      className="group w-full flex items-center justify-center gap-3 rounded-[1.5rem] bg-slate-900 py-4 text-sm font-black text-white shadow-xl transition-all hover:bg-black active:scale-[0.98] disabled:opacity-40"
                    >
                      {working ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-5 w-5 transition-transform group-hover:scale-125" />
                          Generate Table QR
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Print Help Card */}
            <div className="rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-amber-600 p-8 text-white shadow-xl">
               <div className="flex items-center gap-4 mb-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 backdrop-blur-md">
                    <Printer className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-black tracking-tight">Printing Guide</h3>
               </div>
               <p className="text-sm font-medium text-white/80 leading-relaxed mb-6">
                 For best results, use gloss stickers or acrylic stands. Branded QR codes include 15% error correction to ensure logos don't block scanners.
               </p>
               <Link to="/admin/qr/tables" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-orange-600 transition hover:bg-orange-50 active:scale-95">
                 View All Existing
                 <ChevronRight className="h-3.5 w-3.5" />
               </Link>
            </div>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-7">
              {result ? (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-black text-slate-900">Generated Results</h2>
                    <button 
                      onClick={() => setResult(null)}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {sortQRCodes(result.generated).map((qr, index) => (
                      <div
                        key={`${qr.qr_type}-${qr.target_number}`}
                        className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <QRCodeCard qr={qr} labelPrefix="Table" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[500px] flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-100 bg-slate-50/50 p-12 text-center">
                  <div className="mb-6 grid h-24 w-24 place-items-center rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/30">
                    <Layers className="h-10 w-10 text-slate-200" />
                  </div>
                  <h3 className="text-2xl font-black tracking-tight text-slate-900">Ready for Launch</h3>
                  <p className="mt-2 max-w-xs text-sm font-medium text-slate-400">
                    Configure your table range on the left to generate premium QR codes for your floor.
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>
    </>
  );
}
