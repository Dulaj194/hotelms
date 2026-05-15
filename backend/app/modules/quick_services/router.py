from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.modules.quick_services.schemas import (
    QuickServiceCreate,
    QuickServiceResponse,
    QuickServiceUpdate,
)
from app.modules.quick_services.service import QuickServiceService
from app.modules.users.model import User

router = APIRouter()

@router.get("", response_model=List[QuickServiceResponse])
def list_quick_services(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all quick services for the current restaurant (Admin)."""
    service = QuickServiceService(db)
    return service.get_restaurant_services(current_user.restaurant_id)

@router.post("", response_model=QuickServiceResponse, status_code=status.HTTP_201_CREATED)
def create_quick_service(
    data: QuickServiceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new quick service button (Admin)."""
    service = QuickServiceService(db)
    return service.create_service(current_user.restaurant_id, data)

@router.put("/{service_id}", response_model=QuickServiceResponse)
def update_quick_service(
    service_id: int,
    data: QuickServiceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a quick service button (Admin)."""
    service = QuickServiceService(db)
    return service.update_service(current_user.restaurant_id, service_id, data)

@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quick_service(
    service_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a quick service button (Admin)."""
    service = QuickServiceService(db)
    service.delete_service(current_user.restaurant_id, service_id)
    return None

# Public endpoint for guests
public_router = APIRouter()

@public_router.get("/{restaurant_id}", response_model=List[QuickServiceResponse])
def list_public_quick_services(
    restaurant_id: int,
    db: Session = Depends(get_db),
):
    """List active quick services for guests."""
    service = QuickServiceService(db)
    return service.get_restaurant_services(restaurant_id, active_only=True)
