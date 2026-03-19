import {
  BarChart3,
  ChefHat,
  QrCode,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type Stat = { value: string; label: string };

export type BenefitCardData = {
  title: string;
  pain: string;
  outcome: string;
};

export type FeatureCardData = {
  capability: string;
  explanation: string;
  visualHint: string;
  icon: LucideIcon;
};

export type BlogCardData = {
  title: string;
  excerpt: string;
};

export type MockupData = {
  title: string;
  imageUrl: string;
};

export const heroContent = {
  productName: "R.Luminuous",
  whatItDoes: "All-in-one QR Ordering & Hospitality Management",
  whoItHelps: "Built for restaurants, cafés, and hotels",
  whyItMatters:
    "Reduce service delays, improve team coordination, and deliver faster guest experiences.",
};

export const stats: Stat[] = [
  { value: "500+", label: "Restaurants" },
  { value: "1M+", label: "Orders" },
  { value: "99.9%", label: "Uptime" },
];

export const benefitCards: BenefitCardData[] = [
  {
    title: "Short-staffed shifts",
    pain: "Teams lose time taking manual orders and moving between tables.",
    outcome:
      "QR ordering reduces repetitive tasks so staff can focus on food quality and guest care.",
  },
  {
    title: "Slow table turnover",
    pain: "Guests wait too long for menus, confirmations, and bill handling.",
    outcome:
      "Guests order faster from their phones, helping you serve more tables per shift.",
  },
  {
    title: "No clear visibility",
    pain: "Managers struggle to see what items sell best and when demand peaks.",
    outcome:
      "Live analytics highlight top items and peak windows for smarter decisions.",
  },
  {
    title: "Customer friction",
    pain: "App downloads and complicated flows reduce ordering completion.",
    outcome:
      "A quick QR scan opens the menu instantly in browser with no install needed.",
  },
];

export const features: FeatureCardData[] = [
  {
    capability: "QR Ordering",
    explanation:
      "Guests scan and order instantly without app downloads or paper menus.",
    icon: QrCode,
    visualHint: "Scan → Browse → Order",
  },
  {
    capability: "Kitchen Workflow",
    explanation:
      "Orders route to kitchen dashboards in real time with clear status updates.",
    icon: ChefHat,
    visualHint: "Order queue with live status",
  },
  {
    capability: "Sales Insights",
    explanation:
      "Track top items, peak hours, and performance with live analytics.",
    icon: BarChart3,
    visualHint: "Daily/weekly trend snapshots",
  },
  {
    capability: "Secure Platform",
    explanation:
      "Role-based access and stable infrastructure for daily operations.",
    icon: ShieldCheck,
    visualHint: "Role-based access controls",
  },
];

export const steps: string[] = [
  "Guest scans table or room QR",
  "Menu opens and order is placed",
  "Staff confirms and kitchen starts",
  "Kitchen receives order instantly",
  "Status updates are shared live",
  "Order delivered with faster turnaround",
];

export const blogs: BlogCardData[] = [
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

export const mockups: MockupData[] = [
  {
    title: "Menu on phone",
    imageUrl:
      "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Kitchen dashboard",
    imageUrl:
      "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Staff workflow",
    imageUrl:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Room ordering",
    imageUrl:
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Analytics dashboard",
    imageUrl:
      "https://images.unsplash.com/photo-1551281044-8b9a4e7f4f7c?auto=format&fit=crop&w=900&q=80",
  },
];

export const ctaContent = {
  title: "Start your free trial with R.Luminuous",
  message:
    "No setup friction. Launch your QR menu flow quickly and onboard your team in days.",
  actionLabel: "Start Free Trial",
  actionTo: "/pricing",
};

export const footerContent = {
  trustInfo:
    "Trusted by hospitality teams with stable uptime, secure access, and operational support.",
  contactPoints: ["info@rluminuous.com", "+94 77 754 7239", "Sri Lanka"],
};