export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  must_change_password?: boolean;
}

export interface UserMeResponse {
  id: number;
  full_name: string;
  email: string;
  role: string;
  restaurant_id: number | null;
  is_active: boolean;
  must_change_password: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  dev_reset_token?: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface GenericMessageResponse {
  message: string;
}

export interface RegisterRestaurantRequest {
  restaurant_name: string;
  owner_full_name: string;
  owner_email: string;
  address: string;
  contact_number: string;
  password: string;
  confirm_password: string;
  opening_time: string;
  closing_time: string;
}

export interface RegisterRestaurantResponse {
  message: string;
  message_key?: string;
  restaurant_id: number;
  owner_email: string;
  correlation_id?: string;
}
