import { describe, expect, it } from "vitest";

import {
  getDefaultSuperAdminPath,
  hasAnyPlatformScope,
  normalizePlatformScopes,
} from "@/features/platform-access/catalog";

describe("platform access catalog", () => {
  it("normalizes missing scopes in fail-closed mode", () => {
    expect(normalizePlatformScopes(undefined)).toEqual([]);
    expect(normalizePlatformScopes(null)).toEqual([]);
    expect(hasAnyPlatformScope(undefined, ["ops_viewer"])).toBe(false);
  });

  it("filters invalid scopes and deduplicates valid values", () => {
    expect(
      normalizePlatformScopes([
        "OPS_VIEWER",
        "tenant_admin",
        "ops_viewer",
        "unknown_scope",
      ]),
    ).toEqual(["ops_viewer", "tenant_admin"]);
  });

  it("resolves default super admin paths from explicit scopes only", () => {
    expect(getDefaultSuperAdminPath([])).toBe("/super-admin");
    expect(getDefaultSuperAdminPath(["security_admin"])).toBe(
      "/super-admin/platform-users",
    );
  });
});
