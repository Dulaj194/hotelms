import { api } from "@/lib/api";

export interface PaymentTerminalBase {
  counter_name: string;
  provider: string;
  is_active: boolean;
}

export interface PaymentTerminalCreate extends PaymentTerminalBase {
  merchant_id: string;
  terminal_id: string;
  api_key?: string | null;
}

export interface PaymentTerminalUpdate {
  counter_name?: string | null;
  provider?: string | null;
  merchant_id?: string | null;
  terminal_id?: string | null;
  api_key?: string | null;
  is_active?: boolean | null;
}

export interface PaymentTerminalResponse extends PaymentTerminalBase {
  id: number;
  restaurant_id: number;
  merchant_id_masked: string;
  terminal_id_masked: string;
  created_at: string;
  updated_at: string;
}

export function listPaymentTerminals(): Promise<PaymentTerminalResponse[]> {
  return api.get<PaymentTerminalResponse[]>("/payments/terminals");
}

export function createPaymentTerminal(
  payload: PaymentTerminalCreate,
): Promise<PaymentTerminalResponse> {
  return api.post<PaymentTerminalResponse>("/payments/terminals", payload);
}

export function updatePaymentTerminal(
  terminalId: number,
  payload: PaymentTerminalUpdate,
): Promise<PaymentTerminalResponse> {
  return api.put<PaymentTerminalResponse>(`/payments/terminals/${terminalId}`, payload);
}

export function deletePaymentTerminal(terminalId: number): Promise<void> {
  return api.delete(`/payments/terminals/${terminalId}`);
}

export type PosPaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export interface PosPaymentIntentResponse {
  id: number;
  restaurant_id: number;
  terminal_id: number;
  bill_id: number | null;
  session_id: string;
  amount: number;
  status: PosPaymentStatus;
  provider_reference: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface PosPaymentTriggerRequest {
  terminal_id: number;
  session_id: string;
  amount: number;
}

export async function triggerPosPayment(
  payload: PosPaymentTriggerRequest,
): Promise<PosPaymentIntentResponse> {
  try {
    return await api.post<PosPaymentIntentResponse>("/payments/pos/trigger", payload);
  } catch (error: any) {
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw error;
  }
}

export async function syncPosPaymentStatus(
  intentId: number,
): Promise<PosPaymentIntentResponse> {
  try {
    return await api.get<PosPaymentIntentResponse>(`/payments/pos/status/${intentId}`);
  } catch (error: any) {
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw error;
  }
}
