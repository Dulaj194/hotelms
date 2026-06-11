from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
import app.db.init_models  # noqa: F401
from app.db.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Source database URL from application settings so Alembic and app stay in sync.
config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = Base.metadata

from alembic.operations import Operations
from sqlalchemy.exc import OperationalError

original_add_column = Operations.add_column
original_create_table = Operations.create_table
original_create_index = Operations.create_index

def safe_add_column(self, table_name, column, schema=None):
    try:
        original_add_column(self, table_name, column, schema=schema)
    except OperationalError as e:
        if getattr(e.orig, "args", [0])[0] == 1060:
            print(f"Skipping duplicate column '{column.name}' in table '{table_name}'")
        else:
            raise

def safe_create_table(self, table_name, *columns, **kw):
    try:
        return original_create_table(self, table_name, *columns, **kw)
    except OperationalError as e:
        if getattr(e.orig, "args", [0])[0] == 1050:
            print(f"Skipping duplicate table '{table_name}'")
        else:
            raise

def safe_create_index(self, index_name, table_name, columns, **kw):
    try:
        original_create_index(self, index_name, table_name, columns, **kw)
    except OperationalError as e:
        if getattr(e.orig, "args", [0])[0] == 1061:
            print(f"Skipping duplicate index '{index_name}'")
        else:
            raise

Operations.add_column = safe_add_column
Operations.create_table = safe_create_table
Operations.create_index = safe_create_index

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
