import { Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { publicGet, publicPost } from "@/lib/publicApi";
import type {
  ContactLeadCreateRequest,
  ContactLeadCreateResponse,
  ContactPageContent,
} from "@/types/siteContent";

import { landingFallbackContent } from "./landing/content";
import { Navbar, PageHero, PublicFooter } from "./landing/components";

const INITIAL_FORM: ContactLeadCreateRequest = {
  full_name: "",
  email: "",
  phone: "",
  company_name: "",
  property_type: "",
  subject: "",
  message: "",
  source_page: "contact",
};

export default function Contact() {
  const [content, setContent] = useState<ContactPageContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ContactLeadCreateRequest>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await publicGet<ContactPageContent>("/public/site/contact");
        if (!active) return;
        setContent(response);
      } catch {
        if (!active) return;
        setError("Unable to load the contact page right now.");
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await publicPost<ContactLeadCreateResponse>("/public/site/contact", form);
      setSuccess(response.message);
      setForm(INITIAL_FORM);
    } catch {
      setError("We could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

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
        <p className="animate-pulse text-sm text-slate-500">Loading contact page...</p>
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {content.channels.map((channel) => (
                <article key={channel.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    {channel.label}
                  </p>
                  <p className="mt-3 text-lg font-bold text-slate-900">{channel.value}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{channel.detail}</p>
                </article>
              ))}
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                <form className="space-y-4" onSubmit={onSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-2 block font-medium text-slate-700">Full name</span>
                      <input
                        required
                        value={form.full_name}
                        onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-2 block font-medium text-slate-700">Email</span>
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-2 block font-medium text-slate-700">Phone</span>
                      <input
                        value={form.phone}
                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-2 block font-medium text-slate-700">Company / Property</span>
                      <input
                        value={form.company_name}
                        onChange={(event) => setForm((current) => ({ ...current, company_name: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-2 block font-medium text-slate-700">Property type</span>
                      <select
                        value={form.property_type}
                        onChange={(event) => setForm((current) => ({ ...current, property_type: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="">Select type</option>
                        <option value="hotel">Hotel</option>
                        <option value="restaurant">Restaurant</option>
                        <option value="hybrid">Hotel and Restaurant</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-2 block font-medium text-slate-700">Subject</span>
                      <input
                        value={form.subject}
                        onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                      />
                    </label>
                  </div>

                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-slate-700">How can we help?</span>
                    <textarea
                      required
                      rows={6}
                      value={form.message}
                      onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                      className="w-full rounded-3xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>

                  {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                  {success && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      <p className="font-semibold">{content.success_title}</p>
                      <p className="mt-1">{success}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? "Submitting..." : "Send request"}
                  </button>
                </form>

                <aside className="space-y-5">
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      What You Can Expect
                    </p>
                    <div className="mt-4 space-y-3 text-sm text-emerald-900">
                      {content.response_commitments.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Demo Planning
                    </p>
                    <div className="mt-4 space-y-3 text-sm text-slate-700">
                      {content.sidebar_points.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Common Questions
            </p>
            <div className="mt-6 space-y-4">
              {content.faq.map((item) => (
                <article key={item.question} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h2 className="text-lg font-bold text-slate-900">{item.question}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PublicFooter footer={landingFallbackContent.footer} />
    </main>
  );
}
