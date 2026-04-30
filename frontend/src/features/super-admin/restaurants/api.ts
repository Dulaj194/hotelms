import { api } from "@/lib/api";
import type {
  RestaurantApiKeyProvisionResponse,
  RestaurantAdminUpdateRequest,
  RestaurantCreateRequest,
  RestaurantDeleteResponse,
  RestaurantIntegrationResponse,
  RestaurantIntegrationOpsResponse,
  RestaurantIntegrationUpdateRequest,
  RestaurantWebhookDeliveryActionResponse,
  RestaurantLogoUploadResponse,
  RestaurantMeResponse,
  RestaurantOverviewListResponse,
  RestaurantWebhookSecretProvisionResponse,
  RestaurantWebhookSecretSummary,
  RestaurantWebhookHealthRefreshResponse,
} from "@/types/restaurant";
import type {
  PackageAdminListResponse,
  PackageDetailResponse,
  SubscriptionAccessSummaryResponse,
  SubscriptionChangeHistoryResponse,
  SubscriptionResponse,
  SuperAdminSubscriptionUpdateRequest,
} from "@/types/subscription";
import type {
  GenericMessageResponse,
  RestaurantStaffPasswordRevealResponse,
  RestaurantStaffPasswordResetResponse,
  StaffDetailResponse,
  UserRole,
} from "@/types/user";

export async function listRestaurants(): Promise<RestaurantMeResponse[]> {
  return api.get<RestaurantMeResponse[]>("/restaurants");
}

export async function listRestaurantsOverview(): Promise<RestaurantOverviewListResponse> {
  return api.get<RestaurantOverviewListResponse>("/restaurants/overview");
}

export async function listPackages(): Promise<PackageDetailResponse[]> {
  const response = await api.get<PackageAdminListResponse>("/packages/admin");
  return response.items;
}

export async function getRestaurant(restaurantId: number): Promise<RestaurantMeResponse> {
  return api.get<RestaurantMeResponse>(`/restaurants/${restaurantId}`);
}

export async function createRestaurant(
  payload: RestaurantCreateRequest,
): Promise<RestaurantMeResponse> {
  return api.post<RestaurantMeResponse>("/restaurants", payload);
}

export async function uploadRestaurantLogo(
  restaurantId: number,
  file: File,
): Promise<RestaurantLogoUploadResponse> {
  const body = new FormData();
  body.append("file", file);
  return api.post<RestaurantLogoUploadResponse>(`/restaurants/${restaurantId}/logo`, body);
}

export async function updateRestaurant(
  restaurantId: number,
  payload: RestaurantAdminUpdateRequest,
): Promise<RestaurantMeResponse> {
  return api.patch<RestaurantMeResponse>(`/restaurants/${restaurantId}`, payload);
}

export async function deleteRestaurant(
  restaurantId: number,
): Promise<RestaurantDeleteResponse> {
  return api.delete<RestaurantDeleteResponse>(`/restaurants/${restaurantId}`);
}

export async function updateRestaurantIntegration(
  restaurantId: number,
  payload: RestaurantIntegrationUpdateRequest,
): Promise<RestaurantIntegrationResponse> {
  return api.patch<RestaurantIntegrationResponse>(
    `/restaurants/${restaurantId}/integration`,
    payload,
  );
}

export async function getRestaurantIntegrationOps(
  restaurantId: number,
): Promise<RestaurantIntegrationOpsResponse> {
  return api.get<RestaurantIntegrationOpsResponse>(
    `/restaurants/${restaurantId}/integration/ops`,
  );
}

export async function generateRestaurantApiKey(
  restaurantId: number,
): Promise<RestaurantApiKeyProvisionResponse> {
  return api.post<RestaurantApiKeyProvisionResponse>(
    `/restaurants/${restaurantId}/integration/api-key/generate`,
    {},
  );
}

export async function rotateRestaurantApiKey(
  restaurantId: number,
): Promise<RestaurantApiKeyProvisionResponse> {
  return api.post<RestaurantApiKeyProvisionResponse>(
    `/restaurants/${restaurantId}/integration/api-key/rotate`,
    {},
  );
}

export async function revokeRestaurantApiKey(
  restaurantId: number,
): Promise<RestaurantIntegrationResponse["api_key"]> {
  return api.delete<RestaurantIntegrationResponse["api_key"]>(
    `/restaurants/${restaurantId}/integration/api-key`,
  );
}

export async function refreshRestaurantWebhookHealth(
  restaurantId: number,
): Promise<RestaurantWebhookHealthRefreshResponse> {
  return api.post<RestaurantWebhookHealthRefreshResponse>(
    `/restaurants/${restaurantId}/integration/webhook/refresh`,
    {},
  );
}

