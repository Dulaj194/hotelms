from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.modules.site_content import service
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

router = APIRouter()


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
