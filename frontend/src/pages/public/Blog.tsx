import { Search } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import SeoHead from "@/components/public/SeoHead";
import { buildTrackedPath } from "@/features/public/attribution";
import { publicGet } from "@/lib/publicApi";
import type { BlogListResponse } from "@/types/siteContent";

import { landingFallbackContent } from "./landing/content";
import { BlogCard, CTASection, Navbar, PageHero, PublicFooter } from "./landing/components";

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [content, setContent] = useState<BlogListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "All");
  const deferredSearch = useDeferredValue(search);
  const currentSearchParams = searchParams.toString();

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (deferredSearch.trim()) {
      nextParams.set("search", deferredSearch.trim());
    } else {
      nextParams.delete("search");
    }
    if (category !== "All") {
      nextParams.set("category", category);
    } else {
      nextParams.delete("category");
    }
    if (nextParams.toString() !== currentSearchParams) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [category, currentSearchParams, deferredSearch, searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
        if (category !== "All") params.set("category", category);
        const path = params.toString() ? `/public/site/blogs?${params.toString()}` : "/public/site/blogs";
        const response = await publicGet<BlogListResponse>(path);
        if (!active) return;
        setContent(response);
        setError(null);
      } catch {
        if (!active) return;
        setError("Unable to load blog content right now.");
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [category, deferredSearch]);

  if (!content && error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <p className="max-w-md text-center text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <p className="animate-pulse text-sm text-slate-500">Loading blog content...</p>
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900">
      <SeoHead
        title={
          category !== "All" ? `${category} Hospitality Guides` : "Hospitality Insights and Blog"
        }
        description={content.page_description}
        path={
          currentSearchParams ? `/blog?${currentSearchParams}` : "/blog"
        }
        keywords={[
          "hotel operations blog",
          "restaurant billing articles",
          "room service workflow guides",
          category !== "All" ? `${category.toLowerCase()} guides` : "hospitality insights",
        ]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: content.page_title,
          description: content.page_description,
        }}
        trackAs="blog"
      />
      <Navbar />

      <PageHero
        eyebrow="Blog and Resources"
        title={content.page_title}
        description={content.page_description}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search hospitality articles"
              className="w-full rounded-2xl border border-slate-300 bg-white px-11 py-3 text-sm shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <Link
            to={buildTrackedPath("/contact", {
              source_page: "blog",
              entry_point: "blog_hero_demo",
            })}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Request a Demo
          </Link>
        </div>
      </PageHero>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2">
          {["All", ...content.categories].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                category === item
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {content.featured_post && (
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="grid gap-5 rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:p-8">
            <div className="overflow-hidden rounded-[26px] bg-slate-100">
              {content.featured_post.cover_image_url ? (
                <img
                  src={content.featured_post.cover_image_url}
                  alt={content.featured_post.title}
                  className="h-full min-h-[260px] w-full object-cover"
                />
              ) : (
                <div className="grid min-h-[260px] place-items-center bg-gradient-to-br from-emerald-100 to-sky-100 text-emerald-800">
                  Featured insight
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Featured Article
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-slate-900">
                {content.featured_post.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">{content.featured_post.excerpt}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {content.featured_post.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-8">
                <Link
                  to={buildTrackedPath(`/blog/${content.featured_post.slug}`)}
                  className="inline-flex items-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  Read Featured Article
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {content.items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">No articles matched your search</h2>
            <p className="mt-3 text-sm text-slate-500">Try another keyword or switch to a broader category.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {content.items.map((item) => (
              <BlogCard key={item.slug} item={item} />
            ))}
          </div>
        )}
      </section>

      <CTASection
        title="Turn these ideas into a working rollout"
        message="Talk with us about how your property can apply QR ordering, room service, and folio improvements."
        action_label="Contact Our Team"
        action_to="/contact"
        trackingEntryPoint="blog_bottom_cta"
      />
      <PublicFooter footer={landingFallbackContent.footer} />
    </main>
  );
}
