import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { Category, Item, Menu } from "@/types/menu";
import type { OfferImageUploadResponse, OfferResponse } from "@/types/offer";

import { EMPTY_OFFER_FORM, type OfferFormData } from "../types/offerForm";
import {
  buildOfferPayload,
  getErrorMessage,
  getProductOptions,
  mapOfferToFormData,
  todayDateString,
  validateOfferForm,
} from "../utils/offerHelpers";
import { IMAGE_MAX_BYTES, VALID_IMAGE_TYPES } from "../utils/offerConstants";

type Params = {
  offerId: number | null;
  isEditMode: boolean;
  enabled: boolean;
  menus: Menu[];
  categories: Category[];
  items: Item[];
};

export function useOfferForm({
  offerId,
  isEditMode,
  enabled,
  menus,
  categories,
  items,
}: Params) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OfferFormData>(EMPTY_OFFER_FORM);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [originalStartDate, setOriginalStartDate] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const today = todayDateString();

  const productOptions = useMemo(
    () =>
      getProductOptions({
        productType: formData.product_type,
        menus,
        categories,
        items,
      }),
    [categories, formData.product_type, items, menus]
  );

  const minStartDate = useMemo(() => {
    if (!isEditMode) return today;
    if (originalStartDate && originalStartDate < today) return originalStartDate;
    return today;
  }, [isEditMode, originalStartDate, today]);

  const loadOffer = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (isEditMode && (!offerId || Number.isNaN(offerId) || offerId <= 0)) {
      setPageError("Invalid offer id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError(null);
    setFormError(null);

    try {
      if (!isEditMode || !offerId) {
        setFormData(EMPTY_OFFER_FORM);
        setExistingImagePath(null);
        setOriginalStartDate(null);
        return;
      }

      const offer = await api.get<OfferResponse>(`/offers/${offerId}`);
      setFormData(mapOfferToFormData(offer));
      setExistingImagePath(offer.image_path);
      setOriginalStartDate(offer.start_date);
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to load offer details."));
    } finally {
      setLoading(false);
    }
  }, [enabled, isEditMode, offerId]);

  useEffect(() => {
    void loadOffer();
  }, [loadOffer]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const clearSelectedImage = useCallback(() => {
    setSelectedFile(null);
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (!file) {
        clearSelectedImage();
        return;
      }

      if (!VALID_IMAGE_TYPES.includes(file.type)) {
        setFormError("Invalid image format. Allowed: JPG, JPEG, PNG, WEBP, GIF.");
        clearSelectedImage();
        return;
      }

      if (file.size > IMAGE_MAX_BYTES) {
        setFormError("Image exceeds 5MB limit.");
        clearSelectedImage();
        return;
      }

      setFormError(null);
      setSelectedFile(file);
      setImagePreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
    },
    [clearSelectedImage]
  );

  const handleStartDateChange = useCallback((value: string) => {
    setFormData((current) => ({
      ...current,
      start_date: value,
      end_date:
        current.end_date && value && current.end_date < value
          ? value
          : current.end_date,
    }));
  }, []);

  const uploadImage = useCallback(
    async (targetOfferId: number) => {
      if (!selectedFile) return;

      const body = new FormData();
      body.append("file", selectedFile);

      await api.post<OfferImageUploadResponse>(`/offers/${targetOfferId}/image`, body);
    },
    [selectedFile]
  );

  const saveOffer = useCallback(async () => {
    const validationMessage = validateOfferForm({
      formData,
      isEditMode,
      selectedFile,
      today,
      originalStartDate,
    });

    if (validationMessage) {
      setFormError(validationMessage);
      return { success: false as const };
    }

    setSaving(true);
    setFormError(null);
    setPageError(null);

    try {
      const payload = buildOfferPayload(formData);

      if (isEditMode && offerId) {
        await api.patch<OfferResponse>(`/offers/${offerId}`, payload);
        await uploadImage(offerId);
      } else {
        const created = await api.post<OfferResponse>("/offers", payload);
        await uploadImage(created.id);
      }

      return { success: true as const };
    } catch (error) {
      setFormError(getErrorMessage(error, "Failed to save offer."));
      return { success: false as const };
    } finally {
      setSaving(false);
    }
  }, [
    formData,
    isEditMode,
    offerId,
    originalStartDate,
    selectedFile,
    today,
    uploadImage,
  ]);

  return {
    loading,
    saving,
    pageError,
    formError,
    formData,
    setFormData,
    existingImagePath,
    selectedFile,
    imagePreviewUrl,
    productOptions,
    minStartDate,
    clearSelectedImage,
    handleFileChange,
    handleStartDateChange,
    saveOffer,
  };
}
