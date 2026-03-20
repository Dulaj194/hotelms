export interface DashboardRestaurantSummary {
  id: number;
  name: string;
  email: string | null;
  contact_number: string | null;
  address: string | null;
  logo_url: string | null;
  country: string | null;
  currency: string | null;
  billing_email: string | null;
  tax_id: string | null;
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
  overdue_orders: number;
  today_orders: number;
  exception_count: number;
  pending_housekeeping_tasks: number;
}

export interface DashboardWarningSummary {
  trial_expiry_warning: boolean;
  trial_expiry_message: string | null;
}

export interface DashboardSetupWizardSummary {
  should_show: boolean;
  has_blocking_missing: boolean;
  progress_percent: number;
  current_step: number;
  total_steps: number;
  completed_keys: string[];
  missing_fields: string[];
}

export interface DashboardAlertAction {
  label: string;
  path: string;
}

export interface DashboardAlertItem {
  key: string;
  level: string;
  title: string;
  message: string;
  blocking: boolean;
  should_show: boolean;
  dismissible: boolean;
  visibility_policy: string;
  action: DashboardAlertAction;
}

export interface DashboardSetupRequirement {
  key: string;
  label: string;
  severity: string;
  description: string;
  completed: boolean;
}

export interface DashboardModuleLane {
  key: string;
  label: string;
  path: string;
  visible: boolean;
}

export interface DashboardPrivilegeMap {
  role: string;
  privileges: string[];
}

export interface AdminDashboardOverviewResponse {
  restaurant: DashboardRestaurantSummary;
  subscription: DashboardSubscriptionSummary;
  admins: DashboardAdminUser[];
  metrics: DashboardOverviewMetrics;
  warnings: DashboardWarningSummary;
  alerts: DashboardAlertItem[];
  setup_wizard: DashboardSetupWizardSummary;
  setup_requirements: DashboardSetupRequirement[];
  module_lanes: DashboardModuleLane[];
  privilege_map: DashboardPrivilegeMap;
  sla_priority_model: string[];
}
