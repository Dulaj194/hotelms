import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Login from "@/pages/auth/Login";

const {
  apiGet,
  apiPost,
  getRoleRedirect,
  setAccessToken,
  setUser,
} = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getRoleRedirect: vi.fn(),
  setAccessToken: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: apiGet,
    post: apiPost,
  },
  ApiError: class extends Error {
    status: number;
    detail: string;

    constructor(status: number, detail: string) {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
}));

vi.mock("@/lib/auth", () => ({
  getRoleRedirect,
  setAccessToken,
  setUser,
}));

describe("Login role entry points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    apiPost.mockResolvedValue({ access_token: "token-123" });
    apiGet.mockResolvedValue({
      id: 11,
      full_name: "Cashier User",
      email: "cashier@example.com",
      role: "cashier",
      restaurant_id: 5,
      must_change_password: false,
      super_admin_scopes: [],
    });
    getRoleRedirect.mockReturnValue("/admin/billing/cashier");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the standard login form and signs in through the shared endpoint", async () => {
    render(
      <MemoryRouter initialEntries={["/login/cashier?entry_point=navbar_more&utm_source=google"]}>
        <Routes>
          <Route path="/login/:portal" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/billing/cashier" element={<div>Cashier Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(document.title).toContain("HotelMS Sign In");

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "cashier@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Cashier Dashboard")).toBeTruthy();
    expect(apiPost).toHaveBeenCalledWith("/auth/login", {
      email: "cashier@example.com",
      password: "Password1",
    });
    expect(setAccessToken).toHaveBeenCalledWith("token-123");
    expect(setUser).toHaveBeenCalled();
  });
});
