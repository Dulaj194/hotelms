export type SiteFeatureIconKey =
  | "bar_chart"
  | "chef_hat"
  | "qr_code"
  | "shield_check";

export interface SiteStat {
  value: string;
  label: string;
}

export interface SiteAudience {
  title: string;
  message: string;
}

export interface SiteBenefit {
  title: string;
  pain: string;
  outcome: string;
}

export interface SiteFeature {
  capability: string;
  explanation: string;
  visual_hint: string;
  icon_key: SiteFeatureIconKey;
}

export interface SiteUseCase {
  title: string;
  details: string;
}

export interface SiteMockup {
  title: string;
  image_url: string;
}

export interface SiteTestimonial {
  quote: string;
  author: string;
  role: string;
}

export interface SiteCta {
  title: string;
  message: string;
  action_label: string;
  action_to: string;
}

export interface SiteFooter {
  trust_info: string;
  contact_points: string[];
}

export interface LandingPageContent {
  hero_badge: string;
  product_name: string;
  hero_title: string;
  hero_description: string;
  primary_cta_label: string;
  primary_cta_to: string;
  secondary_cta_label: string;
  secondary_cta_to: string;
  hero_image_url: string;
  stats: SiteStat[];
  audiences: SiteAudience[];
  benefits: SiteBenefit[];
  features: SiteFeature[];
  steps: string[];
  use_cases: SiteUseCase[];
  mockups: SiteMockup[];
  testimonial: SiteTestimonial;
  cta: SiteCta;
  trust_message: string;
  footer: SiteFooter;
}

export interface SiteValue {
  title: string;
  description: string;
}

export interface AboutPageContent {
  hero_eyebrow: string;
  hero_title: string;
  hero_description: string;
  overview_title: string;
  overview_paragraphs: string[];
  values: SiteValue[];
  milestones: string[];
  capabilities: SiteUseCase[];
  cta: SiteCta;
}

export interface ContactChannel {
  label: string;
  value: string;
  detail: string;
}

export interface ContactFaq {
  question: string;
  answer: string;
}

export interface ContactPageContent {
  hero_eyebrow: string;
  hero_title: string;
  hero_description: string;
  channels: ContactChannel[];
  response_commitments: string[];
  faq: ContactFaq[];
  sidebar_points: string[];
  success_title: string;
  success_message: string;
}

export interface BlogPostSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  cover_image_url: string | null;
  tags: string[];
  reading_minutes: number;
  is_featured: boolean;
  published_at: string;
}

export interface BlogListResponse {
  page_title: string;
  page_description: string;
  categories: string[];
  featured_post: BlogPostSummary | null;
  items: BlogPostSummary[];
}

export interface BlogPostDetail extends BlogPostSummary {
  body: string[];
  key_takeaways: string[];
  related_posts: BlogPostSummary[];
}

export interface ContactLeadCreateRequest {
  full_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  property_type?: string;
  subject?: string;
  message: string;
  source_page?: string;
}

export interface ContactLeadCreateResponse {
  id: number;
  message: string;
}
