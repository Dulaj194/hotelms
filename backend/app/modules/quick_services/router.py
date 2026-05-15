from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.core.dependencies import get_current_user
from app.modules.quick_services.schemas import (
    QuickServiceCreate,
    QuickServiceResponse,
    QuickServiceUpdate,
)
from app.modules.quick_services.service import QuickServiceService
from app.modules.users.model import User

router = APIRouter()


@router.get("", response_model=List[QuickServiceResponse])
async def list_quick_services(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all quick services for the current restaurant (Admin)."""
    service = QuickServiceService(session)
    return await service.get_restaurant_services(current_user.restaurant_id)


@router.post("", response_model=QuickServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_quick_service(
    data: QuickServiceCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new quick service button (Admin)."""
    service = QuickServiceService(session)
    return await service.create_service(current_user.restaurant_id, data)


@router.put("/{service_id}", response_model=QuickServiceResponse)
async def update_quick_service(
    service_id: int,
    data: QuickServiceUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update a quick service button (Admin)."""
    service = QuickServiceService(session)
    return await service.update_service(current_user.restaurant_id, service_id, data)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quick_service(
    service_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a quick service button (Admin)."""
    service = QuickServiceService(session)
    await service.delete_service(current_user.restaurant_id, service_id)
    return None


# Public endpoint for guests
public_router = APIRouter()

@public_router.get("/{restaurant_id}", response_model=List[QuickServiceResponse])
async def list_public_quick_services(
    restaurant_id: int,
    session: AsyncSession = Depends(get_session),
):
    """List active quick services for guests."""
    service = QuickServiceService(session)
    return await service.get_restaurant_services(restaurant_id, active_only=True)
