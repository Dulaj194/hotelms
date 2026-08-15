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
from app.core.response_schemas import ApiResponse
from app.core.response_utils import success_response
from app.core.pagination import PaginationParams, pagination_depends, create_paginated_response
from app.modules.users.model import User

router = APIRouter()
admin_router = APIRouter()


@router.get("/landing", response_model=ApiResponse[LandingPageResponse])
def get_landing_page(db: Session = Depends(get_db)) -> ApiResponse:
    return success_response(data=service.get_landing_page(db), message="Landing page retrieved")


@router.get("/about", response_model=ApiResponse[AboutPageResponse])
def get_about_page(db: Session = Depends(get_db)) -> ApiResponse:
    return success_response(data=service.get_about_page(db), message="About page retrieved")


@router.get("/contact", response_model=ApiResponse[ContactPageResponse])
def get_contact_page(db: Session = Depends(get_db)) -> ApiResponse:
    return success_response(data=service.get_contact_page(db), message="Contact page retrieved")


@router.post(
    "/contact",
    response_model=ApiResponse[ContactLeadCreateResponse],
    status_code=status.HTTP_201_CREATED,
)
def submit_contact_lead(
    payload: ContactLeadCreateRequest,
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.submit_contact_lead(db, payload), message="Lead submitted")


@router.get("/blogs", response_model=ApiResponse[BlogListResponse])
def list_blogs(
    search: str | None = Query(default=None, min_length=1, max_length=120),
    category: str | None = Query(default=None, min_length=1, max_length=80),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.list_blogs(db, search=search, category=category), message="Blogs retrieved")


@router.get("/blogs/categories", response_model=ApiResponse[BlogCategoryListResponse])
def list_blog_categories(db: Session = Depends(get_db)) -> ApiResponse:
    return success_response(data=service.list_blog_categories(db), message="Categories retrieved")


@router.get("/blogs/recent", response_model=ApiResponse[list[BlogPostSummaryResponse]])
def list_recent_blogs(
    limit: int = Query(default=3, ge=1, le=6),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.list_recent_blogs(db, limit=limit), message="Recent blogs retrieved")


@router.get("/blogs/{slug}", response_model=ApiResponse[BlogPostDetailResponse])
def get_blog_post(slug: str, db: Session = Depends(get_db)) -> ApiResponse:
    return success_response(data=service.get_blog_post(db, slug), message="Blog post retrieved")


