from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.quick_services.repository import QuickServiceRepository
from app.modules.quick_services.schemas import QuickServiceCreate, QuickServiceUpdate
from app.modules.quick_services.model import QuickService


class QuickServiceService:
    def __init__(self, session: AsyncSession):
        self.repo = QuickServiceRepository(session)

    async def get_restaurant_services(self, restaurant_id: int, active_only: bool = False) -> List[QuickService]:
        return await self.repo.get_all_by_restaurant(restaurant_id, active_only)

    async def create_service(self, restaurant_id: int, data: QuickServiceCreate) -> QuickService:
        return await self.repo.create(restaurant_id, data.model_dump())

    async def update_service(self, restaurant_id: int, service_id: int, data: QuickServiceUpdate) -> QuickService:
        service = await self.repo.get_by_id(service_id)
        if not service or service.restaurant_id != restaurant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quick service not found"
            )
        
        return await self.repo.update(service, data.model_dump(exclude_unset=True))

    async def delete_service(self, restaurant_id: int, service_id: int) -> None:
        service = await self.repo.get_by_id(service_id)
        if not service or service.restaurant_id != restaurant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quick service not found"
            )
        
        await self.repo.delete(service)
