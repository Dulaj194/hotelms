import { expect, test } from "@playwright/test";

const contactPagePayload = {
  hero_eyebrow: "Talk With Our Team",
  hero_title: "Plan your rollout with a hospitality-focused demo",
  hero_description: "Share your current setup and we will help map the right flow.",
  channels: [
    {
      label: "Email",
      value: "info@rluminuous.com",
      detail: "Demo and onboarding questions.",
    },
  ],
  response_commitments: ["Typical response within one business day"],
  faq: [
    {
      question: "Can this work for both hotel rooms and restaurant tables?",
      answer: "Yes. The platform supports both.",
    },
  ],
  sidebar_points: ["Free rollout consultation"],
  success_title: "Thanks, your request has been received.",
  success_message: "Our team will review your message and contact you shortly.",
};

test("mobile users can open a role-specific login portal from the public navbar", async ({
  page,
}) => {
  await page.route("**/api/v1/public/site/landing", async (route) => {
    await route.fulfill({
      json: {
        hero_badge: "Hospitality Software",
        product_name: "R.LUMINUOUS",
        hero_title: "Unify ordering, billing, and hotel operations",
        hero_description: "Run restaurant and room workflows from one mobile-ready platform.",
        primary_cta_label: "Book a Demo",
        primary_cta_to: "/contact",
        secondary_cta_label: "Learn More",
        secondary_cta_to: "/about",
        hero_image_url: "https://example.com/hero.jpg",
        stats: [{ value: "24/7", label: "Operations visibility" }],
        audiences: [{ title: "Hotels", message: "Room service and billing visibility." }],
        benefits: [{ title: "Faster handoff", pain: "Manual gaps", outcome: "Cleaner execution" }],
        features: [
          {
            capability: "Room service",
            explanation: "Track guest requests and orders.",
            visual_hint: "Mobile ready",
            icon_key: "qr_code",
          },
        ],
        steps: ["Guest orders", "Team prepares", "Finance closes"],
        use_cases: [{ title: "Room service", details: "Coordinate delivery and folios." }],
        mockups: [{ title: "Billing", image_url: "https://example.com/mockup.jpg" }],
        testimonial: {
          quote: "This shortened our service handoff.",
          author: "Front Office Lead",
          role: "Harbor Lights Hotel",
        },
        cta: {
          title: "Ready to see it live?",
          message: "Book a guided walkthrough.",
          action_label: "Talk to Sales",
          action_to: "/contact",
        },
        trust_message: "Trusted by hospitality teams.",
        footer: {
          trust_info: "Hospitality operations software.",
          contact_points: ["info@rluminuous.com"],
        },
      },
    });
  });

  await page.route("**/api/v1/public/site/blogs/recent", async (route) => {
    await route.fulfill({
      json: [
        {
          slug: "room-folio-playbook",
          title: "Room Folio Playbook",
          excerpt: "Keep room billing visible from kitchen to finance.",
          category: "Billing",
          cover_image_url: null,
          tags: ["folio"],
          reading_minutes: 5,
          is_featured: true,
          published_at: "2026-04-02T12:00:00Z",
        },
      ],
    });
  });

  await page.goto("/?utm_source=google&utm_campaign=spring-demo");
  await page.getByLabel("Toggle menu").click();
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("link", { name: "Cashier Portal" }).click();

  await expect(page).toHaveURL(/\/login\/cashier/);
  await expect(page).toHaveURL(/utm_source=google/);
  await expect(page.getByRole("heading", { name: "Cashier Sign In" }).first()).toBeVisible();
});

test("mobile contact flow preserves attribution data during lead submission", async ({ page }) => {
  let capturedLeadPayload: Record<string, unknown> | null = null;

  await page.route("**/api/v1/public/site/blogs*", async (route) => {
    await route.fulfill({
      json: {
        page_title: "Hospitality Insights and Practical Guides",
        page_description: "Operational ideas for restaurant floors, room service teams, and finance workflows.",
        categories: ["Billing"],
        featured_post: {
          slug: "room-folio-playbook",
          title: "Room Folio Playbook",
          excerpt: "Keep room billing visible from kitchen to finance.",
          category: "Billing",
          cover_image_url: null,
          tags: ["folio"],
          reading_minutes: 5,
          is_featured: true,
          published_at: "2026-04-02T12:00:00Z",
        },
        items: [
          {
            slug: "room-folio-playbook",
            title: "Room Folio Playbook",
            excerpt: "Keep room billing visible from kitchen to finance.",
            category: "Billing",
            cover_image_url: null,
            tags: ["folio"],
            reading_minutes: 5,
            is_featured: true,
            published_at: "2026-04-02T12:00:00Z",
          },
        ],
      },
    });
  });

  await page.route("**/api/v1/public/site/contact", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: contactPagePayload });
      return;
    }

    capturedLeadPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      json: {
        id: 22,
        message: "Our team will review your message and contact you shortly.",
      },
    });
  });

  await page.goto("/blog?utm_source=google&utm_campaign=spring-demo");
  await page.getByRole("link", { name: "Request a Demo" }).click();

  await expect(page).toHaveURL(/\/contact/);
  await page.getByLabel("Full name").fill("Mobile Prospect");
  await page.getByLabel("Email").fill("mobile@example.com");
  await page
    .getByLabel("How can we help?")
    .fill("We need room billing, cashier handoff, and mobile-ready staff workflows.");
  await page.getByRole("button", { name: "Send request" }).click();

  await expect(page.getByText("Thanks, your request has been received.")).toBeVisible();
  expect(capturedLeadPayload).not.toBeNull();
  expect(capturedLeadPayload?.utm_source).toBe("google");
  expect(capturedLeadPayload?.utm_campaign).toBe("spring-demo");
  expect(capturedLeadPayload?.entry_point).toBe("blog_hero_demo");
});
