from __future__ import annotations

import csv
import json
from datetime import UTC, datetime
from io import StringIO

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.audit_logs.service import write_audit_log
from app.modules.platform_access import catalog as platform_access_catalog
from app.modules.realtime import service as realtime_service
from app.modules.site_content import repository
from app.modules.site_content.defaults import DEFAULT_BLOG_POSTS, DEFAULT_SITE_PAGES
from app.modules.site_content.model import ContactLead, SiteBlogPost, SitePage
from app.modules.site_content.schemas import (
    AboutPageResponse,
    AdminBlogPostDetailResponse,
    AdminBlogPostListResponse,
    AdminBlogPostSummaryResponse,
    AdminBlogPostUpsertRequest,
    AdminContactLeadListResponse,
    AdminContactLeadResponse,
    AdminContactLeadSummaryResponse,
    AdminContactLeadUpdateRequest,
    AdminSitePageDetailResponse,
    AdminSitePageListResponse,
    AdminSitePageSummaryResponse,
    AdminSitePageUpdateRequest,
    BlogCategoryListResponse,
    BlogListResponse,
    BlogPostDetailResponse,
    BlogPostSummaryResponse,
    ContactLeadCreateRequest,
    ContactLeadCreateResponse,
    ContactPageResponse,
    LandingPageResponse,
    SiteContentActionResponse,
    SiteContentAdminUserListResponse,
    SiteContentAdminUserResponse,
)
from app.modules.users import repository as users_repository
from app.modules.users.model import User

_PAGE_SCHEMA_MAP = {
    "landing": LandingPageResponse,
    "about": AboutPageResponse,
    "contact": ContactPageResponse,
}


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_reason(reason: str | None, *, default_reason: str) -> str:
    normalized = _normalize_optional_text(reason)
    return normalized if normalized else default_reason


def _to_json_safe_dict(value: dict[str, object]) -> dict[str, object]:
    return json.loads(json.dumps(value, ensure_ascii=True, default=str))


def _build_change_delta(
    before_state: dict[str, object],
    after_state: dict[str, object],
) -> dict[str, dict[str, object]]:
    delta: dict[str, dict[str, object]] = {}
    for key in sorted(set(before_state.keys()) | set(after_state.keys())):
        before_value = before_state.get(key)
        after_value = after_state.get(key)
        if before_value != after_value:
            delta[key] = {
                "before": before_value,
                "after": after_value,
            }
    return delta


def _write_site_content_mutation_audit(
    db: Session,
    *,
    event_type: str,
    current_user_id: int,
    reason: str | None,
    default_reason: str,
    before_state: dict[str, object],
    after_state: dict[str, object],
    extra_metadata: dict[str, object] | None = None,
) -> None:
    normalized_before = _to_json_safe_dict(before_state)
    normalized_after = _to_json_safe_dict(after_state)
    delta = _build_change_delta(normalized_before, normalized_after)

    metadata = {
        "reason": _normalize_reason(reason, default_reason=default_reason),
        "before": normalized_before,
        "after": normalized_after,
        "delta": delta,
        "delta_field_count": len(delta),
    }
    if extra_metadata:
        metadata.update(extra_metadata)

    audit_log = write_audit_log(
        db,
        event_type=event_type,
        user_id=current_user_id,
        metadata=metadata,
    )
    if audit_log is not None:
        realtime_service.publish_super_admin_audit_notification(audit_log=audit_log)


def _snapshot_site_page(page: SitePage) -> dict[str, object]:
    return {
        "slug": page.slug,
        "title": page.title,
        "summary": page.summary,
        "is_published": page.is_published,
        "payload": _parse_json_document(page.payload_json, {}),
        "published_payload": _parse_json_document(page.published_payload_json, None),
        "last_published_at": page.last_published_at.isoformat() if page.last_published_at else None,
    }


