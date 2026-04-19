import { useEffect, useMemo, useRef, useState } from "react";

import ActionDialog from "@/components/shared/ActionDialog";
import SuperAdminLayout from "@/components/shared/SuperAdminLayout";
import { hasAnyPlatformScope } from "@/features/platform-access/catalog";
import {
  createRestaurant,
  createRestaurantUser,
  deleteRestaurant,
  deleteRestaurantUser,
  expireOverdueSubscriptions,
  generateRestaurantApiKey,
  generateRestaurantWebhookSecret,
  getRestaurant,
  getRestaurantIntegrationOps,
  getRestaurantPackageAccess,
  getRestaurantSubscription,
  getRestaurantSubscriptionHistory,
  listPackages,
  listRestaurantsOverview,
  listRestaurantUsers,
  refreshRestaurantWebhookHealth,
  revealRestaurantUserTemporaryPassword,
  resetRestaurantUserPassword,
  revokeRestaurantApiKey,
  revokeRestaurantWebhookSecret,
  retryRestaurantWebhookDelivery,
  rotateRestaurantApiKey,
  rotateRestaurantWebhookSecret,
  sendRestaurantWebhookTestDelivery,
  toggleRestaurantUser,
  updateRestaurant,
  updateRestaurantIntegration,
  updateRestaurantSubscription,
  uploadRestaurantLogo,
} from "@/features/super-admin/restaurants/api";
import { CreateRestaurantForm } from "@/features/super-admin/restaurants/components/CreateRestaurantForm";
import { IntegrationPanel } from "@/features/super-admin/restaurants/components/IntegrationPanel";
import { RestaurantList } from "@/features/super-admin/restaurants/components/RestaurantList";
import { RestaurantProfilePanel } from "@/features/super-admin/restaurants/components/RestaurantProfilePanel";
import { StaffPanel } from "@/features/super-admin/restaurants/components/StaffPanel";
import { SubscriptionPanel } from "@/features/super-admin/restaurants/components/SubscriptionPanel";
import type {
  AddHotelUserFormState,
  ConfirmActionState,
  InlineMessage,
  IntegrationFormState,
  SubscriptionFormState,
} from "@/features/super-admin/restaurants/types";
import { getUser } from "@/lib/auth";
import type {
  RestaurantAdminUpdateRequest,
  RestaurantCreateRequest,
  RestaurantFeatureFlags,
  RestaurantIntegrationOpsResponse,
  RestaurantMeResponse,
} from "@/types/restaurant";
import type {
  PackageDetailResponse,
  SubscriptionAccessSummaryResponse,
  SubscriptionChangeHistoryItemResponse,
  SubscriptionResponse,
} from "@/types/subscription";
import {
  STAFF_ROLES,
  type StaffDetailResponse,
  type UserRole,
} from "@/types/user";

const EMPTY_CREATE_FORM: RestaurantCreateRequest = { name: "" };
const EMPTY_EDIT_FORM: RestaurantAdminUpdateRequest = {};
const EMPTY_SUB_FORM: SubscriptionFormState = {
  status: "",
  expires_at: "",
  package_id: "",
  change_reason: "",
};
const EMPTY_INTEGRATION_FORM: IntegrationFormState = {
  public_ordering_enabled: false,
  webhook_url: "",
  webhook_secret_header_name: "",
};
const EMPTY_USER_FORM: AddHotelUserFormState = {
  full_name: "",
  email: "",
  password: "",
  role: "admin",
};

function getAvailableStaffRoles(
  featureFlags: RestaurantFeatureFlags | null | undefined,
): UserRole[] {
  if (!featureFlags) {
    return [...STAFF_ROLES];
  }

  return STAFF_ROLES.filter((role) => {
    switch (role) {
      case "steward":
        return featureFlags.steward;
      case "housekeeper":
        return featureFlags.housekeeping;
      case "cashier":
        return featureFlags.cashier;
      case "accountant":
        return featureFlags.accountant;
      default:
        return true;
    }
  });
}

function buildReadOnlySubscriptionMessage(): InlineMessage {
  return {
    type: "err",
    text: "Billing Admin scope is required to change package assignments or subscription status.",
  };
}

