from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_platform_scopes
from app.modules.site_content import service
from app.modules.site_content.schemas import (
    AboutPageResponse,
    AdminBlogPostDetailResponse,
    AdminBlogPostListResponse,
    AdminBlogPostUpsertRequest,
    AdminContactLeadListResponse,
    AdminContactLeadResponse,
    AdminContactLeadUpdateRequest,
    AdminSitePageDetailResponse,
    AdminSitePageListResponse,
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
)
from app.modules.users.model import User

router = APIRouter()
admin_router = APIRouter()


@router.get("/landing", response_model=LandingPageResponse)
def get_landing_page(db: Session = Depends(get_db)) -> LandingPageResponse:
    return service.get_landing_page(db)


@router.get("/about", response_model=AboutPageResponse)
def get_about_page(db: Session = Depends(get_db)) -> AboutPageResponse:
    return service.get_about_page(db)


@router.get("/contact", response_model=ContactPageResponse)
def get_contact_page(db: Session = Depends(get_db)) -> ContactPageResponse:
    return service.get_contact_page(db)


@router.post(
    "/contact",
    response_model=ContactLeadCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_contact_lead(
    payload: ContactLeadCreateRequest,
    db: Session = Depends(get_db),
) -> ContactLeadCreateResponse:
    return service.submit_contact_lead(db, payload)


@router.get("/blogs", response_model=BlogListResponse)
def list_blogs(
    search: str | None = Query(default=None, min_length=1, max_length=120),
    category: str | None = Query(default=None, min_length=1, max_length=80),
    db: Session = Depends(get_db),
) -> BlogListResponse:
    return service.list_blogs(db, search=search, category=category)


@router.get("/blogs/categories", response_model=BlogCategoryListResponse)
def list_blog_categories(db: Session = Depends(get_db)) -> BlogCategoryListResponse:
    return service.list_blog_categories(db)


@router.get("/blogs/recent", response_model=list[BlogPostSummaryResponse])
def list_recent_blogs(
    limit: int = Query(default=3, ge=1, le=6),
    db: Session = Depends(get_db),
) -> list[BlogPostSummaryResponse]:
    return service.list_recent_blogs(db, limit=limit)


@router.get("/blogs/{slug}", response_model=BlogPostDetailResponse)
def get_blog_post(slug: str, db: Session = Depends(get_db)) -> BlogPostDetailResponse:
    return service.get_blog_post(db, slug)


@admin_router.get("/pages", response_model=AdminSitePageListResponse)
def list_site_pages_admin(
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminSitePageListResponse:
    return service.list_site_pages_admin(db)


@admin_router.get("/pages/{slug}", response_model=AdminSitePageDetailResponse)
def get_site_page_admin(
    slug: str,
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminSitePageDetailResponse:
    return service.get_site_page_admin(db, slug)


@admin_router.put("/pages/{slug}", response_model=AdminSitePageDetailResponse)
def update_site_page_admin(
    slug: str,
    payload: AdminSitePageUpdateRequest,
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminSitePageDetailResponse:
    return service.update_site_page_admin(
        db,
        slug=slug,
        payload=payload,
        current_user=current_user,
    )


@admin_router.post("/pages/{slug}/publish", response_model=AdminSitePageDetailResponse)
def publish_site_page_admin(
    slug: str,
    reason: str | None = Query(default=None, min_length=3, max_length=500),
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminSitePageDetailResponse:
    return service.publish_site_page_admin(
        db,
        slug=slug,
        current_user=current_user,
        reason=reason,
    )


@admin_router.post("/pages/{slug}/unpublish", response_model=AdminSitePageDetailResponse)
def unpublish_site_page_admin(
    slug: str,
    reason: str | None = Query(default=None, min_length=3, max_length=500),
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminSitePageDetailResponse:
    return service.unpublish_site_page_admin(
        db,
        slug=slug,
        current_user=current_user,
        reason=reason,
    )


@admin_router.get("/blogs", response_model=AdminBlogPostListResponse)
def list_blog_posts_admin(
    search: str | None = Query(default=None, min_length=1, max_length=120),
    category: str | None = Query(default=None, min_length=1, max_length=80),
    is_published: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminBlogPostListResponse:
    return service.list_blog_posts_admin(
        db,
        search=search,
        category=category,
        is_published=is_published,
        limit=limit,
        offset=offset,
    )


@admin_router.post(
    "/blogs",
    response_model=AdminBlogPostDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_blog_post_admin(
    payload: AdminBlogPostUpsertRequest,
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminBlogPostDetailResponse:
    return service.create_blog_post_admin(db, payload=payload, current_user=current_user)


@admin_router.get("/blogs/{slug}", response_model=AdminBlogPostDetailResponse)
def get_blog_post_admin(
    slug: str,
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminBlogPostDetailResponse:
    return service.get_blog_post_admin(db, slug)


@admin_router.put("/blogs/{slug}", response_model=AdminBlogPostDetailResponse)
def update_blog_post_admin(
    slug: str,
    payload: AdminBlogPostUpsertRequest,
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminBlogPostDetailResponse:
    return service.update_blog_post_admin(
        db,
        slug=slug,
        payload=payload,
        current_user=current_user,
    )


@admin_router.post("/blogs/{slug}/publish", response_model=AdminBlogPostDetailResponse)
def publish_blog_post_admin(
    slug: str,
    reason: str | None = Query(default=None, min_length=3, max_length=500),
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminBlogPostDetailResponse:
    return service.publish_blog_post_admin(
        db,
        slug=slug,
        current_user=current_user,
        reason=reason,
    )


@admin_router.post("/blogs/{slug}/unpublish", response_model=AdminBlogPostDetailResponse)
def unpublish_blog_post_admin(
    slug: str,
    reason: str | None = Query(default=None, min_length=3, max_length=500),
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminBlogPostDetailResponse:
    return service.unpublish_blog_post_admin(
        db,
        slug=slug,
        current_user=current_user,
        reason=reason,
    )


@admin_router.delete("/blogs/{slug}", response_model=SiteContentActionResponse)
def delete_blog_post_admin(
    slug: str,
    reason: str | None = Query(default=None, min_length=3, max_length=500),
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> SiteContentActionResponse:
    return service.delete_blog_post_admin(
        db,
        slug=slug,
        current_user=current_user,
        reason=reason,
    )


@admin_router.get("/leads/assignees", response_model=SiteContentAdminUserListResponse)
def list_site_content_assignees(
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> SiteContentAdminUserListResponse:
    return service.list_site_content_admin_users(db)


@admin_router.get("/leads", response_model=AdminContactLeadListResponse)
def list_contact_leads_admin(
    search: str | None = Query(default=None, min_length=1, max_length=160),
    status_filter: str | None = Query(default=None, pattern="^(new|reviewed|qualified|closed)$"),
    assigned_to_user_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminContactLeadListResponse:
    return service.list_contact_leads_admin(
        db,
        search=search,
        status_filter=status_filter,
        assigned_to_user_id=assigned_to_user_id,
        limit=limit,
        offset=offset,
    )


@admin_router.patch("/leads/{lead_id}", response_model=AdminContactLeadResponse)
def update_contact_lead_admin(
    lead_id: int,
    payload: AdminContactLeadUpdateRequest,
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> AdminContactLeadResponse:
    return service.update_contact_lead_admin(
        db,
        lead_id=lead_id,
        payload=payload,
        current_user=current_user,
    )


@admin_router.get("/leads/export")
def export_contact_leads_admin(
    search: str | None = Query(default=None, min_length=1, max_length=160),
    status_filter: str | None = Query(default=None, pattern="^(new|reviewed|qualified|closed)$"),
    assigned_to_user_id: int | None = Query(default=None),
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> Response:
    csv_content = service.export_contact_leads_csv(
        db,
        search=search,
        status_filter=status_filter,
        assigned_to_user_id=assigned_to_user_id,
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="site-contact-leads.csv"'},
    )
