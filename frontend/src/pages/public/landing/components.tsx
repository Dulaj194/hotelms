import { ArrowRight, ChevronDown, Menu, Sparkles, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import type {
  BenefitCardData,
  BlogCardData,
  FeatureCardData,
  MockupData,
  Stat,
} from "./content";

type NavLinkItem = {
  label: string;
  href?: string;
  to?: string;
};

const navLinks: NavLinkItem[] = [
  { label: "Home", href: "#home" },
  { label: "Benefits", href: "#benefits" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Blog", href: "#blog" },
  { label: "Contact", href: "#contact" },
  { label: "Pricing", to: "/pricing" },
];

export function NavLink({ item, onClick }: { item: NavLinkItem; onClick?: () => void }) {
  if (item.to) {
    return (
      <Link to={item.to} onClick={onClick} className="rounded-lg px-3 py-2 hover:bg-slate-100">
        {item.label}
      </Link>
    );
  }

  return (
    <a
      href={item.href}
      onClick={onClick}
      className="rounded-lg px-3 py-2 hover:bg-slate-100"
    >
      {item.label}
    </a>
  );
}

export function CTAButton({
  label,
  to,
  href,
  variant = "primary",
}: {
  label: string;
  to?: string;
  href?: string;
  variant?: "primary" | "secondary" | "dark";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition";

  const style =
    variant === "primary"
      ? "bg-yellow-400 font-bold text-slate-900 hover:bg-yellow-300"
      : variant === "dark"
        ? "bg-slate-900 text-white hover:bg-slate-800"
        : "border border-emerald-600 bg-white text-emerald-700 hover:bg-emerald-50";

  if (to) {
    return (
      <Link to={to} className={`${base} ${style}`}>
        {label}
        {variant === "primary" && <ArrowRight className="h-4 w-4" />}
      </Link>
    );
  }

  return (
    <a href={href} className={`${base} ${style}`}>
      {label}
      {variant === "primary" && <ArrowRight className="h-4 w-4" />}
    </a>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="max-w-3xl">
      <h2 className="text-3xl font-extrabold">{title}</h2>
      {subtitle && <p className="mt-3 text-slate-600">{subtitle}</p>}
    </div>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
            R
          </div>
          <p className="text-sm font-semibold tracking-wide text-emerald-700">R.Luminuous</p>
        </div>

        <nav className="hidden items-center gap-2 text-sm font-medium text-slate-600 lg:flex">
          {navLinks.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
          <div className="group relative">
            <button type="button" className="inline-flex items-center gap-1 rounded-lg px-3 py-2">
              More
              <ChevronDown className="h-4 w-4" />
            </button>
            <div className="invisible absolute right-0 top-9 w-48 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-md transition group-hover:visible group-hover:opacity-100">
              <Link to="/login" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100">
                Restaurant Admin
              </Link>
              <Link to="/login" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100">
                Super Admin
              </Link>
            </div>
          </div>
        </nav>

        <div className="hidden lg:block">
          <CTAButton label="Login" to="/login" variant="dark" />
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 lg:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            {navLinks.map((item) => (
              <NavLink
                key={item.label}
                item={item}
                onClick={() => setMobileOpen(false)}
              />
            ))}

            <button
              type="button"
              onClick={() => setMobileMoreOpen((prev) => !prev)}
              className="mt-1 inline-flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-100"
            >
              More
              <ChevronDown
                className={`h-4 w-4 transition ${mobileMoreOpen ? "rotate-180" : ""}`}
              />
            </button>

            {mobileMoreOpen && (
              <div className="ml-3 flex flex-col gap-1 border-l border-slate-200 pl-3">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-slate-100"
                >
                  Restaurant Admin
                </Link>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-slate-100"
                >
                  Super Admin
                </Link>
              </div>
            )}

            <CTAButton label="Login" to="/login" variant="dark" />
          </div>
        </div>
      )}
    </header>
  );
}

export function HeroBlock({
  productName,
  whatItDoes,
  whoItHelps,
  whyItMatters,
}: {
  productName: string;
  whatItDoes: string;
  whoItHelps: string;
  whyItMatters: string;
}) {
  return (
    <section
      id="home"
      className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50"
    >
      <div className="pointer-events-none absolute -left-20 top-16 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-24 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            <Sparkles className="h-4 w-4" />
            QR-Powered Restaurant & Hotel Solution
          </span>

          <h1 className="mt-6 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
            <span className="block text-emerald-700">{productName}</span>
            <br />
            {whatItDoes}
          </h1>

          <p className="mt-5 max-w-xl text-lg text-slate-600">
            {whoItHelps}. {whyItMatters}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <CTAButton label="Start Free Trial" to="/pricing" variant="primary" />
            <CTAButton label="Request a Demo" href="#contact" variant="secondary" />
          </div>
        </div>

        <div className="order-last rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm lg:order-none">
          <div className="relative overflow-hidden rounded-2xl bg-emerald-900 p-4">
            <img
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"
              alt={`Restaurant operations powered by ${productName}`}
              className="h-[350px] w-full rounded-xl object-cover opacity-80"
            />
            <div className="absolute left-7 top-7 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
              Live Orders
            </div>
            <div className="absolute bottom-7 right-7 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-blue-700">
              Sales Reports
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StatCard({ item }: { item: Stat }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <p className="text-3xl font-extrabold text-emerald-700">{item.value}</p>
      <p className="mt-2 text-sm font-medium text-slate-600">{item.label}</p>
    </div>
  );
}

export function BenefitCard({ item }: { item: BenefitCardData }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <h3 className="text-lg font-bold">{item.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        <span className="font-semibold text-slate-800">Pain: </span>
        {item.pain}
      </p>
      <p className="mt-2 text-sm leading-6 text-emerald-700">
        <span className="font-semibold">Outcome: </span>
        {item.outcome}
      </p>
    </article>
  );
}

export function FeatureCard({ item }: { item: FeatureCardData }) {
  const Icon = item.icon;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
        <Icon className="h-6 w-6 text-emerald-700" />
      </div>
      <h3 className="mt-4 text-lg font-bold">{item.capability}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.explanation}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        {item.visualHint}
      </p>
    </article>
  );
}

export function MockupStrip({ items }: { items: MockupData[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Product Views
          </p>
          <p className="text-xs text-slate-500">Hospitality workflow snapshots</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((item) => (
            <article
              key={item.title}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
            >
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-28 w-full object-cover"
              />
              <p className="px-3 py-2 text-xs font-semibold text-slate-700">{item.title}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StepCard({ step, index }: { step: string; index: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
        {index + 1}
      </span>
      <p className="text-sm font-medium text-slate-700">{step}</p>
    </div>
  );
}

export function BlogCard({ item }: { item: BlogCardData }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{item.excerpt}</p>
      <a href="#" className="mt-4 inline-flex text-sm font-semibold text-emerald-700">
        Read more
      </a>
    </article>
  );
}

export function CTASection({
  title,
  message,
  actionLabel,
  actionTo,
}: {
  title: string;
  message: string;
  actionLabel: string;
  actionTo: string;
}) {
  return (
    <section id="contact" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-3xl bg-slate-900 p-8 text-white sm:p-10">
        <h2 className="text-3xl font-extrabold">{title}</h2>
        <p className="mt-3 max-w-2xl text-slate-300">{message}</p>
        <div className="mt-7">
          <Link
            to={actionTo}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-400"
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}