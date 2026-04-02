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
            published_payload_json=(
                json.dumps(page["payload"], ensure_ascii=True)
                if page.get("is_published", True)
                else None
            ),
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
            published_title=post["title"] if post.get("is_published", True) else None,
            published_excerpt=post["excerpt"] if post.get("is_published", True) else None,
            published_category=post["category"] if post.get("is_published", True) else None,
            published_cover_image_url=(
                post.get("cover_image_url") if post.get("is_published", True) else None
            ),
            published_tags_json=(
                json.dumps(post.get("tags", []), ensure_ascii=True)
                if post.get("is_published", True)
                else None
            ),
            published_body_json=(
                json.dumps(
                    {
                        "body": post.get("body", []),
                        "key_takeaways": post.get("key_takeaways", []),
                    },
                    ensure_ascii=True,
                )
                if post.get("is_published", True)
                else None
            ),
            published_reading_minutes=(
                post.get("reading_minutes", 4) if post.get("is_published", True) else None
            ),
            published_is_featured=(
                post.get("is_featured", False) if post.get("is_published", True) else False
            ),
            is_published=post.get("is_published", True),
            is_featured=post.get("is_featured", False),
            published_at=post["published_at"],
            published_content_at=(
                post["published_at"] if post.get("is_published", True) else None
            ),
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


def get_page_by_slug_admin(db: Session, slug: str) -> SitePage | None:
    return db.query(SitePage).filter(SitePage.slug == slug).first()


def list_site_pages(db: Session) -> list[SitePage]:
    return db.query(SitePage).order_by(SitePage.slug.asc()).all()


def list_blog_posts(
    db: Session,
    *,
    search: str | None = None,
    category: str | None = None,
    limit: int | None = None,
) -> list[SiteBlogPost]:
    query = db.query(SiteBlogPost).filter(SiteBlogPost.is_published.is_(True))

    if category:
        query = query.filter(
            func.lower(
                func.coalesce(SiteBlogPost.published_category, SiteBlogPost.category)
            )
            == category.strip().lower()
        )

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                func.coalesce(SiteBlogPost.published_title, SiteBlogPost.title).ilike(like),
                func.coalesce(SiteBlogPost.published_excerpt, SiteBlogPost.excerpt).ilike(like),
                func.coalesce(
                    SiteBlogPost.published_body_json,
                    SiteBlogPost.body_json,
                ).ilike(like),
            )
        )

    query = query.order_by(
        SiteBlogPost.published_is_featured.desc(),
        func.coalesce(
            SiteBlogPost.published_content_at,
            SiteBlogPost.last_published_at,
            SiteBlogPost.published_at,
        ).desc(),
        SiteBlogPost.id.desc(),
    )
    if limit is not None:
        query = query.limit(limit)
    return query.all()


def list_blog_posts_admin(
    db: Session,
    *,
    search: str | None = None,
    category: str | None = None,
    is_published: bool | None = None,
    limit: int | None = None,
    offset: int | None = None,
) -> tuple[list[SiteBlogPost], int]:
    query = db.query(SiteBlogPost)

    if is_published is not None:
        query = query.filter(SiteBlogPost.is_published.is_(is_published))

    if category:
        query = query.filter(func.lower(SiteBlogPost.category) == category.strip().lower())

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                SiteBlogPost.title.ilike(like),
                SiteBlogPost.excerpt.ilike(like),
                SiteBlogPost.category.ilike(like),
                SiteBlogPost.body_json.ilike(like),
            )
        )

    total = query.count()
    query = query.order_by(
        SiteBlogPost.is_published.desc(),
        SiteBlogPost.last_published_at.desc(),
        SiteBlogPost.updated_at.desc(),
        SiteBlogPost.id.desc(),
    )
    if offset:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)
    return query.all(), total


def list_blog_categories(db: Session) -> list[str]:
    rows = (
        db.query(func.coalesce(SiteBlogPost.published_category, SiteBlogPost.category))
        .filter(SiteBlogPost.is_published.is_(True))
        .distinct()
        .order_by(func.coalesce(SiteBlogPost.published_category, SiteBlogPost.category).asc())
        .all()
    )
    return [category for (category,) in rows]


