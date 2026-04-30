import {
  DEFAULT_PLATFORM_SCOPES,
  normalizePlatformScopes,
  type PlatformScopeValue,
} from "@/features/platform-access/catalog";
import type {
  PlatformUserCreateRequest,
  PlatformUserDetailResponse,
  PlatformUserListItemResponse,
  PlatformUserUpdateRequest,
} from "@/types/user";

export type PlatformUserFormState = {
  full_name: string;
  email: string;
  username: string;
  phone: string;
  password: string;
  is_active: boolean;
  must_change_password: boolean;
  super_admin_scopes: PlatformScopeValue[];
};

export const EMPTY_PLATFORM_USER_FORM: PlatformUserFormState = {
  full_name: "",
  email: "",
  username: "",
  phone: "",
  password: "",
  is_active: true,
  must_change_password: true,
  super_admin_scopes: [...DEFAULT_PLATFORM_SCOPES],
};

export function buildPlatformUserCreatePayload(
  form: PlatformUserFormState,
): PlatformUserCreateRequest {
  return {
    full_name: form.full_name.trim(),
    email: form.email.trim(),
    username: form.username.trim() || null,
    phone: form.phone.trim() || null,
    password: form.password,
    is_active: form.is_active,
    must_change_password: form.must_change_password,
    super_admin_scopes: normalizePlatformScopes(form.super_admin_scopes),
  };
}

export function buildPlatformUserUpdatePayload(
  form: PlatformUserFormState,
): PlatformUserUpdateRequest {
  const payload: PlatformUserUpdateRequest = {
    full_name: form.full_name.trim(),
    email: form.email.trim(),
    username: form.username.trim() || null,
    phone: form.phone.trim() || null,
    is_active: form.is_active,
    must_change_password: form.must_change_password,
    super_admin_scopes: normalizePlatformScopes(form.super_admin_scopes),
  };
  if (form.password.trim()) {
    payload.password = form.password;
  }
  return payload;
}

export function mapPlatformUserToFormState(
  user: PlatformUserDetailResponse | PlatformUserListItemResponse,
): PlatformUserFormState {
  return {
    full_name: user.full_name,
    email: user.email,
    username: user.username ?? "",
    phone: user.phone ?? "",
    password: "",
    is_active: user.is_active,
    must_change_password: user.must_change_password,
    super_admin_scopes: normalizePlatformScopes(user.super_admin_scopes),
  };
}
