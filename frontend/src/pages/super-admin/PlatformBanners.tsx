import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, ShieldAlert, Sparkles, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import ActionDialog from "@/components/shared/ActionDialog";
import { canPerformPlatformAction } from "@/features/platform-access/permissions";
import { getUser } from "@/lib/auth";

interface PlatformBanner {
  id: number;
  title: string;
  content: string;
  category: "promotional" | "system_alert";
  type: "info" | "success" | "warning" | "danger";
  image_url: string | null;
  cta_link: string | null;
  cta_label: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  dismissible: boolean;
  created_at: string;
  updated_at: string;
}

export default function PlatformBanners() {
  const [banners, setBanners] = useState<PlatformBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PlatformBanner | null>(null);
  const [formData, setFormData] = useState<Partial<PlatformBanner>>({
    title: "",
    content: "",
    category: "promotional",
    type: "info",
    is_active: true,
    dismissible: true,
  });
  const [formSaving, setFormSaving] = useState(false);

  const [deleteBannerId, setDeleteBannerId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const user = getUser();
  const canMutate = canPerformPlatformAction(user?.super_admin_scopes, "platform_banners", "mutate");

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const response = await api.get<PlatformBanner[]>("/super-admin/banners");
      setBanners(response || []);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Failed to fetch banners");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleOpenModal = (banner?: PlatformBanner) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title,
        content: banner.content,
        category: banner.category,
        type: banner.type,
        image_url: banner.image_url,
        cta_link: banner.cta_link,
        cta_label: banner.cta_label,
        is_active: banner.is_active,
        starts_at: banner.starts_at ? banner.starts_at.slice(0, 16) : "", // Format for datetime-local
        ends_at: banner.ends_at ? banner.ends_at.slice(0, 16) : "",
        dismissible: banner.dismissible,
      });
    } else {
      setEditingBanner(null);
      setFormData({
        title: "",
        content: "",
        category: "promotional",
        type: "info",
        image_url: "",
        cta_link: "",
        cta_label: "",
        is_active: true,
        starts_at: "",
        ends_at: "",
        dismissible: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    
    // Prepare payload
    const payload = {
      ...formData,
      starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
      ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
      image_url: formData.image_url || null,
      cta_link: formData.cta_link || null,
      cta_label: formData.cta_label || null,
    };

    try {
      if (editingBanner) {
        await api.patch(`/super-admin/banners/${editingBanner.id}`, payload);
      } else {
        await api.post("/super-admin/banners", payload);
      }
      setIsModalOpen(false);
      fetchBanners();
    } catch (err) {
      console.error(err);
      alert("Failed to save banner. Please check your inputs.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteBannerId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/super-admin/banners/${deleteBannerId}`);
      setDeleteBannerId(null);
      fetchBanners();
    } catch (err) {
      console.error(err);
      alert("Failed to delete banner");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Banners</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage global announcements and promotional banners shown on all tenant dashboards.
          </p>
        </div>
        {canMutate && (
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Create Banner
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white p-8 rounded-xl border text-center text-gray-500">Loading banners...</div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">{error}</div>
      ) : banners.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border text-center text-gray-500 shadow-sm flex flex-col items-center justify-center">
          <Sparkles className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No banners found</h3>
          <p className="text-sm">Get started by creating a new platform banner.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Banner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category & Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status & Schedule
                  </th>
                  {canMutate && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {banners.map((banner) => (
                  <tr key={banner.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">{banner.title}</div>
                      <div className="text-xs text-gray-500 truncate max-w-md mt-1">{banner.content}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {banner.category === "promotional" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Sparkles size={12} /> Promo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldAlert size={12} /> Alert
                          </span>
                        )}
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium border
                          ${banner.type === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                          ${banner.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                          ${banner.type === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                          ${banner.type === 'danger' ? 'bg-rose-50 text-rose-700 border-rose-200' : ''}
                        `}>
                          {banner.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {banner.is_active ? (
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        ) : (
                          <span className="inline-flex h-2 w-2 rounded-full bg-gray-300"></span>
                        )}
                        <span className="text-sm text-gray-700">{banner.is_active ? "Active" : "Inactive"}</span>
                      </div>
                      {(banner.starts_at || banner.ends_at) && (
                        <div className="text-xs text-gray-500 mt-1">
                          {banner.starts_at ? new Date(banner.starts_at).toLocaleDateString() : "Anytime"} 
                          {" - "} 
                          {banner.ends_at ? new Date(banner.ends_at).toLocaleDateString() : "Forever"}
                        </div>
                      )}
                    </td>
                    {canMutate && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleOpenModal(banner)}
                          className="text-indigo-600 hover:text-indigo-900 mx-2 p-1 rounded-md hover:bg-indigo-50"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteBannerId(banner.id)}
                          className="text-rose-600 hover:text-rose-900 mx-2 p-1 rounded-md hover:bg-rose-50"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {editingBanner ? "Edit Platform Banner" : "Create Platform Banner"}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="bannerForm" onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                    <input
                      required
                      type="text"
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={formData.title || ""}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Content (Message)</label>
                    <textarea
                      required
                      rows={3}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={formData.content || ""}
                      onChange={(e) => setFormData({...formData, content: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                    <select
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value as any})}
                    >
                      <option value="promotional">Promotional (Discover & Share)</option>
                      <option value="system_alert">System Alert</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Visual Type</label>
                    <select
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    >
                      <option value="info">Info (Blue)</option>
                      <option value="success">Success (Green)</option>
                      <option value="warning">Warning (Yellow)</option>
                      <option value="danger">Danger (Red)</option>
                    </select>
                  </div>

                  <div className="col-span-2 pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Optional Media & Links</h4>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Image URL (For Promotions)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={formData.image_url || ""}
                      onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">CTA Link (Target URL)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={formData.cta_link || ""}
                      onChange={(e) => setFormData({...formData, cta_link: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">CTA Button Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Register Now"
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={formData.cta_label || ""}
                      onChange={(e) => setFormData({...formData, cta_label: e.target.value})}
                    />
                  </div>

                  <div className="col-span-2 pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Settings & Schedule</h4>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Start Time (Local)</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={formData.starts_at || ""}
                      onChange={(e) => setFormData({...formData, starts_at: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">End Time (Local)</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={formData.ends_at || ""}
                      onChange={(e) => setFormData({...formData, ends_at: e.target.value})}
                    />
                  </div>

                  <div className="flex items-center gap-3 col-span-2 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      />
                      <span className="text-sm font-medium text-gray-900">Is Active</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer ml-6">
                      <input
                        type="checkbox"
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                        checked={formData.dismissible}
                        onChange={(e) => setFormData({...formData, dismissible: e.target.checked})}
                      />
                      <span className="text-sm font-medium text-gray-900">Allow users to dismiss</span>
                    </label>
                  </div>

                </div>
              </form>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                form="bannerForm"
                type="submit"
                disabled={formSaving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {formSaving ? "Saving..." : "Save Banner"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deleteBannerId !== null && (
        <ActionDialog
          title="Delete Banner"
          description="Are you sure you want to delete this banner? This action cannot be undone and it will be immediately removed from all tenant dashboards."
          confirmLabel={isDeleting ? "Deleting..." : "Delete Banner"}
          cancelLabel="Cancel"
          confirmTone="danger"
          onConfirm={handleDelete}
          onClose={() => setDeleteBannerId(null)}
          busy={isDeleting}
        />
      )}
    </div>
  );
}
