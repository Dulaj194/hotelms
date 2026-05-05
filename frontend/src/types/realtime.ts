/**
 * Real-time WebSocket event types for the kitchen dashboard.
 *
 * The backend publishes events to a per-restaurant Redis channel
 * (orders:{restaurant_id}) which is forwarded over WebSocket to all
 * connected kitchen clients.
 */

// ── Item summary inside a new_order event ─────────────────────────────────────

export interface EventOrderItem {
  item_name_snapshot: string;
  quantity: number;
  line_total: number;
}

// ── new_order event ────────────────────────────────────────────────────────────

export interface NewOrderEventData {
  order_id: number;
  order_number: string;
  table_number: string | null;
  order_source: string;
  room_id: number | null;
  room_number: string | null;
  status: string;
  total_amount: number;
  placed_at: string;
  items: EventOrderItem[];
}

export interface NewOrderEvent {
  event: "new_order";
  restaurant_id: number;
  data: NewOrderEventData;
}

// ── order_status_updated event ─────────────────────────────────────────────────

export interface OrderStatusUpdatedEventData {
  order_id: number;
  order_number: string;
  table_number: string | null;
  order_source: string;
  room_id: number | null;
  room_number: string | null;
  status: string;
  updated_at: string;
}

export interface OrderStatusUpdatedEvent {
  event: "order_status_updated";
  restaurant_id: number;
  data: OrderStatusUpdatedEventData;
}

// ── bill_requested event ──────────────────────────────────────────────────────

export interface BillRequestedEventData {
  table_number: string;
  session_id: string;
  customer_name: string | null;
  requested_at: string;
}

export interface BillRequestedEvent {
  event: "bill_requested";
  restaurant_id: number;
  data: BillRequestedEventData;
}

// ── service_requested event ──────────────────────────────────────────────────

export interface ServiceRequestedEventData {
  table_number: string;
  session_id: string;
  service_type: string;
  customer_name: string | null;
  message: string | null;
  requested_at: string;
}

export interface ServiceRequestedEvent {
  event: "service_requested";
  restaurant_id: number;
  data: ServiceRequestedEventData;
}

// ── Union type for all kitchen events ─────────────────────────────────────────

export type KitchenEvent =
  | NewOrderEvent
  | OrderStatusUpdatedEvent
  | BillRequestedEvent
  | ServiceRequestedEvent;