def _snapshot_blog_post(post: SiteBlogPost) -> dict[str, object]:
    return {
        "slug": post.slug,
        "title": post.title,
        "excerpt": post.excerpt,
        "category": post.category,
        "cover_image_url": post.cover_image_url,
        "tags": _parse_json_document(post.tags_json, []),
        "body": _parse_json_document(post.body_json, {}).get("body", []),
        "key_takeaways": _parse_json_document(post.body_json, {}).get("key_takeaways", []),
        "reading_minutes": post.reading_minutes,
        "is_featured": post.is_featured,
        "is_published": post.is_published,
        "scheduled_publish_at": post.published_at.isoformat() if post.published_at else None,
        "published_content_at": post.published_content_at.isoformat() if post.published_content_at else None,
    }


def _snapshot_contact_lead(lead: ContactLead) -> dict[str, object]:
    return {
        "lead_id": lead.id,
        "status": lead.status.value,
        "assigned_to_user_id": lead.assigned_to_user_id,
        "internal_notes": lead.internal_notes,
    }


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


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _normalize_slug(value: str) -> str:
    normalized = "-".join(value.strip().lower().split())
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Slug is required.",
        )
    return normalized


def _normalize_string_list(values: list[str]) -> list[str]:
    normalized = [item.strip() for item in values if item and item.strip()]
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one content item is required.",
        )
    return normalized


def _parse_json_document(raw_value: str | None, fallback):
    if not raw_value:
        return fallback
    try:
        parsed = json.loads(raw_value)
    except Exception:
        return fallback
    return parsed


def _load_page_payload(page: SitePage, schema_type, *, published: bool):
    raw_payload = (
        page.published_payload_json if published and page.published_payload_json else page.payload_json
    )
    return schema_type.model_validate(_parse_json_document(raw_payload, {}))


def _page_schema_for_slug(slug: str):
    schema_type = _PAGE_SCHEMA_MAP.get(slug)
    if schema_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site page not found.",
        )
    return schema_type


def _require_page(db: Session, slug: str, schema_type):
    ensure_seeded(db)
    page = repository.get_page_by_slug(db, slug)
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site page not found.",
        )
    return _load_page_payload(page, schema_type, published=True)


def _require_admin_page(db: Session, slug: str) -> SitePage:
    ensure_seeded(db)
    _page_schema_for_slug(slug)
    page = repository.get_page_by_slug_admin(db, slug)
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site page not found.",
        )
    return page


def _public_blog_content(post: SiteBlogPost) -> dict:
    body_json = post.published_body_json or post.body_json
    body_payload = _parse_json_document(body_json, {})
    return {
        "slug": post.slug,
        "title": post.published_title or post.title,
        "excerpt": post.published_excerpt or post.excerpt,
        "category": post.published_category or post.category,
        "cover_image_url": post.published_cover_image_url or post.cover_image_url,
        "tags": _parse_json_document(post.published_tags_json or post.tags_json, []),
        "reading_minutes": post.published_reading_minutes or post.reading_minutes,
        "is_featured": post.published_is_featured,
        "published_at": post.published_content_at or post.published_at,
        "body": body_payload.get("body", []),
        "key_takeaways": body_payload.get("key_takeaways", []),
    }


def _draft_blog_content(post: SiteBlogPost) -> dict:
    body_payload = _parse_json_document(post.body_json, {})
    return {
        "slug": post.slug,
        "title": post.title,
        "excerpt": post.excerpt,
        "category": post.category,
        "cover_image_url": post.cover_image_url,
        "tags": _parse_json_document(post.tags_json, []),
        "reading_minutes": post.reading_minutes,
        "is_featured": post.is_featured,
        "scheduled_publish_at": post.published_at,
        "live_published_at": post.published_content_at,
        "last_published_at": post.last_published_at,
        "body": body_payload.get("body", []),
        "key_takeaways": body_payload.get("key_takeaways", []),
    }


def _to_blog_summary(post: SiteBlogPost) -> BlogPostSummaryResponse:
    content = _public_blog_content(post)
    return BlogPostSummaryResponse(
        slug=content["slug"],
        title=content["title"],
        excerpt=content["excerpt"],
        category=content["category"],
        cover_image_url=content["cover_image_url"],
        tags=content["tags"],
        reading_minutes=content["reading_minutes"],
        is_featured=content["is_featured"],
        published_at=content["published_at"],
    )


