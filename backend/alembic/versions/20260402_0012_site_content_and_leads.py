"""add public site content and contact leads

Revision ID: 20260402_0012
Revises: 20260402_0011
Create Date: 2026-04-02 19:05:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260402_0012"
down_revision = "20260402_0011"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _contact_lead_status_enum() -> sa.Enum:
    return sa.Enum(
        "new",
        "reviewed",
        "qualified",
        "closed",
        name="contactleadstatus",
        native_enum=False,
    )


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "site_pages"):
        op.create_table(
            "site_pages",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("slug", sa.String(length=50), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("summary", sa.String(length=500), nullable=True),
            sa.Column("payload_json", sa.Text(), nullable=False),
            sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.UniqueConstraint("slug", name="uq_site_pages_slug"),
        )
        op.create_index("ix_site_pages_slug", "site_pages", ["slug"], unique=False)

    if not _table_exists(bind, "site_blog_posts"):
        op.create_table(
            "site_blog_posts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("slug", sa.String(length=120), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("excerpt", sa.Text(), nullable=False),
            sa.Column("category", sa.String(length=80), nullable=False),
            sa.Column("cover_image_url", sa.String(length=500), nullable=True),
            sa.Column("tags_json", sa.Text(), nullable=False),
            sa.Column("body_json", sa.Text(), nullable=False),
            sa.Column("reading_minutes", sa.Integer(), nullable=False, server_default="4"),
            sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.UniqueConstraint("slug", name="uq_site_blog_posts_slug"),
        )
        op.create_index("ix_site_blog_posts_slug", "site_blog_posts", ["slug"], unique=False)
        op.create_index(
            "ix_site_blog_posts_category",
            "site_blog_posts",
            ["category"],
            unique=False,
        )
        op.create_index(
            "ix_site_blog_posts_published_at",
            "site_blog_posts",
            ["published_at"],
            unique=False,
        )

    if not _table_exists(bind, "contact_leads"):
        op.create_table(
            "contact_leads",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("full_name", sa.String(length=120), nullable=False),
            sa.Column("email", sa.String(length=191), nullable=False),
            sa.Column("phone", sa.String(length=50), nullable=True),
            sa.Column("company_name", sa.String(length=150), nullable=True),
            sa.Column("property_type", sa.String(length=80), nullable=True),
            sa.Column("subject", sa.String(length=150), nullable=True),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("source_page", sa.String(length=50), nullable=True),
            sa.Column(
                "status",
                _contact_lead_status_enum(),
                nullable=False,
                server_default="new",
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )
        op.create_index("ix_contact_leads_email", "contact_leads", ["email"], unique=False)
        op.create_index("ix_contact_leads_status", "contact_leads", ["status"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "contact_leads"):
        op.drop_index("ix_contact_leads_status", table_name="contact_leads")
        op.drop_index("ix_contact_leads_email", table_name="contact_leads")
        op.drop_table("contact_leads")

    if _table_exists(bind, "site_blog_posts"):
        op.drop_index("ix_site_blog_posts_published_at", table_name="site_blog_posts")
        op.drop_index("ix_site_blog_posts_category", table_name="site_blog_posts")
        op.drop_index("ix_site_blog_posts_slug", table_name="site_blog_posts")
        op.drop_table("site_blog_posts")

    if _table_exists(bind, "site_pages"):
        op.drop_index("ix_site_pages_slug", table_name="site_pages")
        op.drop_table("site_pages")
