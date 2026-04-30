import type { BlogPostSummary, LandingPageContent } from "@/types/siteContent";

export const landingFallbackContent: LandingPageContent = {
  hero_badge: "QR-Powered Restaurant and Hotel Solution",
  product_name: "R.LUMINUOUS",
  hero_title: "All-in-one QR Ordering and Hospitality Management",
  hero_description:
    "Built for hotel and restaurant teams that need faster service, stronger visibility, and a smoother guest journey from scan to settlement.",
  primary_cta_label: "Start Free Trial",
  primary_cta_to: "/register",
  secondary_cta_label: "Request a Demo",
  secondary_cta_to: "/contact",
  hero_image_url:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  stats: [
    { value: "500+", label: "Restaurants" },
    { value: "120+", label: "Hotels" },
    { value: "1M+", label: "Orders" },
    { value: "99.9%", label: "Platform uptime" },
  ],
  audiences: [
    {
      title: "Hotel Owners",
      message: "Manage room ordering and service requests with better visibility across operations.",
    },
    {
      title: "Restaurant Owners",
      message: "Increase table turnover and reduce manual ordering workload during peak hours.",
    },
    {
      title: "Managers",
      message: "Track kitchen flow, sales performance, and staff coordination in real time.",
    },
    {
      title: "Operations Admins",
      message: "Keep menus, pricing, and daily workflows consistent across teams and shifts.",
    },
  ],
  benefits: [
    {
      title: "Short-staffed shifts",
      pain: "Teams lose time taking manual orders and moving between tables.",
      outcome: "QR ordering reduces repetitive tasks so staff can focus on food quality and guest care.",
    },
    {
      title: "Slow table turnover",
      pain: "Guests wait too long for menus, confirmations, and bill handling.",
      outcome: "Guests order faster from their phones, helping you serve more tables per shift.",
    },
    {
      title: "No clear visibility",
      pain: "Managers struggle to see what items sell best and when demand peaks.",
      outcome: "Live analytics highlight top items and peak windows for smarter decisions.",
    },
    {
      title: "Customer friction",
      pain: "App downloads and complicated flows reduce ordering completion.",
      outcome: "A quick QR scan opens the menu instantly in browser with no install needed.",
    },
  ],
  features: [
    {
      capability: "QR Ordering",
      explanation: "Guests scan and order instantly without app downloads or paper menus.",
      icon_key: "qr_code",
      visual_hint: "Scan to browse to order",
    },
    {
      capability: "Kitchen Workflow",
      explanation: "Orders route to kitchen dashboards in real time with clear status updates.",
      icon_key: "chef_hat",
      visual_hint: "Order queue with live status",
    },
    {
      capability: "Sales Insights",
      explanation: "Track top items, peak hours, and performance with live analytics.",
      icon_key: "bar_chart",
      visual_hint: "Daily and weekly trend snapshots",
    },
    {
      capability: "Secure Platform",
      explanation: "Role-based access and stable infrastructure for daily operations.",
      icon_key: "shield_check",
      visual_hint: "Role-based access controls",
    },
  ],
  steps: [
    "Guest scans table or room QR",
    "Menu opens and order is placed",
    "Staff confirms and kitchen starts",
    "Kitchen receives order instantly",
    "Status updates are shared live",
    "Order delivered with faster turnaround",
  ],
  use_cases: [
    {
      title: "Table QR Ordering",
      details: "Guests scan and place orders instantly without waiting for printed menus.",
    },
    {
      title: "Room Service Requests",
      details: "Hotel guests request food or housekeeping directly from room QR flows.",
    },
    {
      title: "Kitchen Coordination",
      details: "Confirmed orders move to kitchen dashboards with clear preparation status.",
    },
    {
      title: "Revenue Analytics",
      details: "Managers view sales trends and high-margin items for faster business decisions.",
    },
  ],
  testimonial: {
    quote:
      "R.LUMINUOUS helped us cut ordering delays and improve coordination between floor and kitchen teams in just two weeks.",
    author: "Nadeesha Perera",
    role: "Operations Manager, Coastal Bay Hotel and Bistro",
  },
  mockups: [
    {
      title: "Menu on phone",
      image_url:
        "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Kitchen dashboard",
      image_url:
        "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Staff workflow",
      image_url:
        "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Room ordering",
      image_url:
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "Analytics dashboard",
      image_url:
        "https://images.unsplash.com/photo-1551281044-8b9a4e7f4f7c?auto=format&fit=crop&w=900&q=80",
    },
  ],
  cta: {
    title: "Start your free trial with R.LUMINUOUS",
    message: "No setup friction. Launch your QR menu flow quickly and onboard your team in days.",
    action_label: "Start Free Trial",
    action_to: "/pricing",
  },
  trust_message:
    "Trusted by hospitality teams with stable uptime, secure access, and operational support.",
  footer: {
    trust_info:
      "Trusted by hospitality teams with stable uptime, secure access, and operational support.",
    contact_points: ["info@rluminuous.com", "+94 77 754 7239", "Sri Lanka"],
  },
};

export const landingFallbackBlogs: BlogPostSummary[] = [
  {
    slug: "how-qr-ordering-improves-table-turnover",
    title: "How QR Ordering Improves Table Turnover",
    excerpt: "Learn practical ways digital menus reduce waiting time and improve guest flow.",
    category: "Operations",
    cover_image_url: null,
    tags: ["QR ordering", "turnover"],
    reading_minutes: 4,
    is_featured: true,
    published_at: "2026-03-30T09:00:00Z",
  },
  {
    slug: "five-hospitality-metrics-worth-reviewing-every-week",
    title: "5 Hospitality Metrics You Should Track Weekly",
    excerpt: "Track actionable KPIs from order value to kitchen speed using your dashboard.",
    category: "Revenue",
    cover_image_url: null,
    tags: ["analytics", "management"],
    reading_minutes: 4,
    is_featured: false,
    published_at: "2026-03-27T09:00:00Z",
  },
  {
    slug: "room-service-workflows-that-guests-actually-use",
    title: "Launching Contactless Service in 7 Days",
    excerpt: "A simple rollout plan for restaurants and hotels moving to QR-based workflows.",
    category: "Room Service",
    cover_image_url: null,
    tags: ["hotel", "guest experience"],
    reading_minutes: 5,
    is_featured: false,
    published_at: "2026-03-24T09:00:00Z",
  },
];
