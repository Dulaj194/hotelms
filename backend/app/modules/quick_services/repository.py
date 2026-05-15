from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.modules.quick_services.model import QuickService

class QuickServiceRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_by_restaurant(self, restaurant_id: int, active_only: bool = False) -> List[QuickService]:
        query = select(QuickService).where(QuickService.restaurant_id == restaurant_id)
        if active_only:
            query = query.where(QuickService.is_active == True)
        
        query = query.order_by(QuickService.sort_order.asc(), QuickService.id.asc())
        return list(self.db.execute(query).scalars().all())

    def get_by_id(self, service_id: int) -> Optional[QuickService]:
        return self.db.query(QuickService).filter(QuickService.id == service_id).first()

    def create(self, restaurant_id: int, data: dict) -> QuickService:
        service = QuickService(restaurant_id=restaurant_id, **data)
        self.db.add(service)
        self.db.commit()
        self.db.refresh(service)
        return service

    def update(self, service: QuickService, data: dict) -> QuickService:
        for key, value in data.items():
            if value is not None:
                setattr(service, key, value)
        self.db.commit()
        self.db.refresh(service)
        return service

    def delete(self, service: QuickService) -> None:
        self.db.delete(service)
        self.db.commit()
