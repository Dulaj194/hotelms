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
  source_path?: string;
  entry_point?: string;
  login_intent?: string;
  referrer_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export interface ContactLeadCreateResponse {
  id: number;
  message: string;
}

export type SitePageSlug = "landing" | "about" | "contact";
export type ContactLeadStatus = "new" | "reviewed" | "qualified" | "closed";

export interface SiteContentAdminUser {
  user_id: number;
  full_name: string;
  email: string;
  scopes: string[];
}

export interface SiteContentAdminUserListResponse {
  items: SiteContentAdminUser[];
  total: number;
}

export interface AdminSitePageSummary {
  slug: SitePageSlug;
  title: string;
  summary: string | null;
  is_published: boolean;
  last_published_at: string | null;
  updated_at: string;
  updated_by: SiteContentAdminUser | null;
  published_by: SiteContentAdminUser | null;
}

export interface AdminSitePageDetail extends AdminSitePageSummary {
  payload: Record<string, unknown>;
  published_payload: Record<string, unknown> | null;
}

export interface AdminSitePageListResponse {
  items: AdminSitePageSummary[];
  total: number;
}

export interface AdminSitePageUpdateRequest {
  title: string;
  summary?: string | null;
  payload: Record<string, unknown>;
}

export interface AdminBlogPostSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  cover_image_url: string | null;
  tags: string[];
  reading_minutes: number;
  is_featured: boolean;
  is_published: boolean;
  scheduled_publish_at: string;
  live_published_at: string | null;
  last_published_at: string | null;
  updated_at: string;
  updated_by: SiteContentAdminUser | null;
  published_by: SiteContentAdminUser | null;
}

export interface AdminBlogPostDetail extends AdminBlogPostSummary {
  body: string[];
  key_takeaways: string[];
}

export interface AdminBlogPostListResponse {
  items: AdminBlogPostSummary[];
  total: number;
}

export interface AdminBlogPostUpsertRequest {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  cover_image_url?: string | null;
  tags: string[];
  body: string[];
  key_takeaways: string[];
  reading_minutes: number;
  is_featured: boolean;
  scheduled_publish_at?: string | null;
}

export interface AdminContactLeadSummary {
  new_count: number;
  reviewed_count: number;
  qualified_count: number;
  closed_count: number;
  unassigned_count: number;
}

export interface AdminContactLead {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  property_type: string | null;
  subject: string | null;
  message: string;
  source_page: string | null;
  source_path: string | null;
  entry_point: string | null;
  login_intent: string | null;
  referrer_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  status: ContactLeadStatus;
  internal_notes: string | null;
  assigned_to: SiteContentAdminUser | null;
  created_at: string;
  updated_at: string;
}

export interface AdminContactLeadListResponse {
  items: AdminContactLead[];
  total: number;
  summary: AdminContactLeadSummary;
}

export interface AdminContactLeadUpdateRequest {
  status?: ContactLeadStatus;
  assigned_to_user_id?: number | null;
  internal_notes?: string | null;
}

export interface SiteContentActionResponse {
  message: string;
}
