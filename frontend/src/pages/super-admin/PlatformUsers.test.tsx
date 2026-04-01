import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PlatformUsersPage from "@/pages/super-admin/PlatformUsers";

const { apiGet, apiPost, apiPatch, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: apiGet,
    post: apiPost,
    patch: apiPatch,
    delete: apiDelete,
  },
}));

vi.mock("@/components/shared/SuperAdminLayout", () => ({
  default: ({ children }: { children: any }) => <div>{children}</div>,
}));

describe("PlatformUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockResolvedValue({
      items: [
        {
          id: 7,
          full_name: "Security Lead",
          email: "security.lead@example.com",
          username: "security.lead",
          phone: "0711234567",
          is_active: true,
          must_change_password: false,
          super_admin_scopes: ["security_admin", "billing_admin"],
          last_login_at: "2026-04-01T08:00:00Z",
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders platform user scopes and status", async () => {
    render(<PlatformUsersPage />);

    expect(await screen.findByText("Security Lead")).toBeTruthy();
    expect(screen.getByText("security.lead@example.com")).toBeTruthy();
    expect(screen.getByText("Security Admin")).toBeTruthy();
    expect(screen.getByText("Billing Admin")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });
});