def _to_admin_user(user: User | None) -> SiteContentAdminUserResponse | None:
    if user is None:
        return None
    return SiteContentAdminUserResponse(
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        scopes=user.super_admin_scopes,
    )


def _load_user_map(db: Session, user_ids: set[int | None]) -> dict[int, User]:
    normalized_ids = {user_id for user_id in user_ids if user_id is not None}
    if not normalized_ids:
        return {}
    return {
        user.id: user
        for user in db.query(User).filter(User.id.in_(normalized_ids)).all()
    }


def _serialize_page_summary(
    page: SitePage,
    user_map: dict[int, User],
) -> AdminSitePageSummaryResponse:
    return AdminSitePageSummaryResponse(
        slug=page.slug,
        title=page.title,
        summary=page.summary,
        is_published=page.is_published,
        last_published_at=page.last_published_at,
        updated_at=page.updated_at,
        updated_by=_to_admin_user(user_map.get(page.updated_by_user_id)),
        published_by=_to_admin_user(user_map.get(page.published_by_user_id)),
    )


def _serialize_page_detail(
    page: SitePage,
    user_map: dict[int, User],
) -> AdminSitePageDetailResponse:
    summary = _serialize_page_summary(page, user_map)
    return AdminSitePageDetailResponse(
        **summary.model_dump(),
        payload=_parse_json_document(page.payload_json, {}),
        published_payload=_parse_json_document(page.published_payload_json, None),
    )


def _serialize_blog_summary(
    post: SiteBlogPost,
    user_map: dict[int, User],
) -> AdminBlogPostSummaryResponse:
    content = _draft_blog_content(post)
    return AdminBlogPostSummaryResponse(
        slug=content["slug"],
        title=content["title"],
        excerpt=content["excerpt"],
        category=content["category"],
        cover_image_url=content["cover_image_url"],
        tags=content["tags"],
        reading_minutes=content["reading_minutes"],
        is_featured=content["is_featured"],
        is_published=post.is_published,
        scheduled_publish_at=content["scheduled_publish_at"],
        live_published_at=content["live_published_at"],
        last_published_at=content["last_published_at"],
        updated_at=post.updated_at,
        updated_by=_to_admin_user(user_map.get(post.updated_by_user_id)),
        published_by=_to_admin_user(user_map.get(post.published_by_user_id)),
    )


def _serialize_blog_detail(
    post: SiteBlogPost,
    user_map: dict[int, User],
) -> AdminBlogPostDetailResponse:
    summary = _serialize_blog_summary(post, user_map)
    content = _draft_blog_content(post)
    return AdminBlogPostDetailResponse(
        **summary.model_dump(),
        body=content["body"],
        key_takeaways=content["key_takeaways"],
    )


