import { describe, expect, it, beforeEach } from "vitest";

import {
  clearGuestSession,
  getGuestDisplayName,
  hasGuestSession,
  hasGuestSessionForContext,
  setGuestSession,
} from "@/hooks/useGuestSession";
import type { TableSessionStartResponse } from "@/types/session";

function buildSession(
  restaurantId: number,
  tableNumber: string,
  customerName = "Guest",
): TableSessionStartResponse {
  return {
    session_id: "session-1",
    guest_token: "token-1",
    restaurant_id: restaurantId,
    table_number: tableNumber,
    customer_name: customerName,
    session_status: "OPEN",
    expires_at: "2030-01-01T00:00:00Z",
  };
}

describe("useGuestSession context safety", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns true for matching table context", () => {
    setGuestSession(buildSession(7, "A1", "Nimal"));

    expect(hasGuestSession()).toBe(true);
    expect(hasGuestSessionForContext(7, "A1")).toBe(true);
    expect(getGuestDisplayName(7, "A1")).toBe("Nimal");
  });

  it("rejects token reuse for a different table context", () => {
    setGuestSession(buildSession(7, "A1", "Nimal"));

    expect(hasGuestSessionForContext(7, "A2")).toBe(false);
    expect(hasGuestSessionForContext(8, "A1")).toBe(false);
    expect(getGuestDisplayName(7, "A2")).toBeNull();
  });

  it("returns false after clearing session", () => {
    setGuestSession(buildSession(7, "A1"));
    clearGuestSession();

    expect(hasGuestSession()).toBe(false);
    expect(hasGuestSessionForContext(7, "A1")).toBe(false);
  });
});
