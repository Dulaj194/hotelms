import { describe, expect, it } from "vitest";

import {
  buildAuditLogQueryParams,
  EMPTY_AUDIT_LOG_FILTERS,
} from "@/features/super-admin/audit-logs/helpers";

describe("super admin audit log helpers", () => {
  it("builds query params for advanced filters", () => {
    const params = buildAuditLogQueryParams(
      {
        ...EMPTY_AUDIT_LOG_FILTERS,
        search: "stripe",
        event_type: "stripe_webhook_failed",
        restaurant_id: "12",
        actor_search: "Root",
        severity: "danger",
        created_from: "2026-04-01",
        created_to: "2026-04-02",
      },
      250,
    );

    expect(params.get("limit")).toBe("250");
    expect(params.get("search")).toBe("stripe");
    expect(params.get("event_type")).toBe("stripe_webhook_failed");
    expect(params.get("restaurant_id")).toBe("12");
    expect(params.get("actor_search")).toBe("Root");
    expect(params.get("severity")).toBe("danger");
    expect(params.get("created_from")).toContain("2026-04-01T00:00:00.000Z");
    expect(params.get("created_to")).toContain("2026-04-02T23:59:59.999Z");
  });

  it("omits empty filter values", () => {
    const params = buildAuditLogQueryParams(EMPTY_AUDIT_LOG_FILTERS, 200);

    expect(params.get("limit")).toBe("200");
    expect(params.has("search")).toBe(false);
    expect(params.has("severity")).toBe(false);
    expect(params.has("created_from")).toBe(false);
  });
});
