from __future__ import annotations

import json
from collections.abc import Iterable

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.modules.site_content.model import ContactLead, SiteBlogPost, SitePage


def list_page_slugs(db: Session) -> set[str]:
    return {slug for (slug,) in db.query(SitePage.slug).all()}


def list_blog_slugs(db: Session) -> set[str]:
    return {slug for (slug,) in db.query(SiteBlogPost.slug).all()}


def create_pages(db: Session, pages: Iterable[dict]) -> None:
    records = [
        SitePage(
            slug=page["slug"],
            title=page["title"],
            summary=page.get("summary"),
            payload_json=json.dumps(page["payload"], ensure_ascii=True),
            is_published=page.get("is_published", True),
        )
        for page in pages
    ]
    if records:
        db.add_all(records)


def create_blog_posts(db: Session, posts: Iterable[dict]) -> None:
    records = [
        SiteBlogPost(
            slug=post["slug"],
            title=post["title"],
            excerpt=post["excerpt"],
            category=post["category"],
            cover_image_url=post.get("cover_image_url"),
            tags_json=json.dumps(post.get("tags", []), ensure_ascii=True),
            body_json=json.dumps(
                {
                    "body": post.get("body", []),
                    "key_takeaways": post.get("key_takeaways", []),
                },
                ensure_ascii=True,
            ),
            reading_minutes=post.get("reading_minutes", 4),
            is_published=post.get("is_published", True),
            is_featured=post.get("is_featured", False),
            published_at=post["published_at"],
        )
        for post in posts
    ]
    if records:
        db.add_all(records)


def get_page_by_slug(db: Session, slug: str) -> SitePage | None:
    return (
        db.query(SitePage)
        .filter(SitePage.slug == slug, SitePage.is_published.is_(True))
        .first()
    )


def list_blog_posts(
    db: Session,
    *,
    search: str | None = None,
    category: str | None = None,
    limit: int | None = None,
) -> list[SiteBlogPost]:
    query = db.query(SiteBlogPost).filter(SiteBlogPost.is_published.is_(True))

    if category:
        query = query.filter(func.lower(SiteBlogPost.category) == category.strip().lower())

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                SiteBlogPost.title.ilike(like),
                SiteBlogPost.excerpt.ilike(like),
                SiteBlogPost.body_json.ilike(like),
            )
        )

    query = query.order_by(
        SiteBlogPost.is_featured.desc(),
        SiteBlogPost.published_at.desc(),
        SiteBlogPost.id.desc(),
    )
    if limit is not None:
        query = query.limit(limit)
    return query.all()


def list_blog_categories(db: Session) -> list[str]:
    rows = (
        db.query(SiteBlogPost.category)
        .filter(SiteBlogPost.is_published.is_(True))
        .distinct()
        .order_by(SiteBlogPost.category.asc())
        .all()
    )
    return [category for (category,) in rows]


def get_blog_post_by_slug(db: Session, slug: str) -> SiteBlogPost | None:
    return (
        db.query(SiteBlogPost)
        .filter(SiteBlogPost.slug == slug, SiteBlogPost.is_published.is_(True))
        .first()
    )


def create_contact_lead(db: Session, payload: dict) -> ContactLead:
    lead = ContactLead(**payload)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead
