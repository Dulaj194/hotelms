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
