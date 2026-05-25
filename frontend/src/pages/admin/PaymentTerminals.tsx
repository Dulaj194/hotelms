import { useEffect, useState } from "react";
import { CreditCard, Edit2, Plus, Trash2 } from "lucide-react";
import {
  listPaymentTerminals,
  createPaymentTerminal,
  updatePaymentTerminal,
  deletePaymentTerminal,
  type PaymentTerminalResponse,
  type PaymentTerminalCreate,
  type PaymentTerminalUpdate,
} from "@/features/payments/api";

export default function PaymentTerminals() {
  const [terminals, setTerminals] = useState<PaymentTerminalResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [currentTerminal, setCurrentTerminal] = useState<Partial<PaymentTerminalResponse> | null>(null);
  
  // Form state
  const [counterName, setCounterName] = useState("");
  const [provider, setProvider] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [terminalIdStr, setTerminalIdStr] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchTerminals();
  }, []);

  async function fetchTerminals() {
    setLoading(true);
    try {
      const data = await listPaymentTerminals();
      setTerminals(data);
    } catch (err: any) {
      setError(err.message || "Failed to load payment terminals.");
    } finally {
      setLoading(false);
    }
  }

  function handleAddNew() {
    setCurrentTerminal(null);
    setCounterName("");
    setProvider("");
    setMerchantId("");
    setTerminalIdStr("");
    setApiKey("");
    setIsActive(true);
    setIsEditing(true);
  }

  function handleEdit(terminal: PaymentTerminalResponse) {
    setCurrentTerminal(terminal);
    setCounterName(terminal.counter_name);
    setProvider(terminal.provider);
    setMerchantId(""); // Keep empty for security unless changing
    setTerminalIdStr(""); // Keep empty for security unless changing
    setApiKey("");
    setIsActive(terminal.is_active);
    setIsEditing(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this terminal?")) return;
    try {
      await deletePaymentTerminal(id);
      setTerminals(terminals.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete terminal");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!counterName.trim() || !provider.trim()) {
      alert("Counter Name and Provider are required.");
      return;
    }

    try {
      if (currentTerminal && currentTerminal.id) {
        // Update
        const payload: PaymentTerminalUpdate = {
          counter_name: counterName,
          provider: provider,
          is_active: isActive,
        };
        if (merchantId) payload.merchant_id = merchantId;
        if (terminalIdStr) payload.terminal_id = terminalIdStr;
        if (apiKey) payload.api_key = apiKey;
        
        const updated = await updatePaymentTerminal(currentTerminal.id, payload);
        setTerminals(terminals.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        // Create
        if (!merchantId.trim() || !terminalIdStr.trim()) {
          alert("Merchant ID and Terminal ID are required for new terminals.");
          return;
        }
        const payload: PaymentTerminalCreate = {
          counter_name: counterName,
          provider: provider,
          merchant_id: merchantId,
          terminal_id: terminalIdStr,
          api_key: apiKey || null,
          is_active: isActive,
        };
        const created = await createPaymentTerminal(payload);
        setTerminals([...terminals, created]);
      }
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message || "Failed to save terminal");
    }
  }

  if (loading && !isEditing && terminals.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-slate-500">Loading terminals...</div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {currentTerminal ? "Edit Payment Terminal" : "Add Payment Terminal"}
          </h2>
          <form onSubmit={handleSave} className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Counter Name / Location
                </label>
                <input
                  type="text"
                  value={counterName}
                  onChange={(e) => setCounterName(e.target.value)}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g. Front Desk, Pool Bar"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Bank / Provider Name
                </label>
                <input
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g. BOC, Commercial Bank"
                  required
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Merchant ID
                </label>
                <input
                  type="text"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder={currentTerminal ? "Leave blank to keep existing" : "Required"}
                  required={!currentTerminal}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Terminal ID
                </label>
                <input
                  type="text"
                  value={terminalIdStr}
                  onChange={(e) => setTerminalIdStr(e.target.value)}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder={currentTerminal ? "Leave blank to keep existing" : "Required"}
                  required={!currentTerminal}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                API Key / Secret (Optional)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder={currentTerminal ? "Leave blank to keep existing" : "Optional"}
              />
              <p className="mt-1 text-xs text-slate-500">
                These credentials will be securely encrypted using AES-256 before storage.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                Terminal is Active
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {currentTerminal ? "Save Changes" : "Add Terminal"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payment Terminals</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your card machines and payment gateways for each counter.
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Terminal
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {terminals.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
              <CreditCard className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No payment terminals</h3>
            <p className="mt-1 text-sm text-slate-500">
              Get started by adding a payment terminal to your account.
            </p>
            <button
              onClick={handleAddNew}
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add terminal
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Counter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Merchant ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Terminal ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {terminals.map((terminal) => (
                  <tr key={terminal.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-slate-900">
                        {terminal.counter_name}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <CreditCard className="h-4 w-4 text-slate-400" />
                        {terminal.provider}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                      {terminal.merchant_id_masked}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                      {terminal.terminal_id_masked}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          terminal.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {terminal.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(terminal)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        <Edit2 className="h-4 w-4 inline" />
                      </button>
                      <button
                        onClick={() => handleDelete(terminal.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
