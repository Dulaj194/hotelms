import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SeoHead from "@/components/public/SeoHead";
import { buildTrackedPath } from "@/features/public/attribution";
import { publicGet } from "@/lib/publicApi";
import type { BlogPostDetail } from "@/types/siteContent";

import { landingFallbackContent } from "./landing/content";
import { Navbar, PublicFooter } from "./landing/components";

function fmt(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<BlogPostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let active = true;

    const load = async () => {
      try {
        const response = await publicGet<BlogPostDetail>(`/public/site/blogs/${slug}`);
        if (!active) return;
        setArticle(response);
      } catch {
        if (!active) return;
        setError("Unable to load this article right now.");
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [slug]);

  if (!article && error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="max-w-md text-center text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="animate-pulse text-sm text-slate-500">Loading article...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SeoHead
        title={article.title}
        description={article.excerpt}
        path={`/blog/${article.slug}`}
        type="article"
        image={article.cover_image_url}
        keywords={[article.category, ...article.tags]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: article.excerpt,
          datePublished: article.published_at,
          articleSection: article.category,
          keywords: article.tags.join(", "),
        }}
        trackAs="blog_article"
      />
      <Navbar />

      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <Link
            to={buildTrackedPath("/blog")}
            className="text-sm font-semibold text-emerald-700 hover:underline"
          >
            Back to blog
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            <span>{article.category}</span>
            <span className="text-slate-300">|</span>
            <span>{fmt(article.published_at)}</span>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {article.reading_minutes} min read
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-black leading-tight text-slate-900 sm:text-5xl">
            {article.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{article.excerpt}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          {article.cover_image_url ? (
            <img
              src={article.cover_image_url}
              alt={article.title}
              className="h-[260px] w-full object-cover sm:h-[340px]"
            />
          ) : null}
          <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-8">
            <article className="space-y-5 text-sm leading-7 text-slate-700 sm:text-base">
              {article.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Key Takeaways
                </p>
                <div className="mt-4 space-y-3 text-sm text-emerald-900">
                  {article.key_takeaways.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Need help applying this?
                </p>
                <h2 className="mt-3 text-xl font-bold text-slate-900">Let us map the workflow with you</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Share your hotel or restaurant setup and we can walk through the right rollout plan.
                </p>
                <Link
                  to={buildTrackedPath("/contact", {
                    source_page: "blog_article",
                    entry_point: "blog_article_sidebar_cta",
                  })}
                  className="mt-5 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Contact our team
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {article.related_posts.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Related reading</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {article.related_posts.map((item) => (
                <Link
                  key={item.slug}
                  to={buildTrackedPath(`/blog/${item.slug}`)}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    {item.category}
                  </p>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <PublicFooter footer={landingFallbackContent.footer} />
    </main>
  );
}
