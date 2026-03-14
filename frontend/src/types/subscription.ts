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