def get_blog_post_by_slug(db: Session, slug: str) -> SiteBlogPost | None:
    return (
        db.query(SiteBlogPost)
        .filter(SiteBlogPost.slug == slug, SiteBlogPost.is_published.is_(True))
        .first()
    )


def get_blog_post_by_slug_admin(db: Session, slug: str) -> SiteBlogPost | None:
    return db.query(SiteBlogPost).filter(SiteBlogPost.slug == slug).first()


def create_blog_post(db: Session, payload: dict) -> SiteBlogPost:
    post = SiteBlogPost(**payload)
    db.add(post)
    db.flush()
    db.refresh(post)
    return post


def update_page(db: Session, page: SitePage, payload: dict) -> SitePage:
    for field, value in payload.items():
        setattr(page, field, value)
    db.add(page)
    db.flush()
    db.refresh(page)
    return page


def update_blog_post(db: Session, post: SiteBlogPost, payload: dict) -> SiteBlogPost:
    for field, value in payload.items():
        setattr(post, field, value)
    db.add(post)
    db.flush()
    db.refresh(post)
    return post


def delete_blog_post(db: Session, post: SiteBlogPost) -> None:
    db.delete(post)
    db.flush()


def create_contact_lead(db: Session, payload: dict) -> ContactLead:
    lead = ContactLead(**payload)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def get_contact_lead_by_id(db: Session, lead_id: int) -> ContactLead | None:
    return db.query(ContactLead).filter(ContactLead.id == lead_id).first()


def _apply_contact_lead_filters(
    query,
    *,
    search: str | None = None,
    status: str | None = None,
    assigned_to_user_id: int | None = None,
):
    if status:
        query = query.filter(ContactLead.status == status)

    if assigned_to_user_id is not None:
        if assigned_to_user_id <= 0:
            query = query.filter(ContactLead.assigned_to_user_id.is_(None))
        else:
            query = query.filter(ContactLead.assigned_to_user_id == assigned_to_user_id)

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ContactLead.full_name.ilike(like),
                ContactLead.email.ilike(like),
                ContactLead.company_name.ilike(like),
                ContactLead.subject.ilike(like),
                ContactLead.message.ilike(like),
                ContactLead.source_page.ilike(like),
                ContactLead.source_path.ilike(like),
                ContactLead.entry_point.ilike(like),
                ContactLead.login_intent.ilike(like),
                ContactLead.utm_source.ilike(like),
                ContactLead.utm_medium.ilike(like),
                ContactLead.utm_campaign.ilike(like),
            )
        )

    return query


def list_contact_leads(
    db: Session,
    *,
    search: str | None = None,
    status: str | None = None,
    assigned_to_user_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ContactLead], int]:
    query = _apply_contact_lead_filters(
        db.query(ContactLead),
        search=search,
        status=status,
        assigned_to_user_id=assigned_to_user_id,
    )
    total = query.count()
    items = (
        query.order_by(ContactLead.created_at.desc(), ContactLead.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, total


def summarize_contact_leads(
    db: Session,
    *,
    search: str | None = None,
    status: str | None = None,
    assigned_to_user_id: int | None = None,
) -> dict[str, int]:
    base_query = _apply_contact_lead_filters(
        db.query(ContactLead),
        search=search,
        status=status,
        assigned_to_user_id=assigned_to_user_id,
    )
    rows = (
        base_query.with_entities(ContactLead.status, func.count(ContactLead.id))
        .group_by(ContactLead.status)
        .all()
    )
    summary = {
        "new_count": 0,
        "reviewed_count": 0,
        "qualified_count": 0,
        "closed_count": 0,
    }
    for status_value, count in rows:
        status_key = status_value.value if hasattr(status_value, "value") else str(status_value)
        summary[f"{status_key}_count"] = int(count or 0)

    if assigned_to_user_id is not None and assigned_to_user_id > 0:
        summary["unassigned_count"] = 0
    else:
        summary["unassigned_count"] = int(
            _apply_contact_lead_filters(
                db.query(ContactLead),
                search=search,
                status=status,
                assigned_to_user_id=assigned_to_user_id,
            )
            .filter(ContactLead.assigned_to_user_id.is_(None))
            .count()
        )
    return summary
