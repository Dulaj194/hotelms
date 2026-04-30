import { describe, expect, it } from "vitest";

import {
  canPerformPlatformAction,
  getRequiredScopesForPlatformAction,
} from "@/features/platform-access/permissions";

describe("platform permission matrix", () => {
  it("keeps notification mutation restricted to security_admin", () => {
    expect(getRequiredScopesForPlatformAction("notifications_queue", "mutate")).toEqual([
      "security_admin",
    ]);
    expect(canPerformPlatformAction(["ops_viewer"], "notifications_queue", "mutate")).toBe(
      false,
    );
    expect(
      canPerformPlatformAction(["security_admin"], "notifications_queue", "mutate"),
    ).toBe(true);
  });

  it("allows ops_viewer to view registration and settings queues", () => {
    expect(getRequiredScopesForPlatformAction("registrations", "view")).toEqual([
      "ops_viewer",
      "tenant_admin",
    ]);
    expect(canPerformPlatformAction(["ops_viewer"], "registrations", "view")).toBe(true);
    expect(canPerformPlatformAction(["ops_viewer"], "settings_requests", "view")).toBe(true);
  });

  it("requires tenant_admin for approve actions", () => {
    expect(canPerformPlatformAction(["ops_viewer"], "registrations", "approve")).toBe(false);
    expect(canPerformPlatformAction(["ops_viewer"], "settings_requests", "approve")).toBe(
      false,
    );
    expect(canPerformPlatformAction(["tenant_admin"], "registrations", "approve")).toBe(true);
    expect(canPerformPlatformAction(["tenant_admin"], "settings_requests", "approve")).toBe(
      true,
    );
  });
});
