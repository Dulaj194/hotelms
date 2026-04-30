import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SiteContentPage from "@/pages/super-admin/SiteContent";
import type { AdminContactLead } from "@/types/siteContent";

const { apiGet, apiPost, apiPut, apiPatch, apiDelete, downloadContactLeadCsv } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  downloadContactLeadCsv: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: apiGet,
    post: apiPost,
    put: apiPut,
    patch: apiPatch,
    delete: apiDelete,
  },
}));

vi.mock("@/features/super-admin/site-content/helpers", async () => {
  const actual = await vi.importActual<typeof import("@/features/super-admin/site-content/helpers")>(
    "@/features/super-admin/site-content/helpers",
  );
  return {
    ...actual,
    downloadContactLeadCsv,
  };
});

vi.mock("@/components/shared/SuperAdminLayout", () => ({
  default: ({ children }: { children: any }) => <div>{children}</div>,
}));

describe("SiteContentPage", () => {
  const assignee = {
    user_id: 88,
    full_name: "Kasun Perera",
    email: "kasun@example.com",
    scopes: ["tenant_admin"],
  };

  const aboutDetail = {
    slug: "about",
    title: "About R.LUMINUOUS",
    summary: "About page content",
    is_published: true,
    last_published_at: "2026-04-02T06:00:00Z",
    updated_at: "2026-04-02T05:00:00Z",
    updated_by: assignee,
    published_by: assignee,
    payload: {
      hero_eyebrow: "About the Platform",
      hero_title: "Built for hospitality teams that need speed and control",
      hero_description: "Platform story",
      overview_title: "Why we built it",
      overview_paragraphs: ["Paragraph one", "Paragraph two"],
      values: [{ title: "Operational clarity", description: "Visibility for the team." }],
      milestones: ["QR entry points for tables and rooms"],
      capabilities: [{ title: "Unified guest journey", details: "Connected ordering experience." }],
      cta: {
        title: "See how the workflow fits your property",
        message: "Talk with us about your operation.",
        action_label: "Talk to Sales",
        action_to: "/contact",
      },
    },
    published_payload: null,
  };

  const contactDetail = {
    slug: "contact",
    title: "Contact R.LUMINUOUS",
    summary: "Contact page content",
    is_published: false,
    last_published_at: null,
    updated_at: "2026-04-02T04:30:00Z",
    updated_by: assignee,
    published_by: null,
    payload: {
      hero_eyebrow: "Talk With Our Team",
      hero_title: "Plan your rollout with a hospitality-focused demo",
      hero_description: "Reach the team",
      channels: [
        {
          label: "Email",
          value: "info@rluminuous.com",
          detail: "Best for demos and implementation questions.",
        },
      ],
      response_commitments: ["Typical response within one business day"],
      faq: [
        {
          question: "Can this work for both hotel rooms and restaurant tables?",
          answer: "Yes. The platform supports both workflows.",
        },
      ],
      sidebar_points: ["Free rollout consultation"],
      success_title: "Thanks, your request has been received.",
      success_message: "Our team will contact you shortly.",
    },
    published_payload: null,
  };

  const blogSummary = {
    slug: "room-service-workflows",
    title: "Room Service Workflows That Guests Actually Use",
    excerpt: "Why room ordering adoption improves with live tracking.",
    category: "Room Service",
    cover_image_url: null,
    tags: ["hotel", "room service"],
    reading_minutes: 5,
    is_featured: false,
    is_published: true,
    scheduled_publish_at: "2026-04-01T06:00:00Z",
    live_published_at: "2026-04-01T06:15:00Z",
    last_published_at: "2026-04-01T06:15:00Z",
    updated_at: "2026-04-01T06:00:00Z",
    updated_by: assignee,
    published_by: assignee,
  };

  let currentLead: AdminContactLead = {
    id: 101,
    full_name: "Nadeesha Fernando",
    email: "nadeesha@example.com",
    phone: "0771234567",
    company_name: "Ocean View Hotel",
    property_type: "hotel",
    subject: "Need a room service demo",
    message: "We want a demo for a 20-room property with room billing workflows.",
    source_page: "contact",
    source_path: "/contact?utm_source=google&utm_campaign=spring-demo",
    entry_point: "blog_bottom_cta",
    login_intent: "cashier",
    referrer_url: "https://google.com/search?q=hotel+software",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "spring-demo",
    utm_term: "hotel software",
    utm_content: "blog-cta",
    status: "new",
    internal_notes: null,
    assigned_to: null,
    created_at: "2026-04-02T01:00:00Z",
    updated_at: "2026-04-02T01:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    currentLead = {
      id: 101,
      full_name: "Nadeesha Fernando",
      email: "nadeesha@example.com",
      phone: "0771234567",
      company_name: "Ocean View Hotel",
      property_type: "hotel",
      subject: "Need a room service demo",
      message: "We want a demo for a 20-room property with room billing workflows.",
      source_page: "contact",
      source_path: "/contact?utm_source=google&utm_campaign=spring-demo",
      entry_point: "blog_bottom_cta",
      login_intent: "cashier",
      referrer_url: "https://google.com/search?q=hotel+software",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring-demo",
      utm_term: "hotel software",
      utm_content: "blog-cta",
      status: "new",
      internal_notes: null,
      assigned_to: null,
      created_at: "2026-04-02T01:00:00Z",
      updated_at: "2026-04-02T01:00:00Z",
    };

    apiGet.mockImplementation(async (path: string) => {
      if (path === "/site-content/admin/pages") {
        return {
          items: [
            {
              slug: aboutDetail.slug,
              title: aboutDetail.title,
              summary: aboutDetail.summary,
              is_published: aboutDetail.is_published,
              last_published_at: aboutDetail.last_published_at,
              updated_at: aboutDetail.updated_at,
              updated_by: aboutDetail.updated_by,
              published_by: aboutDetail.published_by,
            },
            {
              slug: contactDetail.slug,
              title: contactDetail.title,
              summary: contactDetail.summary,
              is_published: contactDetail.is_published,
              last_published_at: contactDetail.last_published_at,
              updated_at: contactDetail.updated_at,
              updated_by: contactDetail.updated_by,
              published_by: contactDetail.published_by,
            },
          ],
          total: 2,
        };
      }
      if (path === "/site-content/admin/pages/about") {
        return aboutDetail;
      }
      if (path === "/site-content/admin/pages/contact") {
        return contactDetail;
      }
      if (path.startsWith("/site-content/admin/blogs?")) {
        return { items: [blogSummary], total: 1 };
      }
      if (path === "/site-content/admin/leads/assignees") {
        return { items: [assignee], total: 1 };
      }
      if (path.startsWith("/site-content/admin/leads?")) {
        return {
          items: [currentLead],
          total: 1,
          summary: {
            new_count: currentLead.status === "new" ? 1 : 0,
            reviewed_count: currentLead.status === "reviewed" ? 1 : 0,
            qualified_count: currentLead.status === "qualified" ? 1 : 0,
            closed_count: currentLead.status === "closed" ? 1 : 0,
            unassigned_count: currentLead.assigned_to ? 0 : 1,
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    apiPatch.mockImplementation(async () => {
      currentLead = {
        ...currentLead,
        status: "qualified",
        internal_notes: "Requested demo for 20 rooms.",
        assigned_to: assignee,
        updated_at: "2026-04-02T03:00:00Z",
      };
      return currentLead;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the public site cms workspace and blog queue", async () => {
    render(<SiteContentPage />);

    expect(await screen.findByText("Manage the public site, blog pipeline, and lead inbox")).toBeTruthy();
    expect(screen.getByText("About R.LUMINUOUS")).toBeTruthy();
    expect(screen.getByText("Contact R.LUMINUOUS")).toBeTruthy();
    expect(screen.getByText("2 managed pages in the CMS")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Blogs" }));

    expect(await screen.findByText("Room Service Workflows That Guests Actually Use")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New Draft" })).toBeTruthy();
  });

  it("updates the selected lead and refreshes the inbox state", async () => {
    render(<SiteContentPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Lead Inbox" }));
    expect(await screen.findByText("Lead Detail")).toBeTruthy();
    expect(screen.getAllByText("Nadeesha Fernando").length).toBeGreaterThan(0);

    const statusFields = screen.getAllByLabelText("Status");
    fireEvent.change(statusFields[1], { target: { value: "qualified" } });
    fireEvent.change(screen.getByLabelText("Assigned Owner"), { target: { value: "88" } });
    fireEvent.change(screen.getByLabelText("Internal Notes"), {
      target: { value: "Requested demo for 20 rooms." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Lead Update" }));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith("/site-content/admin/leads/101", {
        status: "qualified",
        assigned_to_user_id: 88,
        internal_notes: "Requested demo for 20 rooms.",
      }),
    );
    expect(await screen.findByText("Lead inbox updated.")).toBeTruthy();
    expect(
      apiGet.mock.calls.filter(([path]) => String(path).startsWith("/site-content/admin/leads?")).length,
    ).toBeGreaterThanOrEqual(2);
  });
});
