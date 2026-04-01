from __future__ import annotations

import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.site_content import repository
from app.modules.site_content.defaults import DEFAULT_BLOG_POSTS, DEFAULT_SITE_PAGES
from app.modules.site_content.model import SiteBlogPost, SitePage
from app.modules.site_content.schemas import (
    AboutPageResponse,
    BlogCategoryListResponse,
    BlogListResponse,
    BlogPostDetailResponse,
    BlogPostSummaryResponse,
    ContactLeadCreateRequest,
    ContactLeadCreateResponse,
    ContactPageResponse,
    LandingPageResponse,
)


def ensure_seeded(db: Session) -> None:
    existing_pages = repository.list_page_slugs(db)
    page_records = [
        {
            "slug": slug,
            "title": config["title"],
            "summary": config.get("summary"),
            "payload": config["payload"],
            "is_published": True,
        }
        for slug, config in DEFAULT_SITE_PAGES.items()
        if slug not in existing_pages
    ]

    existing_posts = repository.list_blog_slugs(db)
    blog_records = [post for post in DEFAULT_BLOG_POSTS if post["slug"] not in existing_posts]

    if not page_records and not blog_records:
        return

    repository.create_pages(db, page_records)
    repository.create_blog_posts(db, blog_records)
    db.commit()


def _load_page_payload(page: SitePage, schema_type):
    return schema_type.model_validate(json.loads(page.payload_json))


def _to_blog_summary(post: SiteBlogPost) -> BlogPostSummaryResponse:
    return BlogPostSummaryResponse(
        slug=post.slug,
        title=post.title,
        excerpt=post.excerpt,
        category=post.category,
        cover_image_url=post.cover_image_url,
        tags=json.loads(post.tags_json) if post.tags_json else [],
        reading_minutes=post.reading_minutes,
        is_featured=post.is_featured,
        published_at=post.published_at,
    )


def _require_page(db: Session, slug: str, schema_type):
    ensure_seeded(db)
    page = repository.get_page_by_slug(db, slug)
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site page not found.",
        )
    return _load_page_payload(page, schema_type)


def get_landing_page(db: Session) -> LandingPageResponse:
    return _require_page(db, "landing", LandingPageResponse)


def get_about_page(db: Session) -> AboutPageResponse:
    return _require_page(db, "about", AboutPageResponse)


def get_contact_page(db: Session) -> ContactPageResponse:
    return _require_page(db, "contact", ContactPageResponse)


def list_blogs(
    db: Session,
    *,
    search: str | None = None,
    category: str | None = None,
) -> BlogListResponse:
    ensure_seeded(db)
    posts = repository.list_blog_posts(db, search=search, category=category)
    summaries = [_to_blog_summary(post) for post in posts]
    featured = next((post for post in summaries if post.is_featured), None)
    return BlogListResponse(
        page_title="Hospitality Insights and Practical Guides",
        page_description=(
            "Operational ideas for restaurant floors, room service teams, and finance workflows."
        ),
        categories=repository.list_blog_categories(db),
        featured_post=featured,
        items=summaries,
    )


def list_blog_categories(db: Session) -> BlogCategoryListResponse:
    ensure_seeded(db)
    return BlogCategoryListResponse(items=repository.list_blog_categories(db))


def list_recent_blogs(db: Session, limit: int = 3) -> list[BlogPostSummaryResponse]:
    ensure_seeded(db)
    posts = repository.list_blog_posts(db, limit=limit)
    return [_to_blog_summary(post) for post in posts]


def get_blog_post(db: Session, slug: str) -> BlogPostDetailResponse:
    ensure_seeded(db)
    post = repository.get_blog_post_by_slug(db, slug)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found.",
        )

    body = json.loads(post.body_json) if post.body_json else {}
    related = [
        _to_blog_summary(item)
        for item in repository.list_blog_posts(db, category=post.category, limit=4)
        if item.slug != post.slug
    ][:3]
    return BlogPostDetailResponse(
        **_to_blog_summary(post).model_dump(),
        body=body.get("body", []),
        key_takeaways=body.get("key_takeaways", []),
        related_posts=related,
    )


def submit_contact_lead(
    db: Session,
    payload: ContactLeadCreateRequest,
) -> ContactLeadCreateResponse:
    lead = repository.create_contact_lead(db, payload.model_dump())
    page = get_contact_page(db)
    return ContactLeadCreateResponse(
        id=lead.id,
        message=page.success_message,
    )
