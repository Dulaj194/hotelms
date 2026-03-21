import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import DashboardLayout from "@/components/shared/DashboardLayout";
import { toAssetUrl } from "@/lib/assets";
import { api } from "@/lib/api";
import type { Menu } from "@/types/menu";

interface EditFormData {
  name: string;
  description: string;
}

export default function MenuEdit() {
  const navigate = useNavigate();
  const { menuId } = useParams<{ menuId: string }>();
  const parsedMenuId = useMemo(() => Number(menuId), [menuId]);

  const [menu, setMenu] = useState<Menu | null>(null);
  const [formData, setFormData] = useState<EditFormData>({
    name: "",
    description: "",
  });
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadMenu() {
      if (!Number.isFinite(parsedMenuId) || parsedMenuId <= 0) {
        setError("Invalid menu id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await api.get<Menu>(`/menus/${parsedMenuId}`);
        setMenu(data);
        setFormData({
          name: data.name,
          description: data.description ?? "",
        });
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "Failed to load menu.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadMenu();
  }, [parsedMenuId]);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedImageFile(null);
      return;
    }

    const validTypes = ["image/jpeg", "image/png"];
    const maxBytes = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      setError("Invalid image format. Allowed: JPEG, PNG.");
      setSelectedImageFile(null);
      return;
    }

    if (file.size > maxBytes) {
      setError("Image exceeds 5MB limit.");
      setSelectedImageFile(null);
      return;
    }

    setError(null);
    setSelectedImageFile(file);
  }

  async function handleUpdate() {
    if (!menu) return;
    if (!formData.name.trim()) {
      setError("Menu name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await api.patch<Menu>(`/menus/${menu.id}`, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });

      if (selectedImageFile) {
        const form = new FormData();
        form.append("file", selectedImageFile);
        await api.post(`/menus/${menu.id}/image`, form);
      }

      setSuccessMessage("Menu updated successfully.");
      navigate("/admin/menu/menus");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to update menu.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto bg-white border border-gray-200 rounded-xl p-6">
        <h1 className="text-4xl font-semibold text-gray-900 mb-6">Edit Menu</h1>

        {loading && <p className="text-sm text-gray-500">Loading...</p>}
        {!loading && error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {!loading && menu && (
          <div className="space-y-5">
            <div>
              <label className="block text-2xl text-gray-800 mb-2">Menu Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-3xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                maxLength={255}
              />
            </div>

            <div>
              <label className="block text-2xl text-gray-800 mb-2">
                Description <span className="inline-flex items-center justify-center text-sm px-2 h-6 rounded-full bg-gray-200 text-gray-700">{100 - formData.description.length}</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    description: event.target.value.slice(0, 100),
                  }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-3xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                maxLength={100}
              />
              <p className="text-sm text-gray-500 mt-1">Maximum 100 characters allowed</p>
            </div>

            <div>
              <label className="block text-2xl text-gray-800 mb-2">Image</label>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleImageChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-sm text-gray-500 mt-1">
                Maximum file size: 5MB (JPEG, PNG only). Leave blank to keep current image.
              </p>
            </div>

            {menu.image_path && (
              <div>
                <p className="text-2xl text-gray-800 mb-2">Current Image:</p>
                <div className="w-48 h-28 border border-gray-200 rounded-md overflow-hidden bg-gray-50">
                  <img
                    src={toAssetUrl(menu.image_path)}
                    alt={menu.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {successMessage && (
              <p className="text-sm text-green-600">{successMessage}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-2xl hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Updating..." : "Update Menu"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/admin/menu/menus")}
                className="px-4 py-2 bg-gray-500 text-white rounded-md text-2xl hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}