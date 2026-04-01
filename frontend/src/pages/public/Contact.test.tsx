import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Contact from "@/pages/public/Contact";

const { publicGet, publicPost } = vi.hoisted(() => ({
  publicGet: vi.fn(),
  publicPost: vi.fn(),
}));

vi.mock("@/lib/publicApi", () => ({
  publicGet,
  publicPost,
}));

describe("Contact page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicGet.mockResolvedValue({
      hero_eyebrow: "Talk With Our Team",
      hero_title: "Plan your rollout with a hospitality-focused demo",
      hero_description: "Share your current setup and we will help map the right flow.",
      channels: [
        { label: "Email", value: "info@rluminuous.com", detail: "Demo and onboarding questions." },
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
    });
    publicPost.mockResolvedValue({
      id: 17,
      message: "Our team will review your message and contact you shortly.",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("submits a contact lead and shows the success state", async () => {
    render(
      <MemoryRouter>
        <Contact />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Plan your rollout with a hospitality-focused demo")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Nadeesha Perera" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nadeesha@example.com" } });
    fireEvent.change(screen.getByLabelText("How can we help?"), {
      target: { value: "We need QR ordering, room service, and folio settlement for our property." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("Thanks, your request has been received.")).toBeTruthy();
    expect(screen.getByText("Our team will review your message and contact you shortly.")).toBeTruthy();
    expect(publicPost).toHaveBeenCalledWith(
      "/public/site/contact",
      expect.objectContaining({
        full_name: "Nadeesha Perera",
        email: "nadeesha@example.com",
      }),
    );
  });
});
