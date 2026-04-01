import { describe, expect, it } from "vitest";

import {
  formatSubscriptionStatusLabel,
  getBooleanStatusBadgeClass,
  getSubscriptionStatusBadgeClass,
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
});
