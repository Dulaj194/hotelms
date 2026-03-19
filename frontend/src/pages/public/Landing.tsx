import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChefHat,
  QrCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

const featureCards = [
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
  "Status updates until served",
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
              A
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-emerald-700">
                R.Luminuous
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#home" className="text-emerald-700">
              Home
            </a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#contact">Contact</a>
            <Link to="/pricing">Pricing</Link>
          </nav>

          <Link
            to="/login"
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Login
          </Link>
        </div>
      </header>

      <section id="home" className="border-b border-slate-200">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <Sparkles className="h-4 w-4" />
              QR-Powered Restaurant & Hotel Solution
            </span>

            <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl">
              <span className="text-emerald-700">R.Luminuous</span>
              <br />
              All-in-one QR Ordering & Hospitality Management
            </h1>

            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Manage menus, orders, staff flow, and guest experience from one
              clean platform designed for modern hospitality teams.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-yellow-300"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#contact"
                className="inline-flex items-center rounded-full border border-emerald-600 bg-white px-6 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Request a Demo
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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

      <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-extrabold">Built for daily operations</h2>
          <p className="mt-3 text-slate-600">
            Everything your restaurant or hotel team needs to run faster with
            fewer manual steps.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((card) => {
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
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
    </main>
  );
}