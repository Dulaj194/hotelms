import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PackagesPage from "@/pages/super-admin/Packages";

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

describe("PackagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockImplementation(async (path: string) => {
      if (path === "/packages/admin") {
        return {
          items: [
            {
              id: 1,
              name: "Starter",
              code: "starter",
              description: "Starter package",
              price: 49,
              billing_period_days: 30,
              is_active: true,
              privileges: ["QR_MENU", "OFFERS"],
              created_at: "2026-04-01T00:00:00Z",
              updated_at: "2026-04-01T00:00:00Z",
            },
          ],
        };
      }
      if (path === "/packages/admin/privileges") {
        return {
          items: [
            { code: "QR_MENU", label: "QR Menu", description: "QR ordering access" },
            { code: "OFFERS", label: "Offers", description: "Offers module" },
          ],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders package metrics and opens the create form", async () => {
    render(<PackagesPage />);

    expect(await screen.findByText("Starter")).toBeTruthy();
    expect(screen.getByText("1 packages")).toBeTruthy();
    expect(screen.getByText("Starter package")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "New Package" }));
    expect(screen.getByRole("heading", { name: "Create Package" })).toBeTruthy();
    expect(screen.getByLabelText("Package Name")).toBeTruthy();
  });
});