def _serialize_contact_lead(
    lead: ContactLead,
    user_map: dict[int, User],
) -> AdminContactLeadResponse:
    return AdminContactLeadResponse(
        id=lead.id,
        full_name=lead.full_name,
        email=lead.email,
        phone=lead.phone,
        company_name=lead.company_name,
        property_type=lead.property_type,
        subject=lead.subject,
        message=lead.message,
        source_page=lead.source_page,
        source_path=lead.source_path,
        entry_point=lead.entry_point,
        login_intent=lead.login_intent,
        referrer_url=lead.referrer_url,
        utm_source=lead.utm_source,
        utm_medium=lead.utm_medium,
        utm_campaign=lead.utm_campaign,
        utm_term=lead.utm_term,
        utm_content=lead.utm_content,
        status=lead.status,
        internal_notes=lead.internal_notes,
        assigned_to=_to_admin_user(user_map.get(lead.assigned_to_user_id)),
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


def _validate_page_payload(slug: str, payload: dict) -> dict:
    schema_type = _page_schema_for_slug(slug)
    return schema_type.model_validate(payload).model_dump(mode="json")


def _prepare_blog_upsert_payload(
    payload: AdminBlogPostUpsertRequest,
    *,
    updated_by_user_id: int,
) -> dict:
    normalized_tags = [item.strip() for item in payload.tags if item and item.strip()]
    normalized_body = _normalize_string_list(payload.body)
    normalized_takeaways = [item.strip() for item in payload.key_takeaways if item and item.strip()]
    scheduled_publish_at = payload.scheduled_publish_at or _utcnow()
    return {
        "slug": _normalize_slug(payload.slug),
        "title": payload.title.strip(),
        "excerpt": payload.excerpt.strip(),
        "category": payload.category.strip(),
        "cover_image_url": _normalize_optional_text(payload.cover_image_url),
        "tags_json": json.dumps(normalized_tags, ensure_ascii=True),
        "body_json": json.dumps(
            {
                "body": normalized_body,
                "key_takeaways": normalized_takeaways,
            },
            ensure_ascii=True,
        ),
        "reading_minutes": payload.reading_minutes,
        "is_featured": payload.is_featured,
        "published_at": scheduled_publish_at,
        "updated_by_user_id": updated_by_user_id,
    }


def _require_blog_post_admin(db: Session, slug: str) -> SiteBlogPost:
    ensure_seeded(db)
    post = repository.get_blog_post_by_slug_admin(db, slug)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found.",
        )
    return post


def _ensure_unique_blog_slug(
    db: Session,
    slug: str,
    *,
    exclude_id: int | None = None,
) -> None:
    existing = repository.get_blog_post_by_slug_admin(db, slug)
    if existing and existing.id != exclude_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A blog post with this slug already exists.",
        )


def _set_published_featured_state(db: Session, active_post_id: int, is_featured: bool) -> None:
    if not is_featured:
        return
    (
        db.query(SiteBlogPost)
        .filter(
            SiteBlogPost.id != active_post_id,
            SiteBlogPost.published_is_featured.is_(True),
        )
        .update({"published_is_featured": False}, synchronize_session=False)
    )


def _get_valid_lead_assignee(db: Session, user_id: int | None) -> User | None:
    if user_id is None:
        return None

    user = users_repository.get_platform_user_for_super_admin(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assignee must be an active platform user.",
        )
    if not platform_access_catalog.user_has_any_platform_scope(user, ("tenant_admin",)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assignee must have tenant admin access.",
        )
    return user


def _prepare_contact_lead_payload(payload: ContactLeadCreateRequest) -> dict:
    raw = payload.model_dump()
    for field in (
        "phone",
        "company_name",
        "property_type",
        "subject",
        "source_page",
        "source_path",
        "entry_point",
        "login_intent",
        "referrer_url",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
    ):
        raw[field] = _normalize_optional_text(raw.get(field))

    raw["full_name"] = payload.full_name.strip()
    raw["message"] = payload.message.strip()
    return raw


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

    public_content = _public_blog_content(post)
    related = [
        _to_blog_summary(item)
        for item in repository.list_blog_posts(db, category=public_content["category"], limit=4)
        if item.slug != post.slug
    ][:3]
    return BlogPostDetailResponse(
        slug=public_content["slug"],
        title=public_content["title"],
        excerpt=public_content["excerpt"],
        category=public_content["category"],
        cover_image_url=public_content["cover_image_url"],
        tags=public_content["tags"],
        reading_minutes=public_content["reading_minutes"],
        is_featured=public_content["is_featured"],
        published_at=public_content["published_at"],
        body=public_content["body"],
        key_takeaways=public_content["key_takeaways"],
        related_posts=related,
    )


def submit_contact_lead(
    db: Session,
    payload: ContactLeadCreateRequest,
) -> ContactLeadCreateResponse:
    lead = repository.create_contact_lead(db, _prepare_contact_lead_payload(payload))
    page = get_contact_page(db)
    return ContactLeadCreateResponse(
        id=lead.id,
        message=page.success_message,
    )


