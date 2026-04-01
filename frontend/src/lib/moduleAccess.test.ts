import { describe, expect, it } from "vitest";

import { getRoleRedirect, normalizeRole } from "@/lib/auth";
import {
  canAccessHousekeepingTasks,
  canAccessModuleItem,
  canAccessQrMenuStaffModule,
  hasPrivilegeCode,
  hasRoleAccess,
} from "@/lib/moduleAccess";

describe("auth and module access guards", () => {
  it("normalizes legacy super admin role value", () => {
    expect(normalizeRole("s_admin")).toBe("super_admin");
  });

  it("resolves role redirect for normalized super admin", () => {
    expect(getRoleRedirect("s_admin")).toBe("/super-admin");
  });

  it("routes billing-focused roles to the billing workspace", () => {
    expect(getRoleRedirect("cashier")).toBe("/admin/billing");
    expect(getRoleRedirect("accountant")).toBe("/admin/billing");
  });

  it("checks role access using normalized role values", () => {
    expect(hasRoleAccess("ADMIN", ["owner", "admin"])).toBe(true);
    expect(hasRoleAccess("steward", ["owner", "admin"])).toBe(false);
  });

  it("checks privilege code case-insensitively", () => {
    expect(hasPrivilegeCode(["qr_menu", "housekeeping"], "QR_MENU")).toBe(true);
    expect(hasPrivilegeCode(["offers"], "QR_MENU")).toBe(false);
  });

  it("requires both role and privilege for module access", () => {
    expect(
      canAccessModuleItem(
        "admin",
        ["QR_MENU"],
        { reports: true },
        ["owner", "admin"],
        "QR_MENU",
        "reports",
      ),
    ).toBe(true);
    expect(
      canAccessModuleItem(
        "steward",
        ["QR_MENU"],
        { reports: true },
        ["owner", "admin"],
        "QR_MENU",
        "reports",
      ),
    ).toBe(false);
    expect(
      canAccessModuleItem(
        "admin",
        ["HOUSEKEEPING"],
        { reports: false },
        ["owner", "admin"],
        "QR_MENU",
        "reports",
      ),
    ).toBe(false);
  });

  it("applies dedicated housekeeping and qr module helpers", () => {
    expect(
      canAccessHousekeepingTasks("housekeeper", ["HOUSEKEEPING"], { housekeeping: true }),
    ).toBe(true);
    expect(
      canAccessHousekeepingTasks("steward", ["HOUSEKEEPING"], { housekeeping: true }),
    ).toBe(false);
    expect(canAccessQrMenuStaffModule("steward", ["QR_MENU"], { kds: true })).toBe(true);
    expect(canAccessQrMenuStaffModule("housekeeper", ["QR_MENU"], { kds: true })).toBe(false);
  });
});
