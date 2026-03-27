# Alembic Migrations

Use Alembic as the single source of truth for schema changes.

## Initialize / Upgrade

```bash
cd backend
alembic upgrade head
```

## Create A New Migration

```bash
cd backend
alembic revision --autogenerate -m "describe_change"
```

## Downgrade One Step

```bash
cd backend
alembic downgrade -1
```

## Notes

- `app.main` no longer assumes automatic schema creation.
- `DB_AUTO_SCHEMA_SYNC=true` can be used only as a temporary legacy fallback in development.
- Keep migrations deterministic and review generated SQL before applying in production.