def list_site_pages_admin(db: Session) -> AdminSitePageListResponse:
    ensure_seeded(db)
    pages = repository.list_site_pages(db)
    user_map = _load_user_map(
        db,
        {page.updated_by_user_id for page in pages} | {page.published_by_user_id for page in pages},
    )
    items = [_serialize_page_summary(page, user_map) for page in pages]
    return AdminSitePageListResponse(items=items, total=len(items))


def get_site_page_admin(db: Session, slug: str) -> AdminSitePageDetailResponse:
    page = _require_admin_page(db, slug)
    user_map = _load_user_map(db, {page.updated_by_user_id, page.published_by_user_id})
    return _serialize_page_detail(page, user_map)


def update_site_page_admin(
    db: Session,
    *,
    slug: str,
    payload: AdminSitePageUpdateRequest,
    current_user: User,
) -> AdminSitePageDetailResponse:
    page = _require_admin_page(db, slug)
    before_state = _snapshot_site_page(page)
    validated_payload = _validate_page_payload(slug, payload.payload)
    repository.update_page(
        db,
        page,
        {
            "title": payload.title.strip(),
            "summary": _normalize_optional_text(payload.summary),
            "payload_json": json.dumps(validated_payload, ensure_ascii=True),
            "updated_by_user_id": current_user.id,
        },
    )
    db.commit()
    refreshed = repository.get_page_by_slug_admin(db, slug)
    assert refreshed is not None
    after_state = _snapshot_site_page(refreshed)
    _write_site_content_mutation_audit(
        db,
        event_type="site_page_updated",
        current_user_id=current_user.id,
        reason=payload.reason,
        default_reason=f"Updated {slug} page draft.",
        before_state=before_state,
        after_state=after_state,
        extra_metadata={
            "page_slug": slug,
        },
    )
    user_map = _load_user_map(db, {refreshed.updated_by_user_id, refreshed.published_by_user_id})
    return _serialize_page_detail(refreshed, user_map)


def publish_site_page_admin(
    db: Session,
    *,
    slug: str,
    current_user: User,
    reason: str | None = None,
) -> AdminSitePageDetailResponse:
    page = _require_admin_page(db, slug)
    before_state = _snapshot_site_page(page)
    validated_payload = _validate_page_payload(slug, _parse_json_document(page.payload_json, {}))
    repository.update_page(
        db,
        page,
        {
            "published_payload_json": json.dumps(validated_payload, ensure_ascii=True),
            "is_published": True,
            "last_published_at": _utcnow(),
            "published_by_user_id": current_user.id,
        },
    )
    db.commit()
    refreshed = repository.get_page_by_slug_admin(db, slug)
    assert refreshed is not None
    after_state = _snapshot_site_page(refreshed)
    _write_site_content_mutation_audit(
        db,
        event_type="site_page_published",
        current_user_id=current_user.id,
        reason=reason,
        default_reason=f"Published {slug} page.",
        before_state=before_state,
        after_state=after_state,
        extra_metadata={
            "page_slug": slug,
        },
    )
    user_map = _load_user_map(db, {refreshed.updated_by_user_id, refreshed.published_by_user_id})
    return _serialize_page_detail(refreshed, user_map)


def unpublish_site_page_admin(
    db: Session,
    *,
    slug: str,
    current_user: User,
    reason: str | None = None,
) -> AdminSitePageDetailResponse:
    page = _require_admin_page(db, slug)
    before_state = _snapshot_site_page(page)
    repository.update_page(
        db,
        page,
        {
            "is_published": False,
            "updated_by_user_id": current_user.id,
        },
    )
    db.commit()
    refreshed = repository.get_page_by_slug_admin(db, slug)
    assert refreshed is not None
    after_state = _snapshot_site_page(refreshed)
    _write_site_content_mutation_audit(
        db,
        event_type="site_page_unpublished",
        current_user_id=current_user.id,
        reason=reason,
        default_reason=f"Unpublished {slug} page.",
        before_state=before_state,
        after_state=after_state,
        extra_metadata={
            "page_slug": slug,
        },
    )
    user_map = _load_user_map(db, {refreshed.updated_by_user_id, refreshed.published_by_user_id})
    return _serialize_page_detail(refreshed, user_map)


