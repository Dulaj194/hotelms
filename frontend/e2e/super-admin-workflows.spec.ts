import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type SuperAdminScope = "ops_viewer" | "tenant_admin" | "billing_admin" | "security_admin";

const REVIEW_REASON_TEMPLATE =
  "Policy: <policy-check>; Evidence: <facts>; Decision: <approve/reject impact>.";

function buildJwtToken(_expirySeconds = 4_102_444_800): string {
  // A static non-expired JWT-shaped token is enough for client-side auth guards in e2e tests.
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjQxMDI0NDQ4MDB9.signature";
}

type SeededUser = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  restaurant_id: null;
  must_change_password: boolean;
  super_admin_scopes: SuperAdminScope[];
};

async function seedSuperAdminSession(page: Page, scopes: SuperAdminScope[]) {
  const token = buildJwtToken();
  const user: SeededUser = {
    id: 9001,
    full_name: "QA Super Admin",
    email: "qa-super-admin@example.com",
    role: "super_admin",
    restaurant_id: null,
    must_change_password: false,
    super_admin_scopes: scopes,
  };

  await page.addInitScript(
    ({ accessToken, storedUser }: { accessToken: string; storedUser: SeededUser }) => {
      window.localStorage.setItem("hotelms_access_token", accessToken);
      window.localStorage.setItem("hotelms_user", JSON.stringify(storedUser));
    },
    { accessToken: token, storedUser: user },
  );
}

function registrationItem(restaurantId: number, name: string) {
  return {
    restaurant_id: restaurantId,
    name,
    owner_user_id: restaurantId + 100,
    owner_full_name: `${name} Owner`,
    owner_email: `${name.toLowerCase().replace(/\s+/g, "-")}@example.com`,
    phone: "+94-11-1111111",
    address: "No. 12, Main Street",
    country: "Sri Lanka",
    currency: "LKR",
    billing_email: `billing-${restaurantId}@example.com`,
    opening_time: "08:00",
    closing_time: "22:00",
    logo_url: null,
    created_at: "2026-04-09T08:00:00Z",
    registration_status: "PENDING",
    registration_reviewed_by_id: null,
    registration_review_notes: null,
    registration_reviewed_at: null,
  };
}

function settingsRequestItem(requestId: number, restaurantId: number) {
  return {
    request_id: requestId,
    restaurant_id: restaurantId,
    requested_by: restaurantId + 300,
    requested_changes: {
      billing_email: `finance-${restaurantId}@example.com`,
    },
    current_settings: {
      billing_email: `old-finance-${restaurantId}@example.com`,
    },
    status: "PENDING",
    request_reason: "Need finance mailbox alignment for central accounting.",
    reviewed_by: null,
    review_notes: null,
    reviewed_at: null,
    created_at: "2026-04-09T08:00:00Z",
    updated_at: "2026-04-09T08:00:00Z",
  };
}

test("super admin happy path: bulk registration approval submits reasoned payload", async ({ page }) => {
  await seedSuperAdminSession(page, ["tenant_admin"]);

  let capturedBulkPayload: Record<string, unknown> | null = null;

  await page.route("**/api/v1/restaurants/registrations/pending**", async (route) => {
    await route.fulfill({
      json: {
        items: [registrationItem(101, "Harbor Lights"), registrationItem(102, "Palm Stay")],
        total: 2,
        next_cursor: null,
        has_more: false,
      },
    });
  });

  await page.route("**/api/v1/restaurants/registrations/bulk-review", async (route) => {
    capturedBulkPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        total_requested: 2,
        succeeded: 2,
        failed: 0,
        results: [
          { restaurant_id: 101, status: "ok", message: "Approved." },
          { restaurant_id: 102, status: "ok", message: "Approved." },
        ],
      },
    });
  });

  await page.goto("/super-admin/registrations");

  await expect(page.getByRole("heading", { name: "Pending Registrations" })).toBeVisible();
  await page.getByLabel("Select for bulk review").nth(0).check();
  await page.getByLabel("Select for bulk review").nth(1).check();
  await page.getByPlaceholder(REVIEW_REASON_TEMPLATE).fill(
    "Policy: Tenant onboarding policy verified; Evidence: required identity and profile data matched; Decision: approve onboarding impact.",
  );

  await page.getByRole("button", { name: /Bulk Approve \(2\)/ }).click();

  await expect(page.getByText("Bulk approval completed for 2 registration(s).", { exact: false })).toBeVisible();
  expect(capturedBulkPayload).toMatchObject({
    restaurant_ids: [101, 102],
    status: "APPROVED",
  });
});

test("super admin permission denial: billing page redirects to scoped default route", async ({ page }) => {
  await seedSuperAdminSession(page, ["tenant_admin"]);

  await page.route("**/api/v1/restaurants/registrations/pending**", async (route) => {
    await route.fulfill({
      json: {
        items: [],
        total: 0,
        next_cursor: null,
        has_more: false,
      },
    });
  });

  await page.goto("/super-admin/packages");

  await expect(page).toHaveURL(/\/super-admin\/registrations$/);
  await expect(page.getByRole("heading", { name: "Pending Registrations" })).toBeVisible();
});

test("super admin concurrent review: settings bulk review reports partial success", async ({ page }) => {
  await seedSuperAdminSession(page, ["tenant_admin"]);

  let capturedBulkPayload: Record<string, unknown> | null = null;

  await page.route("**/api/v1/settings/requests/pending**", async (route) => {
    await route.fulfill({
      json: {
        items: [settingsRequestItem(301, 41), settingsRequestItem(302, 42)],
        total: 2,
        next_cursor: null,
        has_more: false,
      },
    });
  });

  await page.route("**/api/v1/settings/requests/bulk-review", async (route) => {
    capturedBulkPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        total_requested: 2,
        succeeded: 1,
        failed: 1,
        results: [
          { request_id: 301, status: "error", message: "Request already reviewed by another admin." },
          { request_id: 302, status: "ok", message: "Reviewed." },
        ],
      },
    });
  });

  await page.goto("/super-admin/settings-requests");

  await expect(page.getByRole("heading", { name: "Settings Requests" })).toBeVisible();
  await page.getByLabel("Select for bulk review").nth(0).check();
  await page.getByLabel("Select for bulk review").nth(1).check();
  await page.getByPlaceholder(REVIEW_REASON_TEMPLATE).fill(
    "Policy: settings governance policy checked; Evidence: request diffs verified against tenant baseline; Decision: reject conflicting duplicate review.",
  );

  await page.getByRole("button", { name: /Bulk Reject \(2\)/ }).click();

  await expect(
    page.getByText("Bulk review partially completed (1 succeeded, 1 failed).", { exact: false }),
  ).toBeVisible();
  expect(capturedBulkPayload).toMatchObject({
    request_ids: [301, 302],
    status: "REJECTED",
  });
});

test("legacy super admin route redirects to active hotels flow", async ({ page }) => {
  await seedSuperAdminSession(page, ["tenant_admin"]);

  await page.route("**/api/v1/restaurants/overview", async (route) => {
    await route.fulfill({
      json: {
        items: [],
        subscriptions: [],
      },
    });
  });

  await page.goto("/super-admin/manage-restaurants");

  await expect(page).toHaveURL(/\/super-admin\/restaurants$/);
  await expect(page.getByRole("heading", { name: "Hotels" })).toBeVisible();
});
