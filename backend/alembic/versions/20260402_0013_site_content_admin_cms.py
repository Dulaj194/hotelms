"""add site content admin cms fields

Revision ID: 20260402_0013
Revises: 20260402_0012
Create Date: 2026-04-02 23:10:00
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "20260402_0013"
down_revision = "20260402_0012"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_names(bind, table_name: str) -> set[str]:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _index_names(bind, table_name: str) -> set[str]:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "site_pages"):
        columns = _column_names(bind, "site_pages")
        indexes = _index_names(bind, "site_pages")

        if "published_payload_json" not in columns:
            op.add_column("site_pages", sa.Column("published_payload_json", sa.Text(), nullable=True))
        if "last_published_at" not in columns:
            op.add_column("site_pages", sa.Column("last_published_at", sa.DateTime(timezone=True), nullable=True))
        if "updated_by_user_id" not in columns:
            op.add_column("site_pages", sa.Column("updated_by_user_id", sa.Integer(), nullable=True))
        if "published_by_user_id" not in columns:
            op.add_column("site_pages", sa.Column("published_by_user_id", sa.Integer(), nullable=True))

        indexes = _index_names(bind, "site_pages")
        if "ix_site_pages_updated_by_user_id" not in indexes:
            op.create_index(
                "ix_site_pages_updated_by_user_id",
                "site_pages",
                ["updated_by_user_id"],
                unique=False,
            )
        if "ix_site_pages_published_by_user_id" not in indexes:
            op.create_index(
                "ix_site_pages_published_by_user_id",
                "site_pages",
                ["published_by_user_id"],
                unique=False,
            )

        site_pages = sa.table(
            "site_pages",
            sa.column("id", sa.Integer()),
            sa.column("payload_json", sa.Text()),
            sa.column("published_payload_json", sa.Text()),
            sa.column("is_published", sa.Boolean()),
            sa.column("updated_at", sa.DateTime(timezone=True)),
            sa.column("last_published_at", sa.DateTime(timezone=True)),
        )
        rows = bind.execute(
            sa.select(
                site_pages.c.id,
                site_pages.c.payload_json,
                site_pages.c.published_payload_json,
                site_pages.c.is_published,
                site_pages.c.updated_at,
                site_pages.c.last_published_at,
            )
        ).mappings()
        for row in rows:
            update_values: dict[str, object] = {}
            if row["is_published"] and not row["published_payload_json"]:
                update_values["published_payload_json"] = row["payload_json"]
            if row["is_published"] and row["last_published_at"] is None:
                update_values["last_published_at"] = row["updated_at"]
            if update_values:
                bind.execute(
                    site_pages.update()
                    .where(site_pages.c.id == row["id"])
                    .values(**update_values)
                )

    if _table_exists(bind, "site_blog_posts"):
        columns = _column_names(bind, "site_blog_posts")
        indexes = _index_names(bind, "site_blog_posts")

        blog_columns = [
            ("published_title", sa.String(length=255)),
            ("published_excerpt", sa.Text()),
            ("published_category", sa.String(length=80)),
            ("published_cover_image_url", sa.String(length=500)),
            ("published_tags_json", sa.Text()),
            ("published_body_json", sa.Text()),
            ("published_reading_minutes", sa.Integer()),
            ("published_is_featured", sa.Boolean(), sa.false()),
            ("published_content_at", sa.DateTime(timezone=True)),
            ("last_published_at", sa.DateTime(timezone=True)),
            ("updated_by_user_id", sa.Integer()),
            ("published_by_user_id", sa.Integer()),
        ]
        for column in blog_columns:
            name = column[0]
            if name in columns:
                continue
            if len(column) == 3:
                op.add_column(
                    "site_blog_posts",
                    sa.Column(name, column[1], nullable=True if name != "published_is_featured" else False, server_default=column[2]),
                )
            else:
                op.add_column("site_blog_posts", sa.Column(name, column[1], nullable=True))

        indexes = _index_names(bind, "site_blog_posts")
        if "ix_site_blog_posts_published_category" not in indexes:
            op.create_index(
                "ix_site_blog_posts_published_category",
                "site_blog_posts",
                ["published_category"],
                unique=False,
            )
        if "ix_site_blog_posts_published_content_at" not in indexes:
            op.create_index(
                "ix_site_blog_posts_published_content_at",
                "site_blog_posts",
                ["published_content_at"],
                unique=False,
            )
        if "ix_site_blog_posts_updated_by_user_id" not in indexes:
            op.create_index(
                "ix_site_blog_posts_updated_by_user_id",
                "site_blog_posts",
                ["updated_by_user_id"],
                unique=False,
            )
        if "ix_site_blog_posts_published_by_user_id" not in indexes:
            op.create_index(
                "ix_site_blog_posts_published_by_user_id",
                "site_blog_posts",
                ["published_by_user_id"],
                unique=False,
            )

        site_blog_posts = sa.table(
            "site_blog_posts",
            sa.column("id", sa.Integer()),
            sa.column("title", sa.String(length=255)),
            sa.column("excerpt", sa.Text()),
            sa.column("category", sa.String(length=80)),
            sa.column("cover_image_url", sa.String(length=500)),
            sa.column("tags_json", sa.Text()),
            sa.column("body_json", sa.Text()),
            sa.column("reading_minutes", sa.Integer()),
            sa.column("is_featured", sa.Boolean()),
            sa.column("is_published", sa.Boolean()),
            sa.column("published_at", sa.DateTime(timezone=True)),
            sa.column("updated_at", sa.DateTime(timezone=True)),
            sa.column("published_title", sa.String(length=255)),
            sa.column("published_excerpt", sa.Text()),
            sa.column("published_category", sa.String(length=80)),
            sa.column("published_cover_image_url", sa.String(length=500)),
            sa.column("published_tags_json", sa.Text()),
            sa.column("published_body_json", sa.Text()),
            sa.column("published_reading_minutes", sa.Integer()),
            sa.column("published_is_featured", sa.Boolean()),
            sa.column("published_content_at", sa.DateTime(timezone=True)),
            sa.column("last_published_at", sa.DateTime(timezone=True)),
        )
        rows = bind.execute(
            sa.select(
                site_blog_posts.c.id,
                site_blog_posts.c.title,
                site_blog_posts.c.excerpt,
                site_blog_posts.c.category,
                site_blog_posts.c.cover_image_url,
                site_blog_posts.c.tags_json,
                site_blog_posts.c.body_json,
                site_blog_posts.c.reading_minutes,
                site_blog_posts.c.is_featured,
                site_blog_posts.c.is_published,
                site_blog_posts.c.published_at,
                site_blog_posts.c.updated_at,
                site_blog_posts.c.published_title,
                site_blog_posts.c.published_excerpt,
                site_blog_posts.c.published_category,
                site_blog_posts.c.published_cover_image_url,
                site_blog_posts.c.published_tags_json,
                site_blog_posts.c.published_body_json,
                site_blog_posts.c.published_reading_minutes,
                site_blog_posts.c.published_is_featured,
                site_blog_posts.c.published_content_at,
                site_blog_posts.c.last_published_at,
            )
        ).mappings()
        for row in rows:
            update_values: dict[str, object] = {}
            if row["is_published"]:
                if row["published_title"] is None:
                    update_values["published_title"] = row["title"]
                if row["published_excerpt"] is None:
                    update_values["published_excerpt"] = row["excerpt"]
                if row["published_category"] is None:
                    update_values["published_category"] = row["category"]
                if row["published_cover_image_url"] is None:
                    update_values["published_cover_image_url"] = row["cover_image_url"]
                if row["published_tags_json"] is None:
                    update_values["published_tags_json"] = row["tags_json"] or json.dumps([])
                if row["published_body_json"] is None:
                    update_values["published_body_json"] = row["body_json"] or json.dumps({})
                if row["published_reading_minutes"] is None:
                    update_values["published_reading_minutes"] = row["reading_minutes"]
                if not row["published_is_featured"] and row["is_featured"]:
                    update_values["published_is_featured"] = row["is_featured"]
                if row["published_content_at"] is None:
                    update_values["published_content_at"] = row["published_at"]
                if row["last_published_at"] is None:
                    update_values["last_published_at"] = row["updated_at"]
            if update_values:
                bind.execute(
                    site_blog_posts.update()
                    .where(site_blog_posts.c.id == row["id"])
                    .values(**update_values)
                )

    if _table_exists(bind, "contact_leads"):
        columns = _column_names(bind, "contact_leads")
        indexes = _index_names(bind, "contact_leads")

        if "assigned_to_user_id" not in columns:
            op.add_column("contact_leads", sa.Column("assigned_to_user_id", sa.Integer(), nullable=True))
        if "internal_notes" not in columns:
            op.add_column("contact_leads", sa.Column("internal_notes", sa.Text(), nullable=True))

        indexes = _index_names(bind, "contact_leads")
        if "ix_contact_leads_assigned_to_user_id" not in indexes:
            op.create_index(
                "ix_contact_leads_assigned_to_user_id",
                "contact_leads",
                ["assigned_to_user_id"],
                unique=False,
            )


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "contact_leads"):
        indexes = _index_names(bind, "contact_leads")
        with op.batch_alter_table("contact_leads") as batch_op:
            if "ix_contact_leads_assigned_to_user_id" in indexes:
                batch_op.drop_index("ix_contact_leads_assigned_to_user_id")
            columns = _column_names(bind, "contact_leads")
            if "internal_notes" in columns:
                batch_op.drop_column("internal_notes")
            if "assigned_to_user_id" in columns:
                batch_op.drop_column("assigned_to_user_id")

    if _table_exists(bind, "site_blog_posts"):
        indexes = _index_names(bind, "site_blog_posts")
        with op.batch_alter_table("site_blog_posts") as batch_op:
            if "ix_site_blog_posts_published_by_user_id" in indexes:
                batch_op.drop_index("ix_site_blog_posts_published_by_user_id")
            if "ix_site_blog_posts_updated_by_user_id" in indexes:
                batch_op.drop_index("ix_site_blog_posts_updated_by_user_id")
            if "ix_site_blog_posts_published_content_at" in indexes:
                batch_op.drop_index("ix_site_blog_posts_published_content_at")
            if "ix_site_blog_posts_published_category" in indexes:
                batch_op.drop_index("ix_site_blog_posts_published_category")
            columns = _column_names(bind, "site_blog_posts")
            for column_name in [
                "published_title",
                "published_excerpt",
                "published_category",
                "published_cover_image_url",
                "published_tags_json",
                "published_body_json",
                "published_reading_minutes",
                "published_is_featured",
                "published_content_at",
                "last_published_at",
                "updated_by_user_id",
                "published_by_user_id",
            ]:
                if column_name in columns:
                    batch_op.drop_column(column_name)

    if _table_exists(bind, "site_pages"):
        indexes = _index_names(bind, "site_pages")
        with op.batch_alter_table("site_pages") as batch_op:
            if "ix_site_pages_published_by_user_id" in indexes:
                batch_op.drop_index("ix_site_pages_published_by_user_id")
            if "ix_site_pages_updated_by_user_id" in indexes:
                batch_op.drop_index("ix_site_pages_updated_by_user_id")
            columns = _column_names(bind, "site_pages")
            for column_name in [
                "published_payload_json",
                "last_published_at",
                "updated_by_user_id",
                "published_by_user_id",
            ]:
                if column_name in columns:
                    batch_op.drop_column(column_name)
