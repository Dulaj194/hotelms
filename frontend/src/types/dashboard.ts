export interface DashboardRestaurantSummary {
  id: number;
  name: string;
  email: string | null;
  contact_number: string | null;
  address: string | null;
  logo_url: string | null;
  country: string | null;
  currency: string | null;
  opening_time: string | null;
  closing_time: string | null;
}

export interface DashboardSubscriptionSummary {
  status: string;
  is_trial: boolean;
  package_name: string | null;
  package_code: string | null;
  trial_expires_at: string | null;
  days_remaining: number | null;
  privileges: string[];
}

export interface DashboardAdminUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface DashboardOverviewMetrics {
  pending_orders: number;
  pending_housekeeping_tasks: number;
}

export interface DashboardWarningSummary {
  trial_expiry_warning: boolean;
  trial_expiry_message: string | null;
}

export interface DashboardSetupWizardSummary {
  should_show: boolean;
  missing_fields: string[];
}

export interface AdminDashboardOverviewResponse {
  restaurant: DashboardRestaurantSummary;
  subscription: DashboardSubscriptionSummary;
  admins: DashboardAdminUser[];
  metrics: DashboardOverviewMetrics;
  warnings: DashboardWarningSummary;
  setup_wizard: DashboardSetupWizardSummary;
}
