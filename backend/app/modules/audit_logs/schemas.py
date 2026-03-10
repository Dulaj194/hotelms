from datetime import datetime

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    user_id: int | None
    event_type: str
    ip_address: str | None
    user_agent: str | None
    metadata_json: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
