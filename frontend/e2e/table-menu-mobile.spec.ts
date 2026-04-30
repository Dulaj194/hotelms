import { expect, test } from "@playwright/test";

const tableMenuPayload = {
  restaurant: {
    id: 7,
    name: "Luminous Hotel",
    phone: "+94112345678",
    address: "Colombo",
    logo_url: "/uploads/logos/missing.png",
    public_menu_banner_urls: ["/uploads/banners/missing.jpg"],
    is_active: true,
  },
  menus: [],
  uncategorized_categories: [],
  categories: [
    {
      id: 1,
      name: "kiribath",
      description: null,
      image_path: "/uploads/categories/kiribath.jpg",
      sort_order: 1,
      menu_id: 1,
      items: [
        {
          id: 101,
          name: "2*2",
          description: null,
          price: 39.99,
          image_path: "/uploads/items/2x2.jpg",
          is_available: true,
          category_id: 1,
        },
        {
          id: 102,
          name: "4*4",
          description: null,
          price: 69.98,
          image_path: "/uploads/items/4x4.jpg",
          is_available: true,
          category_id: 1,
        },
      ],
    },
    {
      id: 2,
      name: "kottu",
      description: null,
      image_path: "/uploads/categories/kottu.jpg",
      sort_order: 2,
      menu_id: 1,
      items: [
        {
          id: 103,
          name: "Chicken Kottu",
          description: null,
          price: 12.5,
          image_path: null,
          is_available: true,
          category_id: 2,
        },
      ],
    },
    {
      id: 3,
      name: "rice",
      description: null,
      image_path: "/uploads/categories/rice.jpg",
      sort_order: 3,
      menu_id: 1,
      items: [
        {
          id: 104,
          name: "Veg Rice",
          description: null,
          price: 9.25,
          image_path: null,
          is_available: false,
          category_id: 3,
        },
      ],
    },
  ],
};

test("table QR menu keeps a stable mobile ordering layout when media is missing", async ({
  page,
}) => {
  await page.route("**/uploads/**", async (route) => {
    await route.fulfill({ status: 404, body: "missing" });
  });

  await page.route("**/api/v1/public/restaurants/7/menu", async (route) => {
    await route.fulfill({ json: tableMenuPayload });
  });

  await page.addInitScript(() => {
    sessionStorage.setItem(
      "hotelms_guest_profile",
      JSON.stringify({
        restaurant_id: 7,
        table_number: "1",
        customer_name: "gh",
      }),
    );
    sessionStorage.setItem(
      "hotelms_guest_qr_access_map",
      JSON.stringify({ "7:1": "qr-secret" }),
    );
  });

  await page.goto("/menu/7/table/1?k=qr-secret");
  await expect(page.getByText("Luminous Hotel").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "All items" })).toBeVisible();
  await expect(page.getByText("Chat")).toBeVisible();

  const cards = page.locator("#menu-list .grid > div");
  await expect(cards).toHaveCount(4);

  const firstCard = await cards.nth(0).boundingBox();
  const secondCard = await cards.nth(1).boundingBox();
  expect(firstCard).not.toBeNull();
  expect(secondCard).not.toBeNull();
  expect(Math.abs(firstCard!.y - secondCard!.y)).toBeLessThanOrEqual(2);
  expect(firstCard!.width).toBeGreaterThan(120);

  const imageAndWidthState = await page.evaluate(() => ({
    brokenImages: Array.from(document.images).filter(
      (image) => image.complete && image.naturalWidth === 0,
    ).length,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
  }));

  expect(imageAndWidthState.brokenImages).toBe(0);
  expect(imageAndWidthState.horizontalOverflow).toBe(false);
});
