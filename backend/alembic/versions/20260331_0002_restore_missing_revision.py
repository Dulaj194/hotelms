"""restore missing revision marker for local environments

Revision ID: 20260331_0002
Revises: 20260327_0001
Create Date: 2026-03-31 00:02:00
"""

from __future__ import annotations

# revision identifiers, used by Alembic.
revision = "20260331_0002"
down_revision = "20260327_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Compatibility revision: the baseline migration already creates the
    # current schema for fresh databases, while some local databases were
    # stamped with this revision id before the file was lost.
    pass


def downgrade() -> None:
    pass
