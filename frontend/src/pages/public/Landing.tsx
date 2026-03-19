import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  CheckCircle2,
  ChefHat,
  Menu,
  QrCode,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const stats = [
  { value: "500+", label: "Restaurants" },
  { value: "1M+", label: "Orders" },
  { value: "99.9%", label: "Uptime" },
];

const benefitCards = [
  {
    title: "Run Smoothly",
    description:
      "Handle ordering and service flow with fewer manual steps and less staff pressure.",
  },
  {
    title: "Turn Tables Faster",
    description:
      "Reduce waiting time from menu to billing with instant QR-driven ordering.",
  },
  {
    title: "Real-Time Decisions",
    description:
      "Use live sales and item performance data to optimize your menu quickly.",
  },
  {
    title: "No App Downloads",
    description:
      "Guests scan a QR and use the web menu directly from any modern phone browser.",
  },
];

const features = [
  {
    title: "QR Ordering",
    description:
      "Guests scan and order instantly without app downloads or paper menus.",
    icon: QrCode,
  },
  {
    title: "Kitchen Workflow",
    description:
      "Orders route to kitchen dashboards in real time with clear status updates.",
    icon: ChefHat,
  },
  {
    title: "Sales Insights",
    description:
      "Track top items, peak hours, and performance with live analytics.",
    icon: BarChart3,
  },
  {
    title: "Secure Platform",
    description:
      "Role-based access and stable infrastructure for daily operations.",
    icon: ShieldCheck,
  },
];

const steps = [
  "Guest scans table or room QR",
  "Menu opens and order is placed",
  "Staff confirms and kitchen starts",
  "Kitchen receives order instantly",
  "Status updates are shared live",
  "Order delivered with faster turnaround",
];

const blogs = [
  {
    title: "How QR Ordering Improves Table Turnover",
    excerpt:
      "Learn practical ways digital menus reduce waiting time and improve guest flow.",
  },
  {
    title: "5 Hospitality Metrics You Should Track Weekly",
    excerpt:
      "Track actionable KPIs from order value to kitchen speed using your dashboard.",
  },
  {
    title: "Launching Contactless Service in 7 Days",
    excerpt:
      "A simple rollout plan for restaurants and hotels moving to QR-based workflows.",
  },
];

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
              R
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-emerald-700">
                R.Luminuous
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
            <a href="#home" className="text-emerald-700">
              Home
            </a>
            <a href="#benefits">Benefits</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#blog">Blog</a>
            <a href="#contact">Contact</a>
            <Link to="/pricing">Pricing</Link>
            <div className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-medium"
              >
                More
                <ChevronDown className="h-4 w-4" />
              </button>
              <div className="invisible absolute right-0 top-8 w-48 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-md transition group-hover:visible group-hover:opacity-100">
                <Link
                  to="/login"
                  className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Restaurant Admin
                </Link>
                <Link
                  to="/login"
                  className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Super Admin
                </Link>
              </div>
            </div>
          </nav>

          <Link
            to="/login"
            className="hidden items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 lg:inline-flex"
          >
            Login
          </Link>

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
              <a href="#home" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 hover:bg-slate-100">Home</a>
              <a href="#benefits" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 hover:bg-slate-100">Benefits</a>
              <a href="#features" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 hover:bg-slate-100">Features</a>
              <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 hover:bg-slate-100">How it works</a>
              <a href="#blog" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 hover:bg-slate-100">Blog</a>
              <a href="#contact" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 hover:bg-slate-100">Contact</a>
              <Link to="/pricing" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 hover:bg-slate-100">Pricing</Link>

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
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-slate-100">Restaurant Admin</Link>
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-slate-100">Super Admin</Link>
                </div>
              )}

              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Login
              </Link>
            </div>
          </div>
        )}
      </header>

      <section id="home" className="border-b border-slate-200">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <Sparkles className="h-4 w-4" />
              QR-Powered Restaurant & Hotel Solution
            </span>

            <h1 className="mt-6 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
              <span className="block text-emerald-700">R.Luminuous</span>
              <br />
              All-in-one QR Ordering & Hospitality Management
            </h1>

            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Manage menus, orders, staff flow, and guest experience from one
              clean platform designed for modern hospitality teams.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-yellow-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-yellow-300"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#contact"
                className="inline-flex items-center justify-center rounded-full border border-emerald-600 bg-white px-6 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Request a Demo
              </a>
            </div>
          </div>

          <div className="order-last rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:order-none">
            <div className="relative overflow-hidden rounded-2xl bg-emerald-900 p-4">
              <img
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"
                alt="Restaurant operations powered by R.Luminuous"
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

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-center"
            >
              <p className="text-3xl font-extrabold text-emerald-700">{stat.value}</p>
              <p className="mt-2 text-sm font-medium text-slate-600">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="benefits" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold">Why teams choose R.Luminuous</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {benefitCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <h3 className="text-lg font-bold">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-extrabold">Built for daily operations</h2>
          <p className="mt-3 text-slate-600">
            Everything your restaurant or hotel team needs to run faster with
            fewer manual steps.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <Icon className="h-7 w-7 text-emerald-700" />
                <h3 className="mt-4 text-lg font-bold">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {card.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold">How it works</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <p className="text-sm font-medium text-slate-700">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="blog" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-extrabold">Latest from our blog</h2>
          <p className="mt-3 text-slate-600">
            Practical hospitality insights you can apply this week.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {blogs.map((blog) => (
            <article
              key={blog.title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <h3 className="text-lg font-bold text-slate-900">{blog.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{blog.excerpt}</p>
              <a href="#" className="mt-4 inline-flex text-sm font-semibold text-emerald-700">
                Read more
              </a>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-900 p-8 text-white sm:p-10">
          <h2 className="text-3xl font-extrabold">Ready to launch with R.Luminuous?</h2>
          <p className="mt-3 max-w-2xl text-slate-300">
            Start with a free trial or contact our team for onboarding support
            and custom setup.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-400"
            >
              View Pricing <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-full border border-slate-500 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Restaurant Login
            </Link>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Support available for onboarding and migration.
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div>
            <p className="text-lg font-bold text-emerald-700">R.Luminuous</p>
            <p className="mt-3 text-sm text-slate-600">
              QR-powered hospitality platform for restaurants and hotels.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
              Product
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><a href="#features">Features</a></li>
              <li><a href="#how-it-works">How it works</a></li>
              <li><Link to="/pricing">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
              Company
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><a href="#">About</a></li>
              <li><a href="#blog">Blog</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
              Contact
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>info@rluminuous.com</li>
              <li>+94 77 754 7239</li>
              <li>Sri Lanka</li>
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
}