def list_blog_posts_admin(
    db: Session,
    *,
    search: str | None = None,
    category: str | None = None,
    is_published: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> AdminBlogPostListResponse:
    ensure_seeded(db)
    posts, total = repository.list_blog_posts_admin(
        db,
        search=search,
        category=category,
        is_published=is_published,
        limit=limit,
        offset=offset,
    )
    user_map = _load_user_map(
        db,
        {post.updated_by_user_id for post in posts} | {post.published_by_user_id for post in posts},
    )
    items = [_serialize_blog_summary(post, user_map) for post in posts]
    return AdminBlogPostListResponse(items=items, total=total)


def get_blog_post_admin(db: Session, slug: str) -> AdminBlogPostDetailResponse:
    post = _require_blog_post_admin(db, slug)
    user_map = _load_user_map(db, {post.updated_by_user_id, post.published_by_user_id})
    return _serialize_blog_detail(post, user_map)


def create_blog_post_admin(
    db: Session,
    *,
    payload: AdminBlogPostUpsertRequest,
    current_user: User,
) -> AdminBlogPostDetailResponse:
    ensure_seeded(db)
    upsert_payload = _prepare_blog_upsert_payload(payload, updated_by_user_id=current_user.id)
    _ensure_unique_blog_slug(db, upsert_payload["slug"])
    post = repository.create_blog_post(
        db,
        {
            **upsert_payload,
            "is_published": False,
            "published_title": None,
            "published_excerpt": None,
            "published_category": None,
            "published_cover_image_url": None,
            "published_tags_json": None,
            "published_body_json": None,
            "published_reading_minutes": None,
            "published_is_featured": False,
            "published_content_at": None,
            "last_published_at": None,
            "published_by_user_id": None,
        },
    )
    db.commit()
    _write_site_content_mutation_audit(
        db,
        event_type="site_blog_created",
        current_user_id=current_user.id,
        reason=payload.reason,
        default_reason="Created blog draft.",
        before_state={},
        after_state=_snapshot_blog_post(post),
        extra_metadata={
            "blog_slug": post.slug,
        },
    )
    user_map = _load_user_map(db, {post.updated_by_user_id, post.published_by_user_id})
    return _serialize_blog_detail(post, user_map)


def update_blog_post_admin(
    db: Session,
    *,
    slug: str,
    payload: AdminBlogPostUpsertRequest,
    current_user: User,
) -> AdminBlogPostDetailResponse:
    post = _require_blog_post_admin(db, slug)
    before_state = _snapshot_blog_post(post)
    upsert_payload = _prepare_blog_upsert_payload(payload, updated_by_user_id=current_user.id)
    if post.is_published and upsert_payload["slug"] != post.slug:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Published blog slugs cannot change until the post is unpublished.",
        )
    _ensure_unique_blog_slug(db, upsert_payload["slug"], exclude_id=post.id)
    repository.update_blog_post(db, post, upsert_payload)
    db.commit()
    refreshed = repository.get_blog_post_by_slug_admin(db, upsert_payload["slug"])
    assert refreshed is not None
    _write_site_content_mutation_audit(
        db,
        event_type="site_blog_updated",
        current_user_id=current_user.id,
        reason=payload.reason,
        default_reason=f"Updated blog draft '{slug}'.",
        before_state=before_state,
        after_state=_snapshot_blog_post(refreshed),
        extra_metadata={
            "blog_slug": refreshed.slug,
        },
    )
    user_map = _load_user_map(db, {refreshed.updated_by_user_id, refreshed.published_by_user_id})
    return _serialize_blog_detail(refreshed, user_map)


