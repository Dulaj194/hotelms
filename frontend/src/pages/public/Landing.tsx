import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import SeoHead from "@/components/public/SeoHead";
import { publicGet } from "@/lib/publicApi";
import type { BlogPostSummary, LandingPageContent } from "@/types/siteContent";

import { landingFallbackBlogs, landingFallbackContent } from "./landing/content";
import {
  AudienceCard,
  BenefitCard,
  BlogCard,
  CTASection,
  FeatureCard,
  HeroBlock,
  MockupStrip,
  Navbar,
  PublicFooter,
  SectionHeader,
  StatCard,
  StepCard,
  TestimonialBlock,
  UseCaseCard,
} from "./landing/components";

export default function Landing() {
  const [content, setContent] = useState<LandingPageContent>(landingFallbackContent);
  const [blogs, setBlogs] = useState<BlogPostSummary[]>(landingFallbackBlogs);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [landing, recentBlogs] = await Promise.all([
          publicGet<LandingPageContent>("/public/site/landing"),
          publicGet<BlogPostSummary[]>("/public/site/blogs/recent"),
        ]);
        if (!active) return;
        setContent(landing);
        setBlogs(recentBlogs);
      } catch {
        // Keep the baked-in fallback content so the public site still renders.
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <SeoHead
        title="Hospitality Operations Platform"
        description="Unify QR ordering, room service, billing handoff, and staff workflows in one hospitality platform."
        path="/"
        keywords={[
          "hotel restaurant management software",
          "room service software",
          "folio billing workflow",
          "restaurant qr ordering",
        ]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: content.product_name,
          applicationCategory: "BusinessApplication",
          description: content.hero_description,
          offers: {
            "@type": "Offer",
            description: "Hospitality platform demo and onboarding consultation",
          },
        }}
        trackAs="landing"
      />
      <Navbar />

      <HeroBlock {...content} />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {content.stats.map((item) => (
            <StatCard key={item.label} item={item} />
          ))}
        </div>
      </section>

      <section id="who-its-for" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionHeader
            title="Who it is for"
            subtitle="Designed for hotel and restaurant teams that need faster operations and clearer visibility."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {content.audiences.map((item) => (
              <AudienceCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section id="benefits" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionHeader
            title="Core benefits"
            subtitle="Clear business pain points mapped to measurable operational outcomes."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {content.benefits.map((item) => (
              <BenefitCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionHeader
            title="How it works"
            subtitle="A simple flow from guest action to staff execution and delivery."
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {content.steps.map((step, index) => (
              <StepCard key={step} step={step} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          title="Main features"
          subtitle="Capabilities that connect guest ordering, staff workflow, and business analytics."
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {content.features.map((item) => (
            <FeatureCard key={item.capability} item={item} />
          ))}
        </div>
      </section>

      <section id="use-cases" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionHeader
            title="Hospitality use cases"
            subtitle="Built to support real workflows across restaurant floors and hotel operations."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {content.use_cases.map((item) => (
              <UseCaseCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <MockupStrip items={content.mockups} />
      <TestimonialBlock item={content.testimonial} />

      <section id="blog" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          title="Latest from our blog"
          subtitle="Practical hospitality insights you can apply this week."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {blogs.map((item) => (
            <BlogCard key={item.slug} item={item} />
          ))}
        </div>
      </section>

      <CTASection {...content.cta} trackingEntryPoint="landing_bottom_cta" />

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {content.trust_message}
        </div>
      </section>

      <PublicFooter footer={content.footer} />
    </main>
  );
}
