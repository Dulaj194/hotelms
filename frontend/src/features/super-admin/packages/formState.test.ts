import { describe, expect, it } from "vitest";

import {
  buildPackageCreatePayload,
  buildPackageUpdatePayload,
  mapPackageToFormState,
} from "@/features/super-admin/packages/formState";

describe("package form state helpers", () => {
  it("normalizes create payload values", () => {
    const payload = buildPackageCreatePayload({
      name: " Premium ",
      code: " PREMIUM ",
      description: "  Full access  ",
      price: "99.50",
      billing_period_days: "30",
      is_active: true,
      privileges: ["QR_MENU", "OFFERS"],
    });

    expect(payload).toEqual({
      name: "Premium",
      code: "premium",
      description: "Full access",
      price: 99.5,
      billing_period_days: 30,
      is_active: true,
      privileges: ["QR_MENU", "OFFERS"],
    });
  });

  it("maps package detail responses back into editable form state", () => {
    const form = mapPackageToFormState({
      id: 1,
      name: "Standard",
      code: "standard",
      description: "Core features",
      price: "49.00",
      billing_period_days: 30,
      is_active: true,
      privileges: ["QR_MENU"],
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    });

    expect(form.code).toBe("standard");
    expect(form.price).toBe("49.00");
    expect(form.privileges).toEqual(["QR_MENU"]);
  });

  it("builds update payloads without changing privilege order", () => {
    const payload = buildPackageUpdatePayload({
      name: "Starter",
      code: "starter",
      description: "",
      price: "29",
      billing_period_days: "14",
      is_active: false,
      privileges: ["HOUSEKEEPING", "QR_MENU"],
    });

    expect(payload.privileges).toEqual(["HOUSEKEEPING", "QR_MENU"]);
    expect(payload.description).toBeNull();
  });
});