def publish_blog_post_admin(
    db: Session,
    *,
    slug: str,
    current_user: User,
    reason: str | None = None,
) -> AdminBlogPostDetailResponse:
    post = _require_blog_post_admin(db, slug)
    before_state = _snapshot_blog_post(post)
    body_payload = _parse_json_document(post.body_json, {})
    publish_time = post.published_at or _utcnow()
    _set_published_featured_state(db, post.id, post.is_featured)
    repository.update_blog_post(
        db,
        post,
        {
            "published_title": post.title,
            "published_excerpt": post.excerpt,
            "published_category": post.category,
            "published_cover_image_url": post.cover_image_url,
            "published_tags_json": post.tags_json,
            "published_body_json": json.dumps(
                {
                    "body": body_payload.get("body", []),
                    "key_takeaways": body_payload.get("key_takeaways", []),
                },
                ensure_ascii=True,
            ),
            "published_reading_minutes": post.reading_minutes,
            "published_is_featured": post.is_featured,
            "published_content_at": publish_time,
            "last_published_at": _utcnow(),
            "is_published": True,
            "published_by_user_id": current_user.id,
        },
    )
    db.commit()
    refreshed = repository.get_blog_post_by_slug_admin(db, slug)
    assert refreshed is not None
    _write_site_content_mutation_audit(
        db,
        event_type="site_blog_published",
        current_user_id=current_user.id,
        reason=reason,
        default_reason=f"Published blog post '{slug}'.",
        before_state=before_state,
        after_state=_snapshot_blog_post(refreshed),
        extra_metadata={
            "blog_slug": refreshed.slug,
        },
    )
    user_map = _load_user_map(db, {refreshed.updated_by_user_id, refreshed.published_by_user_id})
    return _serialize_blog_detail(refreshed, user_map)


def unpublish_blog_post_admin(
    db: Session,
    *,
    slug: str,
    current_user: User,
    reason: str | None = None,
) -> AdminBlogPostDetailResponse:
    post = _require_blog_post_admin(db, slug)
    before_state = _snapshot_blog_post(post)
    repository.update_blog_post(
        db,
        post,
        {
            "is_published": False,
            "published_is_featured": False,
            "updated_by_user_id": current_user.id,
        },
    )
    db.commit()
    refreshed = repository.get_blog_post_by_slug_admin(db, slug)
    assert refreshed is not None
    _write_site_content_mutation_audit(
        db,
        event_type="site_blog_unpublished",
        current_user_id=current_user.id,
        reason=reason,
        default_reason=f"Unpublished blog post '{slug}'.",
        before_state=before_state,
        after_state=_snapshot_blog_post(refreshed),
        extra_metadata={
            "blog_slug": refreshed.slug,
        },
    )
    user_map = _load_user_map(db, {refreshed.updated_by_user_id, refreshed.published_by_user_id})
    return _serialize_blog_detail(refreshed, user_map)


def delete_blog_post_admin(
    db: Session,
    *,
    slug: str,
    current_user: User,
    reason: str | None = None,
) -> SiteContentActionResponse:
    post = _require_blog_post_admin(db, slug)
    before_state = _snapshot_blog_post(post)
    if post.is_published:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unpublish the blog post before deleting it.",
        )
    repository.delete_blog_post(db, post)
    db.commit()

    _write_site_content_mutation_audit(
        db,
        event_type="site_blog_deleted",
        current_user_id=current_user.id,
        reason=reason,
        default_reason=f"Deleted blog draft '{slug}'.",
        before_state=before_state,
        after_state={
            "slug": slug,
            "is_deleted": True,
        },
        extra_metadata={
            "blog_slug": slug,
        },
    )

    return SiteContentActionResponse(message="Blog draft deleted successfully.")


def list_site_content_admin_users(db: Session) -> SiteContentAdminUserListResponse:
    users = [
        user
        for user in users_repository.list_platform_users(db, is_active=True)
        if platform_access_catalog.user_has_any_platform_scope(user, ("tenant_admin",))
    ]
    items = [
        SiteContentAdminUserResponse(
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
            scopes=user.super_admin_scopes,
        )
        for user in sorted(users, key=lambda item: (item.full_name.lower(), item.id))
    ]
    return SiteContentAdminUserListResponse(items=items, total=len(items))


