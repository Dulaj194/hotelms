import { describe, expect, it } from "vitest";

import {
  formatWebhookDeliveryLabel,
  formatWebhookStatusLabel,
  formatSubscriptionStatusLabel,
  getBooleanStatusBadgeClass,
  getSubscriptionStatusBadgeClass,
  getWebhookDeliveryBadgeClass,
  getWebhookStatusBadgeClass,
} from "@/features/super-admin/restaurants/helpers";

describe("restaurant admin helpers", () => {
  it("formats subscription statuses for display", () => {
    expect(formatSubscriptionStatusLabel("trial")).toBe("Trial");
    expect(formatSubscriptionStatusLabel("none")).toBe("No Subscription");
    expect(formatSubscriptionStatusLabel(undefined)).toBe("No Subscription");
  });

  it("returns stable badge classes for hotel activity states", () => {
    expect(getBooleanStatusBadgeClass(true)).toContain("green");
    expect(getBooleanStatusBadgeClass(false)).toContain("red");
  });

  it("maps subscription status codes to badge tones", () => {
    expect(getSubscriptionStatusBadgeClass("active")).toContain("green");
    expect(getSubscriptionStatusBadgeClass("trial")).toContain("blue");
    expect(getSubscriptionStatusBadgeClass("expired")).toContain("red");
    expect(getSubscriptionStatusBadgeClass("unknown")).toContain("amber");
  });

  it("formats webhook health statuses for the integration panel", () => {
    expect(formatWebhookStatusLabel("not_configured")).toBe("Not Configured");
    expect(formatWebhookStatusLabel("degraded")).toBe("Needs Attention");
    expect(getWebhookStatusBadgeClass("healthy")).toContain("green");
    expect(getWebhookStatusBadgeClass("disabled")).toContain("slate");
  });

  it("formats webhook delivery statuses for retry history", () => {
    expect(formatWebhookDeliveryLabel("success")).toBe("Delivered");
    expect(getWebhookDeliveryBadgeClass("success")).toContain("green");
    expect(getWebhookDeliveryBadgeClass("failed")).toContain("red");
  });
});
