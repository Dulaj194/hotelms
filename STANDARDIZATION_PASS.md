# Standardization Pass (HotelMS)

This document defines a practical standard for the current project without forcing a risky full refactor.

## 1) What is now standardized

- **Schema changes** must go through Alembic migrations.
- **DB naming** must be `snake_case` for table/column names.
- **API wiring** requires each `modules/*/router.py` to be registered in `app/api/router.py`.
- **Secrets in compose** must use environment interpolation (`${...}`), not hardcoded values.
- **Production guardrails** block weak `SECRET_KEY` and `DB_AUTO_SCHEMA_SYNC=true`.

## 2) Current structure assessment

The existing structure is **good enough for scale** and can continue safely with standards:

- Backend is already feature-module oriented (`app/modules/<feature>`).
- Frontend is domain-oriented under `frontend/src/*`.
- Data flow is clear: `router -> service -> repository -> model`.

No urgent folder move is required now. The priority is consistency and automation.

## 3) Recommended target structure (incremental)

### Backend

```text
backend/
  app/
    api/
      router.py
    core/
    db/
    modules/
      <feature>/
        model.py
        schemas.py
        repository.py
        service.py
        router.py
  alembic/
  scripts/
  tests/
```

### Frontend

```text
frontend/src/
  pages/
    admin/
    auth/
    public/
  components/shared/
  hooks/
  lib/
  types/
```

## 4) Data flow standard

1. Router validates request + auth context.
2. Service enforces business rules and orchestration.
3. Repository handles DB queries only.
4. Models stay persistence-focused; avoid business logic there.
5. Emit audit/event logs at service layer for state transitions.

## 5) Add-feature checklist

1. Create/extend module files (`schemas/repository/service/router/model`).
2. Register new router in `app/api/router.py`.
3. Add Alembic migration for schema changes.
4. Add at least one unit test for business rule.
5. Run standardization checks before merge.

## 6) Commands

From project root:

```bash
# Fast checks (no live DB required)
backend/venv/Scripts/python.exe backend/scripts/standardization_pass.py --skip-db

# Full checks (includes schema drift against DATABASE_URL)
backend/venv/Scripts/python.exe backend/scripts/standardization_pass.py
```

