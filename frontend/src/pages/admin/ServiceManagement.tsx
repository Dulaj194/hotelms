import { useCallback, useEffect, useState } from "react";
import { 
  Bell, 
  MessageSquare, 
  Plus, 
  Trash2, 
  X,
  Droplets,
  User,
  Utensils,
  Layers,
  Sparkles,
  RotateCcw,
  Salad,
  Smile,
  Wifi,
  Star,
  FileText
} from "lucide-react";

import DashboardLayout from "@/components/shared/DashboardLayout";
import {
  TenantContextBadge,
  TenantScopeEmptyState,
} from "@/components/shared/TenantScopeNotice";
import { useTenantContext } from "@/hooks/useTenantContext";
import { api } from "@/lib/api";

interface QuickService {
  id: number;
  label: string;
  message: string;
  icon_name: string | null;
  is_active: boolean;
  sort_order: number;
}

interface FormData {
  label: string;
  message: string;
  icon_name: string;
  is_active: boolean;
  sort_order: number;
}

const EMPTY_FORM: FormData = {
  label: "",
  message: "",
  icon_name: "Bell",
  is_active: true,
  sort_order: 0,
};

const ICON_OPTIONS = [
  { name: "Bell", icon: Bell },
  { name: "Droplets", icon: Droplets },
  { name: "User", icon: User },
  { name: "Utensils", icon: Utensils },
  { name: "Layers", icon: Layers },
  { name: "Sparkles", icon: Sparkles },
  { name: "RotateCcw", icon: RotateCcw },
  { name: "Salad", icon: Salad },
  { name: "Smile", icon: Smile },
  { name: "Wifi", icon: Wifi },
  { name: "Star", icon: Star },
  { name: "FileText", icon: FileText },
  { name: "MessageSquare", icon: MessageSquare },
];

export default function ServiceManagement() {
  const { tenantContext } = useTenantContext();

  const [services, setServices] = useState<QuickService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<QuickService | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<QuickService | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<QuickService[]>("/quick-services");
      setServices(data);
    } catch {
      setError("Failed to load quick services.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  function openCreate() {
    setEditingService(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(service: QuickService) {
    setEditingService(service);
    setFormData({
      label: service.label,
      message: service.message,
      icon_name: service.icon_name || "Bell",
      is_active: service.is_active,
      sort_order: service.sort_order,
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingService(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  }

  async function handleSave() {
    if (!formData.label.trim()) {
      setFormError("Label is required.");
      return;
    }
    if (!formData.message.trim()) {
      setFormError("Message is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        label: formData.label.trim(),
        message: formData.message.trim(),
        icon_name: formData.icon_name,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
      };

      if (editingService) {
        await api.put(`/quick-services/${editingService.id}`, payload);
      } else {
        await api.post("/quick-services", payload);
      }

      closeModal();
      await loadServices();
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? "Failed to save service.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await api.delete(`/quick-services/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadServices();
    } catch {
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Service Management</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Define custom buttons for guest menus to allow quick service requests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TenantContextBadge tenantContext={tenantContext} />
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add New Service
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Services...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-rose-50 p-4 border border-rose-100 text-rose-600 text-sm font-bold">
          {error}
        </div>
      )}

      {!loading && !error && services.length === 0 && (
        <TenantScopeEmptyState
          tenantContext={tenantContext}
          message="No custom services configured yet."
        />
      )}

      {!loading && services.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => {
            const IconComp = ICON_OPTIONS.find(i => i.name === service.icon_name)?.icon || Bell;
            return (
              <article
                key={service.id}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 ${
                  service.is_active ? "border-slate-100 bg-white" : "border-slate-50 bg-slate-50/50 opacity-75"
                }`}
              >
                <div className="flex items-center gap-4 p-5">
                  <div className={`grid h-14 w-14 place-items-center rounded-2xl shadow-sm transition-transform duration-500 group-hover:scale-110 ${
                    service.is_active ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                  }`}>
                    <IconComp className="h-7 w-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-black tracking-tight text-slate-900">{service.label}</h2>
                      {!service.is_active && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Disabled</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs font-bold uppercase tracking-widest text-slate-400">Order: {service.sort_order}</p>
                  </div>
                </div>

                <div className="flex-1 px-5 pb-5">
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Response Message</p>
                    <p className="text-sm font-medium text-slate-700 line-clamp-2">{service.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-slate-50 bg-slate-50/30 p-3">
                  <button
                    onClick={() => openEdit(service)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 border border-slate-200 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
                  >
                    Edit Details
                  </button>
                  <button
                    onClick={() => setDeleteTarget(service)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 transition-all hover:bg-rose-500 hover:text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-slate-50 p-6">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900">
                  {editingService ? "Edit Service" : "New Custom Service"}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">Configure how guests interact with this button.</p>
              </div>
              <button
                onClick={closeModal}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Button Label <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData(p => ({ ...p, label: e.target.value }))}
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 transition-all focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    placeholder="e.g. Extra Ice"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Icon
                  </label>
                  <div className="relative">
                    <select
                      value={formData.icon_name}
                      onChange={(e) => setFormData(p => ({ ...p, icon_name: e.target.value }))}
                      className="w-full appearance-none rounded-xl border-2 border-slate-100 bg-slate-50 pl-10 pr-4 py-2.5 text-sm font-bold text-slate-900 transition-all focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    >
                      {ICON_OPTIONS.map(opt => (
                        <option key={opt.name} value={opt.name}>{opt.name}</option>
                      ))}
                    </select>
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      {(() => {
                        const Icon = ICON_OPTIONS.find(i => i.name === formData.icon_name)?.icon || Bell;
                        return <Icon className="h-4 w-4" />;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Staff Message <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 transition-all focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  placeholder="Message staff will see when button is clicked..."
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 transition-all focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
                    <span className="ml-3 text-sm font-bold text-slate-700">Active Service</span>
                  </label>
                </div>
              </div>
            </div>

            {formError && (
              <div className="mx-6 p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100">
                {formError}
              </div>
            )}

            <div className="flex items-center gap-3 bg-slate-50 p-6">
              <button
                onClick={closeModal}
                className="flex-1 rounded-xl bg-white border border-slate-200 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving Changes..." : editingService ? "Update Service" : "Create Service"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-rose-500 mb-6">
              <Trash2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-center text-slate-900 mb-2">Delete Service?</h2>
            <p className="text-sm font-medium text-center text-slate-500 mb-8">
              This will permanently remove <span className="font-bold text-slate-900">"{deleteTarget.label}"</span> from all guest menus.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
              >
                No, Keep it
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
