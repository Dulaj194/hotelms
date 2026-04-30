import { describe, expect, it } from "vitest";

import {
  buildPlatformUserCreatePayload,
  buildPlatformUserUpdatePayload,
  mapPlatformUserToFormState,
} from "@/features/super-admin/platform-users/formState";

describe("platform user form state helpers", () => {
  it("normalizes create payload optional fields", () => {
    const payload = buildPlatformUserCreatePayload({
      full_name: " Platform Admin ",
      email: "admin@example.com ",
      username: " root.admin ",
      phone: " 0711234567 ",
      password: "Password1",
      is_active: true,
      must_change_password: true,
      super_admin_scopes: [
        "ops_viewer",
        "tenant_admin",
        "billing_admin",
        "security_admin",
      ],
    });

    expect(payload).toEqual({
      full_name: "Platform Admin",
      email: "admin@example.com",
      username: "root.admin",
      phone: "0711234567",
      password: "Password1",
      is_active: true,
      must_change_password: true,
      super_admin_scopes: [
        "ops_viewer",
        "tenant_admin",
        "billing_admin",
        "security_admin",
      ],
    });
  });

  it("omits empty passwords from update payloads", () => {
    const payload = buildPlatformUserUpdatePayload({
      full_name: "Ops Admin",
      email: "ops@example.com",
      username: "",
      phone: "",
      password: "",
      is_active: false,
      must_change_password: false,
      super_admin_scopes: ["security_admin"],
    });

    expect(payload.password).toBeUndefined();
    expect(payload.username).toBeNull();
    expect(payload.phone).toBeNull();
    expect(payload.super_admin_scopes).toEqual(["security_admin"]);
  });

  it("maps response objects into a safe edit form state", () => {
    const form = mapPlatformUserToFormState({
      id: 5,
      full_name: "Root Admin",
      email: "root@example.com",
      username: null,
      phone: null,
      role: "super_admin",
      is_active: true,
      must_change_password: false,
      super_admin_scopes: ["ops_viewer", "security_admin"],
      last_login_at: null,
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    });

    expect(form.password).toBe("");
    expect(form.username).toBe("");
    expect(form.phone).toBe("");
    expect(form.super_admin_scopes).toEqual(["ops_viewer", "security_admin"]);
  });
});
