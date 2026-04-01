import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { publicGet } from "@/lib/publicApi";
import type { AboutPageContent } from "@/types/siteContent";

import { landingFallbackContent } from "./landing/content";
import { CTASection, Navbar, PageHero, PublicFooter } from "./landing/components";

export default function About() {
  const [content, setContent] = useState<AboutPageContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await publicGet<AboutPageContent>("/public/site/about");
        if (!active) return;
        setContent(response);
      } catch {
        if (!active) return;
        setError("Unable to load the about page right now.");
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  if (!content && error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="max-w-md text-center text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="animate-pulse text-sm text-slate-500">Loading about page...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <PageHero
        eyebrow={content.hero_eyebrow}
        title={content.hero_title}
        description={content.hero_description}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-slate-900">{content.overview_title}</h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600 sm:text-base">
              {content.overview_paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>

          <aside className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Platform Milestones
            </p>
            <div className="mt-5 space-y-4">
              {content.milestones.map((milestone) => (
                <div key={milestone} className="flex items-start gap-3 text-sm text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{milestone}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Core Values
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-900">How we approach hospitality software</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {content.values.map((value) => (
              <article key={value.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">{value.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{value.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            What The Platform Covers
          </p>
          <h2 className="mt-3 text-3xl font-black text-slate-900">Built to support execution, not just ordering</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {content.capabilities.map((item) => (
            <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.details}</p>
            </article>
          ))}
        </div>
      </section>

      <CTASection {...content.cta} />
      <PublicFooter footer={landingFallbackContent.footer} />
    </main>
  );
}