def list_contact_leads_admin(
    db: Session,
    *,
    search: str | None = None,
    status_filter: str | None = None,
    assigned_to_user_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> AdminContactLeadListResponse:
    ensure_seeded(db)
    leads, total = repository.list_contact_leads(
        db,
        search=search,
        status=status_filter,
        assigned_to_user_id=assigned_to_user_id,
        limit=limit,
        offset=offset,
    )
    summary = repository.summarize_contact_leads(
        db,
        search=search,
        status=status_filter,
        assigned_to_user_id=assigned_to_user_id,
    )
    user_map = _load_user_map(db, {lead.assigned_to_user_id for lead in leads})
    items = [_serialize_contact_lead(lead, user_map) for lead in leads]
    return AdminContactLeadListResponse(
        items=items,
        total=total,
        summary=AdminContactLeadSummaryResponse(**summary),
    )


def update_contact_lead_admin(
    db: Session,
    *,
    lead_id: int,
    payload: AdminContactLeadUpdateRequest,
    current_user: User,
) -> AdminContactLeadResponse:
    lead = repository.get_contact_lead_by_id(db, lead_id)
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact lead not found.",
        )

    before_state = _snapshot_contact_lead(lead)
    provided_fields = payload.model_fields_set
    update_payload: dict[str, object] = {}

    if "status" in provided_fields and payload.status is not None:
        update_payload["status"] = payload.status

    if "assigned_to_user_id" in provided_fields:
        assignee = _get_valid_lead_assignee(db, payload.assigned_to_user_id)
        update_payload["assigned_to_user_id"] = assignee.id if assignee else None

    if "internal_notes" in provided_fields:
        update_payload["internal_notes"] = _normalize_optional_text(payload.internal_notes)

    if update_payload:
        for field, value in update_payload.items():
            setattr(lead, field, value)
        db.add(lead)
        db.commit()
        db.refresh(lead)

        _write_site_content_mutation_audit(
            db,
            event_type="site_contact_lead_updated",
            current_user_id=current_user.id,
            reason=payload.reason,
            default_reason=f"Updated contact lead #{lead_id}.",
            before_state=before_state,
            after_state=_snapshot_contact_lead(lead),
            extra_metadata={
                "lead_id": lead.id,
                "lead_status": lead.status.value,
            },
        )

    user_map = _load_user_map(db, {lead.assigned_to_user_id})
    return _serialize_contact_lead(lead, user_map)


def export_contact_leads_csv(
    db: Session,
    *,
    search: str | None = None,
    status_filter: str | None = None,
    assigned_to_user_id: int | None = None,
) -> str:
    leads, _total = repository.list_contact_leads(
        db,
        search=search,
        status=status_filter,
        assigned_to_user_id=assigned_to_user_id,
        limit=5000,
        offset=0,
    )
    user_map = _load_user_map(db, {lead.assigned_to_user_id for lead in leads})

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "id",
            "created_at",
            "status",
            "assigned_to",
            "full_name",
            "email",
            "phone",
            "company_name",
            "property_type",
            "subject",
            "source_page",
            "source_path",
            "entry_point",
            "login_intent",
            "referrer_url",
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_term",
            "utm_content",
            "message",
            "internal_notes",
        ]
    )

    for lead in leads:
        assignee = user_map.get(lead.assigned_to_user_id)
        writer.writerow(
            [
                lead.id,
                lead.created_at.isoformat(),
                lead.status.value,
                assignee.full_name if assignee else "",
                lead.full_name,
                lead.email,
                lead.phone or "",
                lead.company_name or "",
                lead.property_type or "",
                lead.subject or "",
                lead.source_page or "",
                lead.source_path or "",
                lead.entry_point or "",
                lead.login_intent or "",
                lead.referrer_url or "",
                lead.utm_source or "",
                lead.utm_medium or "",
                lead.utm_campaign or "",
                lead.utm_term or "",
                lead.utm_content or "",
                lead.message,
                lead.internal_notes or "",
            ]
        )

    return buffer.getvalue()
