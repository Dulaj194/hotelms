from __future__ import annotations

from typing import Any
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.modules.site_content.model import ContactLeadStatus


class SiteStatResponse(BaseModel):
    value: str
    label: str


class SiteAudienceResponse(BaseModel):
    title: str
    message: str


class SiteBenefitResponse(BaseModel):
    title: str
    pain: str
    outcome: str


class SiteFeatureResponse(BaseModel):
    capability: str
    explanation: str
    visual_hint: str
    icon_key: str


class SiteUseCaseResponse(BaseModel):
    title: str
    details: str


class SiteMockupResponse(BaseModel):
    title: str
    image_url: str


class SiteTestimonialResponse(BaseModel):
    quote: str
    author: str
    role: str


class SiteCtaResponse(BaseModel):
    title: str
    message: str
    action_label: str
    action_to: str


class SiteFooterResponse(BaseModel):
    trust_info: str
    contact_points: list[str]


class LandingPageResponse(BaseModel):
    hero_badge: str
    product_name: str
    hero_title: str
    hero_description: str
    primary_cta_label: str
    primary_cta_to: str
    secondary_cta_label: str
    secondary_cta_to: str
    hero_image_url: str
    stats: list[SiteStatResponse]
    audiences: list[SiteAudienceResponse]
    benefits: list[SiteBenefitResponse]
    features: list[SiteFeatureResponse]
    steps: list[str]
    use_cases: list[SiteUseCaseResponse]
    mockups: list[SiteMockupResponse]
    testimonial: SiteTestimonialResponse
    cta: SiteCtaResponse
    trust_message: str
    footer: SiteFooterResponse


class SiteValueResponse(BaseModel):
    title: str
    description: str


class AboutPageResponse(BaseModel):
    hero_eyebrow: str
    hero_title: str
    hero_description: str
    overview_title: str
    overview_paragraphs: list[str]
    values: list[SiteValueResponse]
    milestones: list[str]
    capabilities: list[SiteUseCaseResponse]
    cta: SiteCtaResponse


class ContactChannelResponse(BaseModel):
    label: str
    value: str
    detail: str


class ContactFaqResponse(BaseModel):
    question: str
    answer: str


class ContactPageResponse(BaseModel):
    hero_eyebrow: str
    hero_title: str
    hero_description: str
    channels: list[ContactChannelResponse]
    response_commitments: list[str]
    faq: list[ContactFaqResponse]
    sidebar_points: list[str]
    success_title: str
    success_message: str


class BlogPostSummaryResponse(BaseModel):
    slug: str
    title: str
    excerpt: str
    category: str
    cover_image_url: str | None
    tags: list[str]
    reading_minutes: int
    is_featured: bool
    published_at: datetime


class BlogPostDetailResponse(BlogPostSummaryResponse):
    body: list[str]
    key_takeaways: list[str]
    related_posts: list[BlogPostSummaryResponse]


class BlogCategoryListResponse(BaseModel):
    items: list[str]


class BlogListResponse(BaseModel):
    page_title: str
    page_description: str
    categories: list[str]
    featured_post: BlogPostSummaryResponse | None
    items: list[BlogPostSummaryResponse]


class ContactLeadCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=120)
    email: EmailStr
    phone: str | None = Field(None, max_length=50)
    company_name: str | None = Field(None, max_length=150)
    property_type: str | None = Field(None, max_length=80)
    subject: str | None = Field(None, max_length=150)
    message: str = Field(..., min_length=20, max_length=5000)
    source_page: str = Field(default="contact", max_length=50)
    source_path: str | None = Field(default=None, max_length=255)
    entry_point: str | None = Field(default=None, max_length=120)
    login_intent: str | None = Field(default=None, max_length=80)
    referrer_url: str | None = Field(default=None, max_length=500)
    utm_source: str | None = Field(default=None, max_length=120)
    utm_medium: str | None = Field(default=None, max_length=120)
    utm_campaign: str | None = Field(default=None, max_length=150)
    utm_term: str | None = Field(default=None, max_length=150)
    utm_content: str | None = Field(default=None, max_length=150)


class ContactLeadCreateResponse(BaseModel):
    id: int
    message: str


class SiteContentAdminUserResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    scopes: list[str] = Field(default_factory=list)


class SiteContentAdminUserListResponse(BaseModel):
    items: list[SiteContentAdminUserResponse]
    total: int


class AdminSitePageSummaryResponse(BaseModel):
    slug: str
    title: str
    summary: str | None
    is_published: bool
    last_published_at: datetime | None
    updated_at: datetime
    updated_by: SiteContentAdminUserResponse | None = None
    published_by: SiteContentAdminUserResponse | None = None


class AdminSitePageDetailResponse(AdminSitePageSummaryResponse):
    payload: dict[str, Any]
    published_payload: dict[str, Any] | None = None


class AdminSitePageListResponse(BaseModel):
    items: list[AdminSitePageSummaryResponse]
    total: int


class AdminSitePageUpdateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    summary: str | None = Field(default=None, max_length=500)
    payload: dict[str, Any]


class AdminBlogPostSummaryResponse(BaseModel):
    slug: str
    title: str
    excerpt: str
    category: str
    cover_image_url: str | None
    tags: list[str]
    reading_minutes: int
    is_featured: bool
    is_published: bool
    scheduled_publish_at: datetime
    live_published_at: datetime | None
    last_published_at: datetime | None
    updated_at: datetime
    updated_by: SiteContentAdminUserResponse | None = None
    published_by: SiteContentAdminUserResponse | None = None


class AdminBlogPostDetailResponse(AdminBlogPostSummaryResponse):
    body: list[str]
    key_takeaways: list[str]


class AdminBlogPostListResponse(BaseModel):
    items: list[AdminBlogPostSummaryResponse]
    total: int


class AdminBlogPostUpsertRequest(BaseModel):
    slug: str = Field(..., min_length=3, max_length=120)
    title: str = Field(..., min_length=3, max_length=255)
    excerpt: str = Field(..., min_length=20, max_length=5000)
    category: str = Field(..., min_length=2, max_length=80)
    cover_image_url: str | None = Field(default=None, max_length=500)
    tags: list[str] = Field(default_factory=list)
    body: list[str] = Field(..., min_length=1)
    key_takeaways: list[str] = Field(default_factory=list)
    reading_minutes: int = Field(default=4, ge=1, le=60)
    is_featured: bool = False
    scheduled_publish_at: datetime | None = None


class SiteContentActionResponse(BaseModel):
    message: str


class AdminContactLeadSummaryResponse(BaseModel):
    new_count: int
    reviewed_count: int
    qualified_count: int
    closed_count: int
    unassigned_count: int


class AdminContactLeadResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None
    company_name: str | None
    property_type: str | None
    subject: str | None
    message: str
    source_page: str | None
    source_path: str | None
    entry_point: str | None
    login_intent: str | None
    referrer_url: str | None
    utm_source: str | None
    utm_medium: str | None
    utm_campaign: str | None
    utm_term: str | None
    utm_content: str | None
    status: ContactLeadStatus
    internal_notes: str | None
    assigned_to: SiteContentAdminUserResponse | None = None
    created_at: datetime
    updated_at: datetime


class AdminContactLeadListResponse(BaseModel):
    items: list[AdminContactLeadResponse]
    total: int
    summary: AdminContactLeadSummaryResponse


class AdminContactLeadUpdateRequest(BaseModel):
    status: ContactLeadStatus | None = None
    assigned_to_user_id: int | None = None
    internal_notes: str | None = Field(default=None, max_length=5000)
