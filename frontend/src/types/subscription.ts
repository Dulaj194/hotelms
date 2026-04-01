export interface PackageResponse {
  id: number;
  name: string;
  code: string;
  description: string | null;
  price: string;
  billing_period_days: number;
  is_active: boolean;
}

export interface PackageListResponse {
  items: PackageResponse[];
}

export interface PackageDetailResponse extends PackageResponse {
  privileges: string[];
  created_at: string;
  updated_at: string;
}

export interface PackagePrivilegeCatalogItem {
  code: string;
  label: string;
  description: string;
  modules: SubscriptionAccessModuleResponse[];
}

export interface PackagePrivilegeCatalogResponse {
  items: PackagePrivilegeCatalogItem[];
}

export interface PackageAdminListResponse {
  items: PackageDetailResponse[];
  total: number;
}

export interface PackageCreateRequest {
  name: string;
  code: string;
  description?: string | null;
  price: number;
  billing_period_days: number;
  is_active: boolean;
  privileges: string[];
}

export interface PackageUpdateRequest {
  name?: string;
  code?: string;
  description?: string | null;
  price?: number;
  billing_period_days?: number;
  is_active?: boolean;
  privileges?: string[];
}

export interface PackageDeleteResponse {
  message: string;
  package_id: number;
}

export interface SubscriptionResponse {
  id: number | null;
  restaurant_id: number;
  package_id: number | null;
  package_name: string | null;
  package_code: string | null;
  status: string;
  is_trial: boolean;
  started_at: string | null;
  expires_at: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
}

export interface SubscriptionStatusResponse {
  status: string;
  is_active: boolean;
  is_trial: boolean;
  is_expired: boolean;
  started_at: string | null;
  expires_at: string | null;
}

export interface SubscriptionPrivilegeResponse {
  restaurant_id: number;
  status: string;
  privileges: string[];
}

export interface SubscriptionAccessModuleResponse {
  key: string;
  label: string;
  description: string;
  package_privileges: string[];
  feature_flags: string[];
  enabled_by_package: boolean;
  enabled_by_feature_flags: boolean;
  is_enabled: boolean;
}

export interface SubscriptionAccessPrivilegeResponse {
  code: string;
  label: string;
  description: string;
  modules: SubscriptionAccessModuleResponse[];
}

export interface SubscriptionAccessFeatureFlagResponse {
  code: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  modules: SubscriptionAccessModuleResponse[];
}

export interface SubscriptionAccessSummaryResponse {
  restaurant_id: number;
  status: string;
  is_active: boolean;
  package_id: number | null;
  package_name: string | null;
  package_code: string | null;
  privileges: SubscriptionAccessPrivilegeResponse[];
  feature_flags: SubscriptionAccessFeatureFlagResponse[];
  module_access: SubscriptionAccessModuleResponse[];
  enabled_modules: SubscriptionAccessModuleResponse[];
}

export interface ActivateSubscriptionRequest {
  package_id?: number;
  package_code?: string;
}

export interface ActivateSubscriptionResponse {
  message: string;
  subscription: SubscriptionResponse;
}

export interface StartTrialResponse {
  message: string;
  subscription: SubscriptionResponse;
}

export interface CancelSubscriptionResponse {
  message: string;
  status: "cancelled";
}

export interface SuperAdminSubscriptionUpdateRequest {
  status?: string;
  expires_at?: string;
  package_id?: number;
}

export interface ExpireOverdueResponse {
  message: string;
  expired_count: number;
}
