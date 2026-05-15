from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.quick_services.model import QuickService


class QuickServiceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all_by_restaurant(self, restaurant_id: int, active_only: bool = False) -> List[QuickService]:
        query = select(QuickService).where(QuickService.restaurant_id == restaurant_id)
        if active_only:
            query = query.where(QuickService.is_active == True)
        
        query = query.order_by(QuickService.sort_order.asc(), QuickService.id.asc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_by_id(self, service_id: int) -> Optional[QuickService]:
        query = select(QuickService).where(QuickService.id == service_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def create(self, restaurant_id: int, data: dict) -> QuickService:
        service = QuickService(restaurant_id=restaurant_id, **data)
        self.session.add(service)
        await self.session.flush()
        await self.session.refresh(service)
        return service

    async def update(self, service: QuickService, data: dict) -> QuickService:
        for key, value in data.items():
            if value is not None:
                setattr(service, key, value)
        await self.session.flush()
        await self.session.refresh(service)
        return service

    async def delete(self, service: QuickService) -> None:
        await self.session.delete(service)
        await self.session.flush()
