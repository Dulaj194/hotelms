import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

import {
  benefitCards,
  blogs,
  ctaContent,
  features,
  footerContent,
  heroContent,
  mockups,
  stats,
  steps,
} from "./landing/content";
import {
  BenefitCard,
  BlogCard,
  CTASection,
  FeatureCard,
  FooterColumn,
  HeroBlock,
  MockupStrip,
  Navbar,
  SectionHeader,
  StatCard,
  StepCard,
} from "./landing/components";

export default function Landing() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <Navbar />

      <HeroBlock {...heroContent} />
      <MockupStrip items={mockups} />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((item) => (
            <StatCard key={item.label} item={item} />
          ))}
        </div>
      </section>

      <section id="benefits" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeader title="Why teams choose R.Luminuous" />
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {benefitCards.map((item) => (
              <BenefitCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeader
          title="Built for daily operations"
          subtitle="Everything your restaurant or hotel team needs to run faster with fewer manual steps."
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((item) => (
            <FeatureCard key={item.capability} item={item} />
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeader title="How it works" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, index) => (
              <StepCard key={step} step={step} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section id="blog" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeader
          title="Latest from our blog"
          subtitle="Practical hospitality insights you can apply this week."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {blogs.map((item) => (
            <BlogCard key={item.title} item={item} />
          ))}
        </div>
      </section>

      <CTASection {...ctaContent} />

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Support available for onboarding and migration.
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div>
            <p className="text-lg font-bold text-emerald-700">R.Luminuous</p>
            <p className="mt-3 text-sm text-slate-600">{footerContent.trustInfo}</p>
          </div>

          <FooterColumn title="Product">
            <a href="#features" className="block">Features</a>
            <a href="#how-it-works" className="block">How it works</a>
            <Link to="/pricing" className="block">Pricing</Link>
          </FooterColumn>

          <FooterColumn title="Company">
            <a href="#benefits" className="block">About</a>
            <a href="#blog" className="block">Blog</a>
            <a href="#contact" className="block">Contact</a>
          </FooterColumn>

          <FooterColumn title="Contact">
            {footerContent.contactPoints.map((point) => (
              <p key={point}>{point}</p>
            ))}
          </FooterColumn>
        </div>
      </footer>
    </main>
  );
}