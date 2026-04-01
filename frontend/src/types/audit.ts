export interface AuditLogActorResponse {
  user_id: number | null;
  full_name: string | null;
  email: string | null;
}

export interface AuditLogRestaurantResponse {
  restaurant_id: number | null;
  name: string | null;
}

export interface AuditLogEntryResponse {
  id: number;
  event_type: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  ip_address: string | null;
  user_agent: string | null;
  actor: AuditLogActorResponse;
  restaurant: AuditLogRestaurantResponse;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogListResponse {
  items: AuditLogEntryResponse[];
  total: number;
}

export interface SuperAdminNotificationResponse {
  id: string;
  audit_log_id: number;
  event_type: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  actor: AuditLogActorResponse;
  restaurant: AuditLogRestaurantResponse;
  metadata: Record<string, unknown>;
  queue_status: "unread" | "read" | "assigned" | "snoozed" | "acknowledged";
  is_read: boolean;
  read_at: string | null;
  read_by: AuditLogActorResponse;
  assigned_to: AuditLogActorResponse;
  assigned_at: string | null;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: AuditLogActorResponse;
  is_snoozed: boolean;
  snoozed_until: string | null;
  created_at: string;
}

export interface SuperAdminNotificationListResponse {
  items: SuperAdminNotificationResponse[];
  total: number;
}

export interface SuperAdminNotificationUpdateRequest {
  is_read?: boolean;
  assigned_user_id?: number | null;
  is_acknowledged?: boolean;
  snoozed_until?: string | null;
}

export interface SuperAdminNotificationAssigneeResponse {
  user_id: number;
  full_name: string;
  email: string;
}

export interface SuperAdminNotificationAssigneeListResponse {
  items: SuperAdminNotificationAssigneeResponse[];
  total: number;
}

export interface SuperAdminRealtimeEnvelope {
  event: string;
  data: SuperAdminNotificationResponse;
}
