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
  event_type: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  actor: AuditLogActorResponse;
  restaurant: AuditLogRestaurantResponse;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SuperAdminNotificationListResponse {
  items: SuperAdminNotificationResponse[];
  total: number;
}

export interface SuperAdminRealtimeEnvelope {
  event: string;
  data: SuperAdminNotificationResponse;
}
