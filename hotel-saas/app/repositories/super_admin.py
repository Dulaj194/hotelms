"""
Super admin repository.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models import SuperAdmin
from app.repositories.base import BaseRepository


class SuperAdminRepository(BaseRepository[SuperAdmin]):
    """Data access helper for platform super admins."""

    def __init__(self, db: Session):
        super().__init__(db, SuperAdmin)

    # Super admin is a platform-level entity, so this does not use tenant context.
    def find_by_email(self, email: str) -> Optional[SuperAdmin]:
        return self.db.query(self.model).filter(self.model.email == email).first()

    def get_by_id(self, super_admin_id: int) -> Optional[SuperAdmin]:
        return self.db.query(self.model).filter(
            self.model.super_admin_id == super_admin_id
        ).first()