@admin_router.get("/pages", response_model=ApiResponse)
def list_site_pages_admin(
    pagination: PaginationParams = Depends(pagination_depends),
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    items, total = service.list_site_pages_admin(db)
    # Even though pages aren't paginated in service, wrap them properly
    paginated_data = create_paginated_response(items, total, pagination.page, pagination.limit)
    return success_response(data=paginated_data, message="Pages retrieved")


@admin_router.get("/pages/{slug}", response_model=ApiResponse[AdminSitePageDetailResponse])
def get_site_page_admin(
    slug: str,
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.get_site_page_admin(db, slug), message="Page retrieved")


@admin_router.put("/pages/{slug}", response_model=ApiResponse[AdminSitePageDetailResponse])
def update_site_page_admin(
    slug: str,
    payload: AdminSitePageUpdateRequest,
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.update_site_page_admin(
        db,
        slug=slug,
        payload=payload,
        current_user=current_user,
    ), message="Page updated")


@admin_router.post("/pages/{slug}/publish", response_model=ApiResponse[AdminSitePageDetailResponse])
def publish_site_page_admin(
    slug: str,
    reason: str | None = Query(default=None, min_length=3, max_length=500),
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.publish_site_page_admin(
        db,
        slug=slug,
        current_user=current_user,
        reason=reason,
    ), message="Page published")


@admin_router.post("/pages/{slug}/unpublish", response_model=ApiResponse[AdminSitePageDetailResponse])
def unpublish_site_page_admin(
    slug: str,
    reason: str | None = Query(default=None, min_length=3, max_length=500),
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.unpublish_site_page_admin(
        db,
        slug=slug,
        current_user=current_user,
        reason=reason,
    ), message="Page unpublished")


@admin_router.get("/blogs", response_model=ApiResponse)
def list_blog_posts_admin(
    pagination: PaginationParams = Depends(pagination_depends),
    search: str | None = Query(default=None, min_length=1, max_length=120),
    category: str | None = Query(default=None, min_length=1, max_length=80),
    is_published: bool | None = Query(default=None),
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    items, total = service.list_blog_posts_admin(
        db,
        search=search,
        category=category,
        is_published=is_published,
        skip=pagination.skip,
        limit=pagination.limit,
    )
    paginated_data = create_paginated_response(items, total, pagination.page, pagination.limit)
    return success_response(data=paginated_data, message="Blog posts retrieved")


@admin_router.post(
    "/blogs",
    response_model=ApiResponse[AdminBlogPostDetailResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_blog_post_admin(
    payload: AdminBlogPostUpsertRequest,
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.create_blog_post_admin(db, payload=payload, current_user=current_user), message="Blog post created")


@admin_router.get("/blogs/{slug}", response_model=ApiResponse[AdminBlogPostDetailResponse])
def get_blog_post_admin(
    slug: str,
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.get_blog_post_admin(db, slug), message="Blog post retrieved")


@admin_router.put("/blogs/{slug}", response_model=ApiResponse[AdminBlogPostDetailResponse])
def update_blog_post_admin(
    slug: str,
    payload: AdminBlogPostUpsertRequest,
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.update_blog_post_admin(
        db,
        slug=slug,
        payload=payload,
        current_user=current_user,
    ), message="Blog post updated")


@admin_router.post("/blogs/{slug}/publish", response_model=ApiResponse[AdminBlogPostDetailResponse])
def publish_blog_post_admin(
    slug: str,
    reason: str | None = Query(default=None, min_length=3, max_length=500),
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.publish_blog_post_admin(
        db,
        slug=slug,
        current_user=current_user,
        reason=reason,
    ), message="Blog post published")


@admin_router.post("/blogs/{slug}/unpublish", response_model=ApiResponse[AdminBlogPostDetailResponse])
def unpublish_blog_post_admin(
    slug: str,
    reason: str | None = Query(default=None, min_length=3, max_length=500),
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.unpublish_blog_post_admin(
        db,
        slug=slug,
        current_user=current_user,
        reason=reason,
    ), message="Blog post unpublished")


@admin_router.delete("/blogs/{slug}", response_model=ApiResponse[SiteContentActionResponse])
def delete_blog_post_admin(
    slug: str,
    reason: str | None = Query(default=None, min_length=3, max_length=500),
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.delete_blog_post_admin(
        db,
        slug=slug,
        current_user=current_user,
        reason=reason,
    ), message="Blog post deleted")


@admin_router.get("/leads/assignees", response_model=ApiResponse[SiteContentAdminUserListResponse])
def list_site_content_assignees(
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.list_site_content_admin_users(db), message="Assignees retrieved")


@admin_router.get("/leads", response_model=ApiResponse)
def list_contact_leads_admin(
    pagination: PaginationParams = Depends(pagination_depends),
    search: str | None = Query(default=None, min_length=1, max_length=160),
    status_filter: str | None = Query(default=None, pattern="^(new|reviewed|qualified|closed)$"),
    assigned_to_user_id: int | None = Query(default=None),
    _current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    items, total, summary = service.list_contact_leads_admin(
        db,
        search=search,
        status_filter=status_filter,
        assigned_to_user_id=assigned_to_user_id,
        skip=pagination.skip,
        limit=pagination.limit,
    )
    paginated_data = create_paginated_response(items, total, pagination.page, pagination.limit)
    paginated_data["summary"] = summary
    return success_response(data=paginated_data, message="Contact leads retrieved")


@admin_router.patch("/leads/{lead_id}", response_model=ApiResponse[AdminContactLeadResponse])
def update_contact_lead_admin(
    lead_id: int,
    payload: AdminContactLeadUpdateRequest,
    current_user: User = Depends(require_platform_scopes("tenant_admin")),
    db: Session = Depends(get_db),
) -> ApiResponse:
    return success_response(data=service.update_contact_lead_admin(
        db,
        lead_id=lead_id,
        payload=payload,
        current_user=current_user,
    ), message="Lead updated")


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
