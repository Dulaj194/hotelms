from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.modules.quick_services.repository import QuickServiceRepository
from app.modules.quick_services.schemas import QuickServiceCreate, QuickServiceUpdate
from app.modules.quick_services.model import QuickService

class QuickServiceService:
    def __init__(self, db: Session):
        self.repo = QuickServiceRepository(db)

    def get_restaurant_services(self, restaurant_id: int, active_only: bool = False) -> List[QuickService]:
        return self.repo.get_all_by_restaurant(restaurant_id, active_only)

    def create_service(self, restaurant_id: int, data: QuickServiceCreate) -> QuickService:
        return self.repo.create(restaurant_id, data.model_dump())

    def update_service(self, restaurant_id: int, service_id: int, data: QuickServiceUpdate) -> QuickService:
        service = self.repo.get_by_id(service_id)
        if not service or service.restaurant_id != restaurant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quick service not found"
            )
        
        return self.repo.update(service, data.model_dump(exclude_unset=True))

    def delete_service(self, restaurant_id: int, service_id: int) -> None:
        service = self.repo.get_by_id(service_id)
        if not service or service.restaurant_id != restaurant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quick service not found"
            )
        
        self.repo.delete(service)
