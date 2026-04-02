import { api } from "@/lib/api";
import type {
  BillDetailResponse,
  BillListResponse,
  BillRecord,
  BillingQueueSummaryResponse,
  BillingReconciliationResponse,
  BillHandoffStatus,
  BillReviewStatus,
  BillWorkflowActionRequest,
  BillWorkflowEventListResponse,
} from "@/types/billing";

export interface ListBillingFoliosParams {
  context_type?: "table" | "room";
  handoff_status?: BillHandoffStatus;
  cashier_status?: BillReviewStatus;
  accountant_status?: BillReviewStatus;
  search?: string;
  settled_from?: string;
  settled_to?: string;
  limit?: number;
  offset?: number;
}

export interface ListBillingEventsParams {
  bill_id?: number;
  action_type?: string;
  created_from?: string;
  created_to?: string;
  limit?: number;
  offset?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function listBillingFolios(
  params: ListBillingFoliosParams = {},
): Promise<BillListResponse> {
  return api.get<BillListResponse>(
    `/billing/folios${buildQuery({
      context_type: params.context_type,
      handoff_status: params.handoff_status,
      cashier_status: params.cashier_status,
      accountant_status: params.accountant_status,
      search: params.search,
      settled_from: params.settled_from,
      settled_to: params.settled_to,
      limit: params.limit,
      offset: params.offset,
    })}`,
  );
}

export function getBillingQueueSummary(): Promise<BillingQueueSummaryResponse> {
  return api.get<BillingQueueSummaryResponse>("/billing/queue-summary");
}

export function getBillingReconciliation(
  businessDate?: string,
): Promise<BillingReconciliationResponse> {
  return api.get<BillingReconciliationResponse>(
    `/billing/reconciliation/daily${buildQuery({ business_date: businessDate })}`,
  );
}

export function getBillingFolioDetail(billId: number): Promise<BillDetailResponse> {
  return api.get<BillDetailResponse>(`/billing/folios/${billId}`);
}

export function listBillingWorkflowEvents(
  params: ListBillingEventsParams = {},
): Promise<BillWorkflowEventListResponse> {
  return api.get<BillWorkflowEventListResponse>(
    `/billing/events${buildQuery({
      bill_id: params.bill_id,
      action_type: params.action_type,
      created_from: params.created_from,
      created_to: params.created_to,
      limit: params.limit,
      offset: params.offset,
    })}`,
  );
}

export function recordBillPrint(
  billId: number,
  payload: BillWorkflowActionRequest = {},
): Promise<BillRecord> {
  return api.post<BillRecord>(`/billing/folios/${billId}/print`, payload);
}

export function sendFolioToCashier(
  billId: number,
  payload: BillWorkflowActionRequest = {},
): Promise<BillRecord> {
  return api.post<BillRecord>(`/billing/folios/${billId}/send-to-cashier`, payload);
}

export function acceptCashierFolio(
  billId: number,
  payload: BillWorkflowActionRequest = {},
): Promise<BillRecord> {
  return api.post<BillRecord>(`/billing/folios/${billId}/cashier/accept`, payload);
}

export function rejectCashierFolio(
  billId: number,
  payload: BillWorkflowActionRequest = {},
): Promise<BillRecord> {
  return api.post<BillRecord>(`/billing/folios/${billId}/cashier/reject`, payload);
}

export function sendFolioToAccountant(
  billId: number,
  payload: BillWorkflowActionRequest = {},
): Promise<BillRecord> {
  return api.post<BillRecord>(`/billing/folios/${billId}/send-to-accountant`, payload);
}

export function acceptAccountantFolio(
  billId: number,
  payload: BillWorkflowActionRequest = {},
): Promise<BillRecord> {
  return api.post<BillRecord>(`/billing/folios/${billId}/accountant/accept`, payload);
}

export function rejectAccountantFolio(
  billId: number,
  payload: BillWorkflowActionRequest = {},
): Promise<BillRecord> {
  return api.post<BillRecord>(`/billing/folios/${billId}/accountant/reject`, payload);
}

export function completeFolioHandoff(
  billId: number,
  payload: BillWorkflowActionRequest = {},
): Promise<BillRecord> {
  return api.post<BillRecord>(`/billing/folios/${billId}/complete`, payload);
}

export function reopenBillingFolio(
  billId: number,
  payload: BillWorkflowActionRequest = {},
): Promise<BillRecord> {
  return api.post<BillRecord>(`/billing/folios/${billId}/reopen`, payload);
}