export default function SuperAdminRestaurants() {
  const currentUser = getUser();
  const canManageTenants = hasAnyPlatformScope(currentUser?.super_admin_scopes, ["tenant_admin"]);
  const canManageBilling = hasAnyPlatformScope(currentUser?.super_admin_scopes, ["billing_admin"]);
  const canManageSecurity = hasAnyPlatformScope(currentUser?.super_admin_scopes, ["security_admin"]);

  const [list, setList] = useState<RestaurantMeResponse[]>([]);
  const [subscriptionStatusByHotel, setSubscriptionStatusByHotel] = useState<
    Record<number, string>
  >({});
  const [packages, setPackages] = useState<PackageDetailResponse[]>([]);
  const [hotelUsers, setHotelUsers] = useState<StaffDetailResponse[]>([]);
  const [selected, setSelected] = useState<RestaurantMeResponse | null>(null);
  const [selectedSub, setSelectedSub] = useState<SubscriptionResponse | null>(null);
  const [selectedAccess, setSelectedAccess] =
    useState<SubscriptionAccessSummaryResponse | null>(null);
  const [selectedSubHistory, setSelectedSubHistory] = useState<
    SubscriptionChangeHistoryItemResponse[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RestaurantCreateRequest>(EMPTY_CREATE_FORM);
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null);
  const [createMsg, setCreateMsg] = useState<InlineMessage>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<RestaurantAdminUpdateRequest>(EMPTY_EDIT_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<InlineMessage>(null);

  const [editingSub, setEditingSub] = useState(false);
  const [subForm, setSubForm] = useState<SubscriptionFormState>(EMPTY_SUB_FORM);
  const [savingSub, setSavingSub] = useState(false);
  const [subMsg, setSubMsg] = useState<InlineMessage>(null);

  const [integrationForm, setIntegrationForm] = useState<IntegrationFormState>(
    EMPTY_INTEGRATION_FORM,
  );
  const [selectedIntegrationOps, setSelectedIntegrationOps] =
    useState<RestaurantIntegrationOpsResponse | null>(null);
  const [integrationOpsLoading, setIntegrationOpsLoading] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [refreshingWebhook, setRefreshingWebhook] = useState(false);
  const [sendingTestDelivery, setSendingTestDelivery] = useState(false);
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<number | null>(null);
  const [integrationMsg, setIntegrationMsg] = useState<InlineMessage>(null);
  const [apiKeyAction, setApiKeyAction] = useState<"generate" | "rotate" | "revoke" | null>(
    null,
  );
  const [webhookSecretAction, setWebhookSecretAction] = useState<
    "generate" | "rotate" | "revoke" | null
  >(null);
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);
  const [revealedWebhookSecret, setRevealedWebhookSecret] = useState<string | null>(null);

  const [expiringOverdue, setExpiringOverdue] = useState(false);
  const [expireMsg, setExpireMsg] = useState<InlineMessage>(null);

  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState<AddHotelUserFormState>(EMPTY_USER_FORM);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserMsg, setAddUserMsg] = useState<InlineMessage>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);

  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [uploadingEditLogo, setUploadingEditLogo] = useState(false);
  const [editLogoMsg, setEditLogoMsg] = useState<InlineMessage>(null);
  const createLogoRef = useRef<HTMLInputElement | null>(null);
  const editLogoRef = useRef<HTMLInputElement | null>(null);

  const availableStaffRoles = useMemo(
    () => getAvailableStaffRoles(selected?.feature_flags),
    [selected?.feature_flags],
  );

  useEffect(() => {
    void loadPage();
  }, []);

  useEffect(() => {
    if (availableStaffRoles.includes(addUserForm.role)) {
      return;
    }
    setAddUserForm((current) => ({
      ...current,
      role: availableStaffRoles[0] ?? "admin",
    }));
  }, [addUserForm.role, availableStaffRoles]);

  function applySelectedRestaurant(restaurant: RestaurantMeResponse | null) {
    setSelected(restaurant);
    setIntegrationForm(
      restaurant
        ? {
            public_ordering_enabled: restaurant.integration.settings.public_ordering_enabled,
            webhook_url: restaurant.integration.settings.webhook_url ?? "",
            webhook_secret_header_name:
              restaurant.integration.settings.webhook_secret_header_name ?? "",
          }
        : EMPTY_INTEGRATION_FORM,
    );
    setSelectedIntegrationOps(null);
    setIntegrationMsg(null);
    setRevealedApiKey(null);
    setRevealedWebhookSecret(null);
  }

  async function loadIntegrationOps(restaurantId: number) {
    if (!canManageSecurity) {
      setSelectedIntegrationOps(null);
      return;
    }
    setIntegrationOpsLoading(true);
    try {
      const ops = await getRestaurantIntegrationOps(restaurantId);
      setSelectedIntegrationOps(ops);
    } catch {
      setSelectedIntegrationOps(null);
    } finally {
      setIntegrationOpsLoading(false);
    }
  }

  async function loadPage() {
    setLoading(true);
    try {
      const [overview, packageItems] = await Promise.all([
        listRestaurantsOverview(),
        canManageBilling ? listPackages() : Promise.resolve<PackageDetailResponse[]>([]),
      ]);

      const statusMap = Object.fromEntries(
        overview.subscriptions.map((item) => [item.restaurant_id, item.status]),
      );

      setList(overview.items);
      setPackages(packageItems);
      setSubscriptionStatusByHotel(statusMap);
      setFetchError(null);
    } catch {
      setFetchError("Failed to load restaurants.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchHotelExtras(restaurantId: number) {
    setSubLoading(true);
    setUsersLoading(canManageTenants);
    setIntegrationOpsLoading(canManageSecurity);
    setSelectedSub(null);
    setSelectedAccess(null);
    setSelectedSubHistory([]);
    setHotelUsers([]);
    setSelectedIntegrationOps(null);
    setSubMsg(null);
    setAddUserMsg(null);
    setResettingUserId(null);
    setIntegrationMsg(null);
    setRevealedApiKey(null);
    setRevealedWebhookSecret(null);
    setEditingSub(false);
    setShowAddUser(false);

    const [subResult, accessResult, integrationOpsResult, usersResult, historyResult] =
      await Promise.allSettled([
      getRestaurantSubscription(restaurantId),
      getRestaurantPackageAccess(restaurantId),
      canManageSecurity
        ? getRestaurantIntegrationOps(restaurantId)
        : Promise.resolve<RestaurantIntegrationOpsResponse | null>(null),
      canManageTenants
        ? listRestaurantUsers(restaurantId)
        : Promise.resolve<StaffDetailResponse[]>([]),
      getRestaurantSubscriptionHistory(restaurantId),
      ]);

    if (subResult.status === "fulfilled") {
      const subscription = subResult.value;
      setSelectedSub(subscription);
      setSubForm({
        status: subscription.status,
        expires_at: subscription.expires_at
          ? new Date(subscription.expires_at).toISOString().slice(0, 10)
          : "",
        package_id: subscription.package_id?.toString() ?? "",
        change_reason: "",
      });
    }
    if (accessResult.status === "fulfilled") {
      setSelectedAccess(accessResult.value);
    }
    if (integrationOpsResult.status === "fulfilled") {
      setSelectedIntegrationOps(integrationOpsResult.value);
    }
    if (usersResult.status === "fulfilled") {
      setHotelUsers(usersResult.value);
    }
    if (historyResult.status === "fulfilled") {
      setSelectedSubHistory(historyResult.value.items);
    }

    setSubLoading(false);
    setUsersLoading(false);
    setIntegrationOpsLoading(false);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageTenants) {
      setCreateMsg({
        type: "err",
        text: "Tenant Admin scope is required to register a hotel.",
      });
      return;
    }

    setCreating(true);
    setCreateMsg(null);
    try {
      const created = await createRestaurant(form);
      if (createLogoFile) {
        try {
          const logoData = await uploadRestaurantLogo(created.id, createLogoFile);
          created.logo_url = logoData.logo_url;
        } catch {
          // Logo upload failure should not block restaurant creation.
        }
      }
      setList((current) => [created, ...current]);
      setSubscriptionStatusByHotel((current) => ({ ...current, [created.id]: "trial" }));
      setShowCreate(false);
      setForm(EMPTY_CREATE_FORM);
      setCreateLogoFile(null);
      if (createLogoRef.current) {
        createLogoRef.current.value = "";
      }
      setCreateMsg({ type: "ok", text: `Hotel "${created.name}" registered successfully.` });
    } catch (error) {
      setCreateMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to register hotel.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleView(restaurantId: number) {
    setSelectedLoading(true);
    setSelectedError(null);
    setActionMsg(null);
    setEditingId(null);
    setEditLogoMsg(null);
    try {
      const restaurant = await getRestaurant(restaurantId);
      applySelectedRestaurant(restaurant);
      void fetchHotelExtras(restaurantId);
    } catch {
      setSelectedError("Failed to load hotel profile.");
    } finally {
      setSelectedLoading(false);
    }
  }

  async function handleStartEdit(restaurantId: number) {
    if (!canManageTenants) {
      setActionMsg({
        type: "err",
        text: "Tenant Admin scope is required to edit hotel profiles.",
      });
      return;
    }

    setSelectedLoading(true);
    setSelectedError(null);
    setActionMsg(null);
    setEditLogoMsg(null);
    try {
      const restaurant = await getRestaurant(restaurantId);
      applySelectedRestaurant(restaurant);
      setEditingId(restaurantId);
      setEditForm({
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone,
        address: restaurant.address,
        public_menu_banner_urls: restaurant.public_menu_banner_urls,
        feature_flags: restaurant.feature_flags,
        is_active: restaurant.is_active,
      });
      void fetchHotelExtras(restaurantId);
    } catch {
      setSelectedError("Failed to load hotel for editing.");
    } finally {
      setSelectedLoading(false);
    }
  }

  async function handleEditLogoUpload(file: File) {
    if (!selected) return;
    if (!canManageTenants) {
      setEditLogoMsg({
        type: "err",
        text: "Tenant Admin scope is required to update hotel branding.",
      });
      return;
    }

    setUploadingEditLogo(true);
    setEditLogoMsg(null);
    try {
      const data = await uploadRestaurantLogo(selected.id, file);
      setSelected((current) => (current ? { ...current, logo_url: data.logo_url } : current));
      setList((current) =>
        current.map((restaurant) =>
          restaurant.id === selected.id ? { ...restaurant, logo_url: data.logo_url } : restaurant,
        ),
      );
      setEditLogoMsg({ type: "ok", text: "Logo updated." });
    } catch (error) {
      setEditLogoMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Upload failed.",
      });
    } finally {
      setUploadingEditLogo(false);
      if (editLogoRef.current) {
        editLogoRef.current.value = "";
      }
    }
  }

  async function handleSaveEdit() {
    if (editingId === null) return;
    if (!canManageTenants) {
      setActionMsg({
        type: "err",
        text: "Tenant Admin scope is required to update hotel profiles.",
      });
      return;
    }

    setSaving(true);
    setActionMsg(null);
    try {
      const updated = await updateRestaurant(editingId, editForm);
      const accessSummary = await getRestaurantPackageAccess(editingId);
      setList((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      applySelectedRestaurant(updated);
      setSelectedAccess(accessSummary);
      setEditingId(null);
      setActionMsg({ type: "ok", text: `Hotel "${updated.name}" updated.` });
    } catch (error) {
      setActionMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to update hotel.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    const pendingAction = confirmAction;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await pendingAction.onConfirm();
      setConfirmAction((current) => (current === pendingAction ? null : current));
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setConfirmBusy(false);
    }
  }

  async function deleteRestaurantRecord(restaurantId: number) {
    if (!canManageTenants) {
      setActionMsg({
        type: "err",
        text: "Tenant Admin scope is required to delete hotels.",
      });
      return;
    }

    setDeletingId(restaurantId);
    setActionMsg(null);
    try {
      const result = await deleteRestaurant(restaurantId);
      setList((current) => current.filter((item) => item.id !== restaurantId));
      setSubscriptionStatusByHotel((current) => {
        const next = { ...current };
        delete next[restaurantId];
        return next;
      });
      if (selected?.id === restaurantId) {
        closeSelectedPanel();
      }
      setActionMsg({ type: "ok", text: result.message });
    } finally {
      setDeletingId(null);
    }
  }

  function handleDelete(restaurantId: number, restaurantName: string) {
    setConfirmError(null);
    setConfirmAction({
      title: "Delete Hotel",
      description: `Delete "${restaurantName}" permanently? This cannot be undone.`,
      confirmLabel: "Delete Hotel",
      confirmTone: "danger",
      onConfirm: async () => {
        await deleteRestaurantRecord(restaurantId);
      },
    });
  }

  async function handleSaveSub() {
    if (!selected) return;
    if (!canManageBilling) {
      setSubMsg(buildReadOnlySubscriptionMessage());
      return;
    }

    const payload: {
      status?: string;
      expires_at?: string;
      package_id?: number;
      change_reason?: string | null;
    } = {};
    if (subForm.status) payload.status = subForm.status;
    if (subForm.expires_at) payload.expires_at = new Date(subForm.expires_at).toISOString();
    if (subForm.package_id) payload.package_id = parseInt(subForm.package_id, 10);
    if (subForm.change_reason.trim()) payload.change_reason = subForm.change_reason.trim();
    if (Object.keys(payload).length === 0) {
      setSubMsg({ type: "err", text: "No changes to save." });
      return;
    }

    setSavingSub(true);
    setSubMsg(null);
    try {
      const updated = await updateRestaurantSubscription(selected.id, payload);
      const [accessSummary, history] = await Promise.all([
        getRestaurantPackageAccess(selected.id),
        getRestaurantSubscriptionHistory(selected.id),
      ]);
      setSelectedSub(updated);
      setSelectedAccess(accessSummary);
      setSelectedSubHistory(history.items);
      setSubscriptionStatusByHotel((current) => ({ ...current, [selected.id]: updated.status }));
      setEditingSub(false);
      setSubForm({
        status: updated.status,
        expires_at: updated.expires_at
          ? new Date(updated.expires_at).toISOString().slice(0, 10)
          : "",
        package_id: updated.package_id?.toString() ?? "",
        change_reason: "",
      });
      setSubMsg({ type: "ok", text: "Subscription updated successfully." });
    } catch (error) {
      setSubMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to update subscription.",
      });
    } finally {
      setSavingSub(false);
    }
  }

  async function handleExpireOverdue() {
    if (!canManageBilling) {
      setExpireMsg(buildReadOnlySubscriptionMessage());
      return;
    }

    setExpiringOverdue(true);
    setExpireMsg(null);
    try {
      const result = await expireOverdueSubscriptions();
      setExpireMsg({ type: "ok", text: result.message });
      await loadPage();
    } catch (error) {
      setExpireMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Expiry check failed.",
      });
    } finally {
      setExpiringOverdue(false);
    }
  }

  async function handleAddUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (!canManageTenants) {
      setAddUserMsg({
        type: "err",
        text: "Tenant Admin scope is required to manage hotel staff.",
      });
      return;
    }

    setAddingUser(true);
    setAddUserMsg(null);
    try {
      const newUser = await createRestaurantUser(selected.id, addUserForm);
      setHotelUsers((current) => [newUser, ...current]);
      setShowAddUser(false);
      setAddUserForm({
        ...EMPTY_USER_FORM,
        role: availableStaffRoles[0] ?? EMPTY_USER_FORM.role,
      });
      setAddUserMsg({ type: "ok", text: `"${newUser.full_name}" added successfully.` });
    } catch (error) {
      setAddUserMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to add staff member.",
      });
    } finally {
      setAddingUser(false);
    }
  }

  async function removeHotelUser(userId: number) {
    if (!selected) return;
    if (!canManageTenants) {
      setAddUserMsg({
        type: "err",
        text: "Tenant Admin scope is required to manage hotel staff.",
      });
      return;
    }

    setDeletingUserId(userId);
    setAddUserMsg(null);
    try {
      await deleteRestaurantUser(selected.id, userId);
      setHotelUsers((current) => current.filter((user) => user.id !== userId));
    } finally {
      setDeletingUserId(null);
    }
  }

  function handleDeleteUser(userId: number, userName: string) {
    if (!selected) return;
    setConfirmError(null);
    setConfirmAction({
      title: "Remove Hotel User",
      description: `Remove "${userName}" from this hotel staff list?`,
      confirmLabel: "Remove User",
      confirmTone: "danger",
      onConfirm: async () => {
        await removeHotelUser(userId);
      },
    });
  }

  async function resetHotelUserPassword(userId: number, userName: string) {
    if (!selected) return;
    if (!canManageTenants) {
      setAddUserMsg({
        type: "err",
        text: "Tenant Admin scope is required to manage hotel staff.",
      });
      return;
    }

    setResettingUserId(userId);
    setAddUserMsg(null);
    try {
      const restaurantId = selected.id;
      const result = await resetRestaurantUserPassword(restaurantId, userId);

      if (result.email_sent) {
        setAddUserMsg({
          type: "ok",
          text: `${result.message} Temporary password was sent to the user's email.`,
        });
        return;
      }

      if (result.reveal_token) {
        const revealToken = result.reveal_token;
        const expiresAt = result.reveal_expires_at
          ? new Date(result.reveal_expires_at).toLocaleString()
          : null;
        setAddUserMsg({
          type: "ok",
          text:
            `${result.message} Email delivery failed for "${userName}". ` +
            "Use one-time secure reveal to view the temporary password." +
            (expiresAt ? ` Token expires at ${expiresAt}.` : ""),
        });
        setConfirmError(null);
        setConfirmAction({
          title: "Reveal Temporary Password",
          description:
            `Email delivery failed for "${userName}". Reveal the temporary password now? ` +
            "This secret can be viewed only once and should be shared immediately.",
          confirmLabel: "Reveal Once",
          confirmTone: "warning",
          onConfirm: async () => {
            const reveal = await revealRestaurantUserTemporaryPassword(restaurantId, userId, {
              reveal_token: revealToken,
            });
            setAddUserMsg({
              type: "ok",
              text:
                `${reveal.message} Temporary password for "${userName}": ` +
                `${reveal.temporary_password}. Share it securely now.`,
            });
          },
        });
        return;
      }

      setAddUserMsg({
        type: "err",
        text:
          `${result.message} Email delivery failed and no secure reveal token was issued. ` +
          "Retry reset and verify notification configuration.",
      });
    } catch (error) {
      setAddUserMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to reset user password.",
      });
    } finally {
      setResettingUserId(null);
    }
  }

  function handleResetUserPassword(userId: number, userName: string, role: UserRole) {
    if (!selected) return;
    const roleLabel = role === "owner" ? "Owner" : "Admin";

    setConfirmError(null);
    setConfirmAction({
      title: "Reset Staff Password",
      description:
        `Generate a temporary password for "${userName}" (${roleLabel})? ` +
        "The user must change it on next login. Delivery is email-first with secure reveal fallback.",
      confirmLabel: "Generate Temporary Password",
      confirmTone: "warning",
      onConfirm: async () => {
        await resetHotelUserPassword(userId, userName);
      },
    });
  }

  async function handleToggleUser(userId: number, isActive: boolean) {
    if (!selected) return;
    if (!canManageTenants) {
      setAddUserMsg({
        type: "err",
        text: "Tenant Admin scope is required to manage hotel staff.",
      });
      return;
    }

    setTogglingUserId(userId);
    try {
      const action = isActive ? "disable" : "enable";
      const result = await toggleRestaurantUser(selected.id, userId, action);
      setHotelUsers((current) =>
        current.map((user) =>
          user.id === userId ? { ...user, is_active: result.is_active } : user,
        ),
      );
    } catch (error) {
      setAddUserMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to update user status.",
      });
    } finally {
      setTogglingUserId(null);
    }
  }

  async function handleSaveIntegration() {
    if (!selected) return;
    if (!canManageSecurity) {
      setIntegrationMsg({
        type: "err",
        text: "Security Admin scope is required to update integration settings.",
      });
      return;
    }

    setSavingIntegration(true);
    setIntegrationMsg(null);
    try {
      const integration = await updateRestaurantIntegration(selected.id, {
        public_ordering_enabled: integrationForm.public_ordering_enabled,
        webhook_url: integrationForm.webhook_url.trim() || null,
        webhook_secret_header_name: integrationForm.webhook_secret_header_name.trim() || null,
      });
      setSelected((current) => (current ? { ...current, integration } : current));
      setIntegrationForm({
        public_ordering_enabled: integration.settings.public_ordering_enabled,
        webhook_url: integration.settings.webhook_url ?? "",
        webhook_secret_header_name: integration.settings.webhook_secret_header_name ?? "",
      });
      await loadIntegrationOps(selected.id);
      setIntegrationMsg({ type: "ok", text: "Integration settings updated." });
    } catch (error) {
      setIntegrationMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to update integration settings.",
      });
    } finally {
      setSavingIntegration(false);
    }
  }

  async function handleGenerateApiKey(rotate: boolean) {
    if (!selected) return;
    if (!canManageSecurity) {
      setIntegrationMsg({
        type: "err",
        text: "Security Admin scope is required to manage API keys.",
      });
      return;
    }

    setApiKeyAction(rotate ? "rotate" : "generate");
    setIntegrationMsg(null);
    try {
      const response = rotate
        ? await rotateRestaurantApiKey(selected.id)
        : await generateRestaurantApiKey(selected.id);
      setSelected((current) =>
        current
          ? {
              ...current,
              integration: {
                ...current.integration,
                api_key: response.summary,
              },
            }
          : current,
      );
      setRevealedApiKey(response.api_key);
      setIntegrationMsg({ type: "ok", text: response.message });
    } catch (error) {
      setIntegrationMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to provision API key.",
      });
    } finally {
      setApiKeyAction(null);
    }
  }

  async function handleRevokeApiKey() {
    if (!selected) return;
    if (!canManageSecurity) {
      setIntegrationMsg({
        type: "err",
        text: "Security Admin scope is required to manage API keys.",
      });
      return;
    }

    setApiKeyAction("revoke");
    setIntegrationMsg(null);
    try {
      const summary = await revokeRestaurantApiKey(selected.id);
      setSelected((current) =>
        current
          ? {
              ...current,
              integration: {
                ...current.integration,
                api_key: summary,
              },
            }
          : current,
      );
      setRevealedApiKey(null);
      setIntegrationMsg({ type: "ok", text: "API key revoked successfully." });
    } catch (error) {
      setIntegrationMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to revoke API key.",
      });
    } finally {
      setApiKeyAction(null);
    }
  }

  async function handleGenerateWebhookSecret(rotate: boolean) {
    if (!selected) return;
    if (!canManageSecurity) {
      setIntegrationMsg({
        type: "err",
        text: "Security Admin scope is required to manage webhook secrets.",
      });
      return;
    }

    setWebhookSecretAction(rotate ? "rotate" : "generate");
    setIntegrationMsg(null);
    try {
      const response = rotate
        ? await rotateRestaurantWebhookSecret(selected.id)
        : await generateRestaurantWebhookSecret(selected.id);
      setSelected((current) =>
        current
          ? {
              ...current,
              integration: {
                ...current.integration,
                webhook_secret: response.summary,
                settings: {
                  ...current.integration.settings,
                  webhook_secret_header_name:
                    response.summary.header_name ?? current.integration.settings.webhook_secret_header_name,
                },
              },
            }
          : current,
      );
      setIntegrationForm((current) => ({
        ...current,
        webhook_secret_header_name: response.summary.header_name ?? current.webhook_secret_header_name,
      }));
      setRevealedWebhookSecret(response.secret_value);
      await loadIntegrationOps(selected.id);
      setIntegrationMsg({ type: "ok", text: response.message });
    } catch (error) {
      setIntegrationMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to provision webhook secret.",
      });
    } finally {
      setWebhookSecretAction(null);
    }
  }

  async function handleRevokeWebhookSecret() {
    if (!selected) return;
    if (!canManageSecurity) {
      setIntegrationMsg({
        type: "err",
        text: "Security Admin scope is required to manage webhook secrets.",
      });
      return;
    }

    setWebhookSecretAction("revoke");
    setIntegrationMsg(null);
    try {
      const summary = await revokeRestaurantWebhookSecret(selected.id);
      setSelected((current) =>
        current
          ? {
              ...current,
              integration: {
                ...current.integration,
                webhook_secret: summary,
              },
            }
          : current,
      );
      setRevealedWebhookSecret(null);
      await loadIntegrationOps(selected.id);
      setIntegrationMsg({ type: "ok", text: "Webhook secret revoked successfully." });
    } catch (error) {
      setIntegrationMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to revoke webhook secret.",
      });
    } finally {
      setWebhookSecretAction(null);
    }
  }

  async function handleRefreshWebhook() {
    if (!selected) return;
    if (!canManageSecurity) {
      setIntegrationMsg({
        type: "err",
        text: "Security Admin scope is required to refresh webhook health.",
      });
      return;
    }

    setRefreshingWebhook(true);
    setIntegrationMsg(null);
    try {
      const response = await refreshRestaurantWebhookHealth(selected.id);
      setSelected((current) =>
        current
          ? {
              ...current,
              integration: {
                ...current.integration,
                settings: response.settings,
              },
            }
          : current,
      );
      await loadIntegrationOps(selected.id);
      setIntegrationMsg({ type: "ok", text: response.message });
    } catch (error) {
      setIntegrationMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to refresh webhook health.",
      });
    } finally {
      setRefreshingWebhook(false);
    }
  }

  async function handleSendTestDelivery() {
    if (!selected) return;
    if (!canManageSecurity) {
      setIntegrationMsg({
        type: "err",
        text: "Security Admin scope is required to send test webhook deliveries.",
      });
      return;
    }

    setSendingTestDelivery(true);
    setIntegrationMsg(null);
    try {
      const response = await sendRestaurantWebhookTestDelivery(selected.id);
      const health = await refreshRestaurantWebhookHealth(selected.id);
      setSelected((current) =>
        current
          ? {
              ...current,
              integration: {
                ...current.integration,
                settings: health.settings,
              },
            }
          : current,
      );
      await loadIntegrationOps(selected.id);
      setIntegrationMsg({
        type: response.delivery.delivery_status === "success" ? "ok" : "err",
        text: response.message,
      });
    } catch (error) {
      setIntegrationMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to send test webhook delivery.",
      });
    } finally {
      setSendingTestDelivery(false);
    }
  }

  async function handleRetryDelivery(deliveryId: number) {
    if (!selected) return;
    if (!canManageSecurity) {
      setIntegrationMsg({
        type: "err",
        text: "Security Admin scope is required to retry webhook deliveries.",
      });
      return;
    }

    setRetryingDeliveryId(deliveryId);
    setIntegrationMsg(null);
    try {
      const response = await retryRestaurantWebhookDelivery(selected.id, deliveryId);
      const health = await refreshRestaurantWebhookHealth(selected.id);
      setSelected((current) =>
        current
          ? {
              ...current,
              integration: {
                ...current.integration,
                settings: health.settings,
              },
            }
          : current,
      );
      await loadIntegrationOps(selected.id);
      setIntegrationMsg({
        type: response.delivery.delivery_status === "success" ? "ok" : "err",
        text: response.message,
      });
    } catch (error) {
      setIntegrationMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Failed to retry webhook delivery.",
      });
    } finally {
      setRetryingDeliveryId(null);
    }
  }

  function closeSelectedPanel() {
    applySelectedRestaurant(null);
    setEditingId(null);
    setEditLogoMsg(null);
    setSelectedSub(null);
    setSelectedAccess(null);
    setSelectedSubHistory([]);
    setSelectedIntegrationOps(null);
    setIntegrationOpsLoading(false);
    setHotelUsers([]);
    setSubMsg(null);
    setAddUserMsg(null);
    setShowAddUser(false);
    setAddUserForm(EMPTY_USER_FORM);
    setResettingUserId(null);
    setWebhookSecretAction(null);
    setSendingTestDelivery(false);
    setRetryingDeliveryId(null);
  }

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Hotels</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage tenant profiles, package access, security integrations, and scoped hotel
              operations from one workspace.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {expireMsg && (
              <span
                className={`text-xs ${expireMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}
              >
                {expireMsg.text}
              </span>
            )}
            {canManageBilling && (
              <button
                type="button"
                onClick={() => void handleExpireOverdue()}
                disabled={expiringOverdue}
                className="rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
              >
                {expiringOverdue ? "Checking..." : "Run Expiry Check"}
              </button>
            )}
            {canManageTenants && (
              <button
                type="button"
                onClick={() => {
                  setShowCreate(true);
                  setCreateMsg(null);
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Register Hotel
              </button>
            )}
          </div>
        </div>
        {createMsg && (
          <p className={`text-sm ${createMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
            {createMsg.text}
          </p>
        )}
        {actionMsg && (
          <p className={`text-sm ${actionMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
            {actionMsg.text}
          </p>
        )}

        {showCreate && canManageTenants && (
          <CreateRestaurantForm
            form={form}
            creating={creating}
            createLogoRef={createLogoRef}
            onFormChange={setForm}
            onLogoChange={setCreateLogoFile}
            onSubmit={(event) => void handleCreate(event)}
            onCancel={() => {
              setShowCreate(false);
              setCreateLogoFile(null);
              setForm(EMPTY_CREATE_FORM);
              if (createLogoRef.current) {
                createLogoRef.current.value = "";
              }
            }}
          />
        )}

        <RestaurantList
          loading={loading}
          fetchError={fetchError}
          list={list}
          selectedId={selected?.id ?? null}
          deletingId={deletingId}
          canManageTenants={canManageTenants}
          subscriptionStatusByHotel={subscriptionStatusByHotel}
          onView={(restaurantId) => void handleView(restaurantId)}
          onEdit={(restaurantId) => void handleStartEdit(restaurantId)}
          onDelete={handleDelete}
        />

        {(selectedLoading || selectedError || selected) && (
          <div className="space-y-4">
            <RestaurantProfilePanel
              selected={selected}
              selectedLoading={selectedLoading}
              selectedError={selectedError}
              editingId={editingId}
              editForm={editForm}
              saving={saving}
              actionMsg={actionMsg}
              uploadingEditLogo={uploadingEditLogo}
              editLogoMsg={editLogoMsg}
              editLogoRef={editLogoRef}
              onClose={closeSelectedPanel}
              onStartEditChange={setEditForm}
              onSave={() => void handleSaveEdit()}
              onCancelEdit={() => {
                setEditingId(null);
                setSelectedError(null);
                setEditLogoMsg(null);
              }}
              onLogoUpload={(file) => void handleEditLogoUpload(file)}
            />

            {selected && canManageSecurity && (
              <IntegrationPanel
                selected={selected}
                form={integrationForm}
                ops={selectedIntegrationOps}
                opsLoading={integrationOpsLoading}
                savingIntegration={savingIntegration}
                refreshingWebhook={refreshingWebhook}
                sendingTestDelivery={sendingTestDelivery}
                retryingDeliveryId={retryingDeliveryId}
                apiKeyAction={apiKeyAction}
                webhookSecretAction={webhookSecretAction}
                message={integrationMsg}
                revealedApiKey={revealedApiKey}
                revealedWebhookSecret={revealedWebhookSecret}
                onFormChange={setIntegrationForm}
                onSave={() => void handleSaveIntegration()}
                onRefreshWebhook={() => void handleRefreshWebhook()}
                onGenerateApiKey={() => void handleGenerateApiKey(false)}
                onRotateApiKey={() => void handleGenerateApiKey(true)}
                onRevokeApiKey={() => void handleRevokeApiKey()}
                onGenerateWebhookSecret={() => void handleGenerateWebhookSecret(false)}
                onRotateWebhookSecret={() => void handleGenerateWebhookSecret(true)}
                onRevokeWebhookSecret={() => void handleRevokeWebhookSecret()}
                onSendTestDelivery={() => void handleSendTestDelivery()}
                onRetryDelivery={(deliveryId) => void handleRetryDelivery(deliveryId)}
              />
            )}

            {selected && (
              <SubscriptionPanel
                selectedSub={selectedSub}
                accessSummary={selectedAccess}
                historyItems={selectedSubHistory}
                packages={packages}
                canManageBilling={canManageBilling}
                subLoading={subLoading}
                editingSub={editingSub}
                savingSub={savingSub}
                subForm={subForm}
                subMsg={subMsg}
                onEditToggle={setEditingSub}
                onFormChange={setSubForm}
                onSave={() => void handleSaveSub()}
              />
            )}

            {selected && canManageTenants && (
              <StaffPanel
                hotelUsers={hotelUsers}
                usersLoading={usersLoading}
                showAddUser={showAddUser}
                addUserForm={addUserForm}
                addingUser={addingUser}
                addUserMsg={addUserMsg}
                availableRoles={availableStaffRoles}
                deletingUserId={deletingUserId}
                togglingUserId={togglingUserId}
                resettingUserId={resettingUserId}
                onToggleAddUser={() => {
                  setShowAddUser((current) => !current);
                  setAddUserMsg(null);
                }}
                onFormChange={setAddUserForm}
                onSubmit={(event) => void handleAddUser(event)}
                onToggleUser={(userId, isActive) => void handleToggleUser(userId, isActive)}
                onDeleteUser={handleDeleteUser}
                onResetUserPassword={handleResetUserPassword}
              />
            )}
          </div>
        )}

        {confirmAction && (
          <ActionDialog
            title={confirmAction.title}
            description={confirmAction.description}
            error={confirmError}
            busy={confirmBusy}
            onClose={() => {
              if (confirmBusy) return;
              setConfirmAction(null);
              setConfirmError(null);
            }}
            onConfirm={() => void runConfirmedAction()}
            confirmLabel={confirmBusy ? "Processing..." : confirmAction.confirmLabel}
            confirmTone={confirmAction.confirmTone}
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}
