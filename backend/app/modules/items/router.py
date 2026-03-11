from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.modules.items import service
from app.modules.items.schemas import ItemCreateRequest, ItemResponse, ItemUpdateRequest
from app.modules.users.model import User

router = APIRouter()


@router.get("", response_model=list[ItemResponse])
def list_items(
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> list[ItemResponse]:
    return service.list_items(db, current_user.restaurant_id)  # type: ignore[arg-type]


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def add_item(
    payload: ItemCreateRequest,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> ItemResponse:
    """SECURITY: restaurant_id comes from token. category ownership verified server-side."""
    if current_user.restaurant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No restaurant context.")
    return service.add_item(db, current_user.restaurant_id, payload)


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(
    item_id: int,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> ItemResponse:
    return service.get_item(db, item_id, current_user.restaurant_id)  # type: ignore[arg-type]


@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int,
    payload: ItemUpdateRequest,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> ItemResponse:
    return service.update_item(db, item_id, current_user.restaurant_id, payload)  # type: ignore[arg-type]


@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    current_user: User = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> dict:
    return service.delete_item(db, item_id, current_user.restaurant_id)  # type: ignore[arg-type]