export async function generateRestaurantWebhookSecret(
  restaurantId: number,
): Promise<RestaurantWebhookSecretProvisionResponse> {
  return api.post<RestaurantWebhookSecretProvisionResponse>(
    `/restaurants/${restaurantId}/integration/webhook/secret/generate`,
    {},
  );
}

export async function rotateRestaurantWebhookSecret(
  restaurantId: number,
): Promise<RestaurantWebhookSecretProvisionResponse> {
  return api.post<RestaurantWebhookSecretProvisionResponse>(
    `/restaurants/${restaurantId}/integration/webhook/secret/rotate`,
    {},
  );
}

export async function revokeRestaurantWebhookSecret(
  restaurantId: number,
): Promise<RestaurantWebhookSecretSummary> {
  return api.delete<RestaurantWebhookSecretSummary>(
    `/restaurants/${restaurantId}/integration/webhook/secret`,
  );
}

export async function sendRestaurantWebhookTestDelivery(
  restaurantId: number,
): Promise<RestaurantWebhookDeliveryActionResponse> {
  return api.post<RestaurantWebhookDeliveryActionResponse>(
    `/restaurants/${restaurantId}/integration/webhook/deliveries/test`,
    {},
  );
}

export async function retryRestaurantWebhookDelivery(
  restaurantId: number,
  deliveryId: number,
): Promise<RestaurantWebhookDeliveryActionResponse> {
  return api.post<RestaurantWebhookDeliveryActionResponse>(
    `/restaurants/${restaurantId}/integration/webhook/deliveries/${deliveryId}/retry`,
    {},
  );
}

export async function getRestaurantSubscription(
  restaurantId: number,
): Promise<SubscriptionResponse> {
  return api.get<SubscriptionResponse>(`/subscriptions/admin/${restaurantId}`);
}

export async function getRestaurantPackageAccess(
  restaurantId: number,
): Promise<SubscriptionAccessSummaryResponse> {
  return api.get<SubscriptionAccessSummaryResponse>(
    `/subscriptions/admin/${restaurantId}/access`,
  );
}

export async function updateRestaurantSubscription(
  restaurantId: number,
  payload: SuperAdminSubscriptionUpdateRequest,
): Promise<SubscriptionResponse> {
  return api.patch<SubscriptionResponse>(`/subscriptions/admin/${restaurantId}`, payload);
}

export async function getRestaurantSubscriptionHistory(
  restaurantId: number,
): Promise<SubscriptionChangeHistoryResponse> {
  return api.get<SubscriptionChangeHistoryResponse>(
    `/subscriptions/admin/${restaurantId}/history?limit=100`,
  );
}

export async function expireOverdueSubscriptions(): Promise<{
  message: string;
  expired_count: number;
}> {
  return api.post<{ message: string; expired_count: number }>(
    "/subscriptions/admin/expire-overdue",
    {},
  );
}

export async function listRestaurantUsers(
  restaurantId: number,
): Promise<StaffDetailResponse[]> {
  return api.get<StaffDetailResponse[]>(`/restaurants/${restaurantId}/users`);
}

export async function createRestaurantUser(
  restaurantId: number,
  payload: {
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
  },
): Promise<StaffDetailResponse> {
  return api.post<StaffDetailResponse>(`/restaurants/${restaurantId}/users`, payload);
}

export async function resetRestaurantUserPassword(
  restaurantId: number,
  userId: number,
  payload: { temporary_password?: string | null } = {},
): Promise<RestaurantStaffPasswordResetResponse> {
  return api.post<RestaurantStaffPasswordResetResponse>(
    `/restaurants/${restaurantId}/users/${userId}/reset-password`,
    payload,
  );
}

export async function revealRestaurantUserTemporaryPassword(
  restaurantId: number,
  userId: number,
  payload: { reveal_token: string },
): Promise<RestaurantStaffPasswordRevealResponse> {
  return api.post<RestaurantStaffPasswordRevealResponse>(
    `/restaurants/${restaurantId}/users/${userId}/reset-password/reveal`,
    payload,
  );
}

export async function toggleRestaurantUser(
  restaurantId: number,
  userId: number,
  nextAction: "enable" | "disable",
): Promise<{ id: number; is_active: boolean; message: string }> {
  return api.patch<{ id: number; is_active: boolean; message: string }>(
    `/restaurants/${restaurantId}/users/${userId}/${nextAction}`,
    {},
  );
}

export async function deleteRestaurantUser(
  restaurantId: number,
  userId: number,
): Promise<GenericMessageResponse> {
  return api.delete<GenericMessageResponse>(`/restaurants/${restaurantId}/users/${userId}`);
}
