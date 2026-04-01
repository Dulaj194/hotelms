from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


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


class ContactLeadCreateResponse(BaseModel):
    id: int
    message: str
