# Import all ORM models here so SQLAlchemy Base.metadata is fully populated.
# This file must be imported once at startup to enable:
#   - Base.metadata.create_all()  (development table creation)
#   - Alembic autogenerate        (migration generation)

from app.modules.audit_logs.model import AuditLog  # noqa: F401
from app.modules.auth.model import PasswordResetToken  # noqa: F401
from app.modules.restaurants.model import Restaurant  # noqa: F401
from app.modules.users.model import User  # noqa: F401
