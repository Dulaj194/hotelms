# Project Architecture Comparison: Anawuma Restaurant App vs. HotelMS

## Executive Summary

This document provides a detailed comparison of two hospitality management platforms: the **Anawuma Restaurant App** (reference/template) and the **HotelMS** (current active project). The key difference is architectural maturity: Anawuma is a monolithic NestJS/React architecture, while HotelMS represents a more modular, scalable evolution using FastAPI/TypeScript with clear separation of concerns.

---

## 1. BACKEND ARCHITECTURE

### Anawuma Restaurant Backend (NestJS)

**Location:** `Anawuma-Resturant-App-/restaurant-backend-nestjs/`

**Technology Stack:**
- Runtime: Node.js with NestJS v11
- Database: MySQL 8.0 (TypeORM)
- ORM: TypeORM with auto-entity loading
- Authentication: Passport.js (JWT strategy)
- Real-time: Socket.io
- Rate Limiting: NestJS Throttler
- Code Generation: Class Validators & Class Transformer

**Module Structure (22 modules):**
```
src/
├── auth/           (Auth with decorators, guards, strategies)
├── orders/         (DTOs, entities, service, controller)
├── billing/        (Migration tracking, API documentation)
├── restaurants/    (Test coverage with .spec.ts)
├── menus/
├── categories/
├── subcategories/
├── food-items/
├── table-qr/
├── room-qr/
├── housekeeping/
├── offers/
├── reports/
├── dashboard/
├── pricing/
├── blog/
├── about/
├── contact/
├── settings-requests/
├── common/         (Shared utilities)
├── config/         (Configuration)
├── websocket/
└── scripts/        (Maintenance scripts)
```

**Architecture Pattern:**
```
Controller (HTTP routing)
  ↓
Service (Business logic)
  ↓
Repository/ORM (Data access via TypeORM)
  ↓
Entity (Database models)
```

**Key Features:**
- Each module has dedicated DTOs, entities, controllers, services
- Spec files alongside implementations (.spec.ts)
- Global guards (Throttler) applied via APP_GUARD
- Environment-based config via ConfigModule
- Auto-synchronization enabled in development

**Module Structure Example (auth/):**
```
auth/
├── auth.controller.ts
├── auth.controller.spec.ts
├── auth.service.ts
├── auth.service.spec.ts
├── auth.module.ts
├── decorators/          (Custom decorators like @GetRestaurant())
├── dto/                 (Data transfer objects)
├── entities/            (TypeORM models)
├── enums/
├── guards/              (JWT guard, role-based guards)
├── interfaces/
└── strategies/          (Passport strategies)
```

---

### HotelMS Backend (FastAPI)

**Location:** `backend/app/`

**Technology Stack:**
- Runtime: Python 3.11+ with FastAPI
- Database: MySQL 8 (SQLAlchemy ORM)
- ORM: SQLAlchemy 2.0+
- Authentication: jose JWT + Passlib bcrypt
- Real-time: Redis + WebSocket (async)
- Caching: Redis 7
- Task Queue: Background workers
- Migrations: Alembic

**Module Structure (32 modules):**
```
app/
├── api/
│   └── router.py        (Central route aggregator)
├── core/
│   ├── config.py        (Settings management)
│   ├── dependencies.py   (FastAPI dependency injection)
│   ├── security.py       (JWT, password hashing)
│   ├── notifications.py  (Event-based notifications)
│   ├── logging.py
│   ├── file_storage.py
│   └── __init__.py
├── db/
│   ├── session.py
│   ├── base.py
│   ├── init_models.py
│   ├── schema_sync.py    (Development schema synchronization)
│   └── migrations/       (Alembic versions)
├── modules/             (32 domain modules)
│   ├── access/          (Module-level access control)
│   ├── audit_logs/
│   ├── auth/
│   │   ├── login_scope.py    (Advanced login context/scoping)
│   │   ├── registration_repository.py
│   │   ├── model.py
│   │   ├── repository.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   ├── service.py
│   │   └── __init__.py
│   ├── billing/
│   │   ├── model.py          (Complex billing state machine)
│   │   ├── repository.py      (Bill queries, workflow events)
│   │   ├── router.py
│   │   ├── schemas.py
│   │   ├── service.py
│   │   └── migrations/
│   ├── cart/
│   ├── categories/
│   ├── dashboard/
│   ├── housekeeping/
│   ├── items/
│   ├── menus/
│   ├── offers/
│   ├── orders/
│   ├── packages/
│   ├── payments/
│   ├── platform_access/
│   ├── promo_codes/
│   ├── public/
│   ├── qr/
│   ├── realtime/
│   ├── reference_data/
│   ├── reports/
│   ├── restaurants/
│   ├── rooms/
│   ├── room_sessions/
│   ├── settings/
│   ├── site_content/
│   ├── subcategories/
│   ├── subscriptions/
│   ├── table_sessions/
│   ├── users/
│   └── __init__.py
├── workers/
│   ├── subscription_expiry.py
│   └── __init__.py
├── main.py              (FastAPI app with lifespan)
└── __init__.py
```

**Architecture Pattern:**
```
Router (HTTP routing per module)
  ↓
Service (Business logic, complex workflows)
  ↓
Repository (Data queries, state management)
  ↓
Model (SQLAlchemy ORM models)
```

**Key Features:**
- **Monolithic yet modular:** 32 focused domain modules, not just CRUD
- **Advanced authentication:** Login scope context, multi-tenant support
- **Repository pattern:** Explicit data access queries vs ORM's auto-loading
- **Dependency injection:** FastAPI's `Depends()` for clean injection
- **Lifespan management:** Proper startup/shutdown hooks
- **Alembic migrations:** Version-controlled schema changes (no auto-sync)
- **Advanced features:** Module access control, platform_access, subscriptions, room_sessions (hotel-specific)
- **Worker processes:** Background tasks for expiry loops

**Module Pattern Example (orders/):**
```
orders/
├── model.py         (SQLAlchemy models, enums, status states)
├── repository.py    (Explicit query functions)
├── router.py        (Route definitions with detailed docstrings)
├── schemas.py       (Pydantic response/request schemas)
├── service.py       (Business logic orchestration)
└── __init__.py
```

---

## 2. DATABASE & PERSISTENCE

| Aspect | Anawuma (NestJS) | HotelMS (FastAPI) |
|--------|------------------|-------------------|
| **DB Engine** | MySQL 8.0 with TypeORM | MySQL 8 with SQLAlchemy 2.0+ |
| **Schema Sync** | Auto-sync (dev only) | Alembic migrations (explicit) |
| **Migrations** | TypeORM synchronize flag | Alembic versions directory |
| **Caching** | In-memory or Redis (via modules) | Redis 7 explicitly integrated |
| **Connection Pool** | TypeORM defaults | SQLAlchemy session management |
| **Models** | TypeORM entities with decorators | SQLAlchemy ORM classes |

**HotelMS Advantages:**
- Explicit version control via Alembic
- Redis integration built-in for caching
- Clear separation of concerns (repository layer)

---

## 3. FRONTEND ARCHITECTURE

### Anawuma Restaurant Frontend (React)

**Location:** `Anawuma-Resturant-App-/restaurant-frontend/`

**Technology Stack:**
- Framework: React 19.2 (class/functional components)
- Build: Create React App (react-scripts)
- Routing: React Router v7
- HTTP Client: Axios
- UI Framework: React Bootstrap + Bootstrap 5
- State Management: Zustand 5.0
- Animations: Framer Motion
- Real-time: Socket.io-client
- Testing: Jest + Testing Library
- Build Size: Traditional CRA bundle

**Directory Structure:**
```
src/
├── components/          (Component library)
│   ├── auth/
│   ├── categories/
│   ├── common/
│   ├── food-items/
│   ├── landing/
│   ├── menus/
│   ├── orders/
│   ├── register/
│   └── subcategories/
├── pages/              (64+ page components)
│   ├── AboutPage.js
│   ├── AccountantDashboard.js
│   ├── ActiveOrders.js
│   ├── AddAdmin.js
│   ├── AddCategory.js
│   ├── AddFoodItem.js
│   ├── Dashboard.js
│   ├── KitchenDashboard.js
│   ├── KitchenKDS.js
│   ├── CustomerQROrder.js
│   └── ... (50+ more)
├── hooks/              (Custom React hooks)
├── store/              (Zustand state)
├── App.js              (Route definitions)
├── api/                (API integration)
└── styles/ (CSS modules for each component)
```

**Architecture Pattern:**
- Page-per-component model (monolithic pages directory)
- API calls inline or via custom hooks
- Zustand for global state
- CSS co-location with components

**Testing Coverage:**
- App.test.js
- Limited test suite (3 test files visible)

---

### HotelMS Frontend (React + TypeScript)

**Location:** `frontend/src/`

**Technology Stack:**
- Framework: React 18.2 + TypeScript
- Build: Vite 5.2 (ESM-native, faster dev)
- Routing: React Router v6
- HTTP Client: Integrated API layer (`lib/api.ts`)
- UI Framework: Radix UI + Tailwind CSS
- Styling: Tailwind CSS 3.4 + class-variance-authority
- Testing: Vitest 2.1 + Playwright E2E
- Real-time: Custom WebSocket hooks
- Build Size: Optimized tree-shaking with Vite

**Directory Structure:**
```
src/
├── app/                (App-level routing)
│   └── AppRoutes.tsx
├── components/         (Shared UI components)
│   ├── public/        (Public-facing components)
│   ├── shared/        (Reusable components)
│   └── ui/            (Radix UI + Tailwind wrappers)
├── features/          (Feature-based modules)
│   ├── access/
│   ├── billing/       (Advanced billing features)
│   │   ├── api.ts
│   │   ├── BillingFolioDrawer.tsx
│   │   ├── helpers.ts
│   │   └── useBillingRealtime.ts
│   ├── platform-access/
│   ├── public/
│   ├── subscriptions/
│   └── super-admin/
│       ├── restaurants/
│       ├── platform-users/
│       ├── packages/
│       ├── notifications/
│       └── audit-logs/
├── hooks/             (Custom React hooks)
├── lib/               (Utility library)
│   ├── api.ts         (Centralized HTTP client)
│   ├── auth.ts        (Auth utilities)
│   ├── moduleAccess.ts (Module access control)
│   ├── navigationHistory.ts
│   ├── sessionRequest.ts
│   ├── utils.ts
│   └── publicApi.ts
├── pages/             (Page components)
│   ├── admin/
│   ├── auth/
│   ├── public/
│   ├── restaurant/
│   ├── room/
│   ├── super-admin/
│   └── Dashboard.tsx
├── types/             (Global TypeScript types)
├── App.tsx            (Root component)
└── main.tsx           (Vite entry)
```

**Architecture Pattern:**
- **Feature-based structure:** Each feature has own directory with api, components, hooks
- **Shared/Public split:** Clear distinction between reusable and public components
- **Centralized API layer:** Single `lib/api.ts` for all HTTP requests
- **Type safety:** Full TypeScript throughout
- **Custom hooks:** Domain-specific hooks like `useBillingRealtime()`

**Testing Coverage:**
- 8+ test files using Vitest
- E2E tests with Playwright
- Unit tests for helpers and form state

**Key Differences:**
- Vite (2-3x faster dev rebuild)
- Tailwind CSS (utility-first) vs Bootstrap
- Feature-based organization vs pages
- TypeScript for type safety
- Centralized HTTP client pattern

---

## 4. TESTING APPROACHES

### Anawuma (NestJS Backend)

```
test/
├── app.e2e-spec.ts     (E2E tests)
└── jest-e2e.json       (Jest config for E2E)

src/
├── app.controller.spec.ts
├── auth/auth.controller.spec.ts
├── auth/auth.service.spec.ts
└── restaurants/restaurants.service.spec.ts
```

**Testing Tools:**
- Jest (unit + E2E)
- Testing Library

**Coverage:** ~4 test files visible

---

### HotelMS (FastAPI + React)

**Backend Tests (Poetry/Pytest):**
```
backend/tests/
├── test_auth_login_scope.py
├── test_auth_tenant_context.py
├── test_billing_workflow_dashboard_service.py
├── test_critical_paths_integration.py
├── test_model_registry.py
├── test_order_transitions.py
├── test_promo_codes_validation.py
├── test_qr_service.py
├── test_realtime_ws_auth.py
├── test_reports_date_range.py
├── test_restaurant_billing_email_defaults.py
├── test_site_content_admin.py
├── test_site_content_public_api.py
├── test_standardization_checks.py
├── test_subscription_timezone_normalization.py
├── test_super_admin_platform_management.py
├── test_super_admin_registration_reviews.py
└── test_table_sessions_qr_security.py
```

**Frontend Tests (Vitest + Playwright):**
```
frontend/
├── src/lib/moduleAccess.test.ts
├── src/features/super-admin/restaurants/helpers.test.ts
├── src/features/super-admin/platform-users/formState.test.ts
├── src/features/super-admin/packages/formState.test.ts
├── src/features/super-admin/notifications/helpers.test.ts
├── src/features/super-admin/audit-logs/helpers.test.ts
├── src/features/subscriptions/privilegeCatalog.test.ts
└── e2e/
    └── public-mobile.spec.ts
```

**Testing Tools:**
- Pytest (backend)
- Vitest + Playwright (frontend)

**Coverage:** 18+ test files with comprehensive integration tests

**Difference:**
- HotelMS has 4-5x more tests
- Integration and workflow testing (e.g., critical paths)
- Domain-specific tests (billing workflow, QR security)

---

## 5. DEPLOYMENT & CONTAINERIZATION

### Anawuma Docker Setup

```yaml
# docker-compose.yml
services:
  database:          # MySQL 8.0
  backend:           # NestJS on port 3000
  frontend:          # React via nginx on port 80
```

**Key Points:**
- Single docker-compose file
- MySQL, NestJS backend, React frontend
- Upload volumes for NestJS backend
- Simple orchestration

### HotelMS Docker Setup

```yaml
# docker-compose.yml
services:
  mysql:             # MySQL 8 on port 3307
  redis:             # Redis 7 on port 6379
  backend:           # FastAPI on port 8000
  frontend:          # React via Vite on port 5173
  ...
```

**Key Points:**
- Redis for caching and real-time
- Explicit health checks for each service
- Separate volumes for mysql_data and redis_data
- More sophisticated orchestration
- Environment variable requirement enforcement

---

## 6. DEPENDENCY MANAGEMENT

### Anawuma NestJS Backend

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/typeorm": "^11.0.0",
    "typeorm": "^0.3.28",
    "mysql2": "^3.18.0",
    "bcrypt": "^6.0.0",
    "passport": "^0.7.0",
    "socket.io": "^4.8.3"
  }
}
```

### Anawuma React Frontend

```json
{
  "dependencies": {
    "react": "^19.2.4",
    "react-router-dom": "^7.13.1",
    "axios": "^1.13.5",
    "react-bootstrap": "^2.10.10",
    "zustand": "^5.0.11",
    "framer-motion": "^12.35.2",
    "@tanstack/react-query": "^5.90.21"
  }
}
```

### HotelMS FastAPI Backend

```
fastapi>=0.111.0
sqlalchemy>=2.0.0
redis>=5.0.0
pydantic[email]>=2.6.0
stripe>=11.0.0
alembic>=1.13.2
httpx>=0.27.0
```

### HotelMS React + TypeScript Frontend

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-router-dom": "^6.22.3",
    "@radix-ui/react-slot": "^1.0.2",
    "tailwindcss": "^3.4.3",
    "lucide-react": "^0.363.0"
  },
  "devDependencies": {
    "vite": "^5.2.8",
    "vitest": "^2.1.8",
    "@playwright/test": "^1.58.2"
  }
}
```

---

## 7. CONFIGURATION MANAGEMENT

### Anawuma (NestJS)

```typescript
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: '.env',
})
```

**Approach:**
- Environment variables via `.env`
- ConfigService for access
- Simple string-based config

### HotelMS (FastAPI)

```python
# app/core/config.py
class Settings(BaseSettings):
    app_name: str
    app_env: str
    db_url: str
    db_auto_schema_sync: bool
    upload_dir: Path
    api_v1_prefix: str
    ...
```

**Approach:**
- Pydantic Settings with type validation
- Explicit configuration class
- IDE autocomplete support
- Environment variable mapping with defaults

---

## 8. KEY DOMAIN MODULES COMPARISON

| Domain | Anawuma | HotelMS | Notes |
|--------|---------|---------|-------|
| **Auth** | Basic JWT + Passport | Advanced with login_scope, registration_repository | Multi-tenant/scope support |
| **Orders** | Simple order CRUD | Complex order transitions with state machine | Workflow automation |
| **Billing** | Basic billing controller | Advanced billing workflow with audit events | Folio workflow, bill handoff status |
| **Payments** | Integrated in billing | Separate payments module with Stripe | Payment orchestration |
| **QR Management** | table-qr, room-qr | Unified qr module | More integrated |
| **Real-time** | WebSocket module | realtime module with Redis | Scalable WebSocket handling |
| **Reports** | Basic reports | Advanced reports with date range filtering | Complex analytics |
| **Access Control** | Role-based guards | Module-level access + platform_access | Fine-grained control |
| **Subscriptions** | Not present | Dedicated module with expiry worker | Business model support |
| **Room Sessions** | room-qr only | table_sessions + room_sessions | Session-based tracking |
| **Super Admin** | Not present | Comprehensive super-admin management | Multi-tenancy support |
| **Audit Logs** | Not present | Dedicated audit_logs module | Compliance tracking |

---

## 9. ARCHITECTURAL PATTERNS & PRINCIPLES

### Anawuma (NestJS)

**Strengths:**
- ✅ Convention-based (modules, controllers, services)
- ✅ Integrated testing with Jest
- ✅ Strong typing with TypeScript throughout stack
- ✅ Built-in validation with class-validator
- ✅ Familiar MVC-like structure for many developers

**Limitations:**
- ❌ Auto-sync schema (risky for production)
- ❌ Tightly coupled ORM (TypeORM hard to test)
- ❌ No explicit repository layer for complex queries
- ❌ Limited scalability for real-time with Socket.io
- ❌ Pages-based frontend (harder to scale)

---

### HotelMS (FastAPI + TypeScript)

**Strengths:**
- ✅ Explicit repository pattern (testable data access)
- ✅ Alembic migrations (version-controlled schema)
- ✅ Domain-driven design (32 focused modules)
- ✅ Advanced features (multi-tenancy, subscriptions, audit logs)
- ✅ Feature-based frontend organization
- ✅ Modern tooling (Vite, Vitest, Playwright)
- ✅ Redis integration for real-time and caching
- ✅ Comprehensive test suite (18+ domain tests)
- ✅ Dependency injection clarity (FastAPI Depends)

**Complexity:**
- 🔶 More layers (router → service → repository → model)
- 🔶 Explicit type annotations (Pydantic schemas)
- 🔶 Larger codebase (managing 32 modules)

---

## 10. SCALABILITY & PRODUCTION READINESS

| Metric | Anawuma | HotelMS |
|--------|---------|---------|
| **Schema Management** | Auto-sync (⚠️ risky) | Alembic migrations (✅ safe) |
| **Caching** | Not explicit | Redis integrated |
| **Real-time Scalability** | Socket.io (single node) | Redis + WebSocket (distributed) |
| **Testing** | ~4 test files | 18+ comprehensive tests |
| **Multi-tenancy** | Not supported | Full support |
| **Rate Limiting** | Throttler guard | Can be added |
| **Background Jobs** | Not visible | Worker processes |
| **API Versioning** | Not enforced | `/api/v1/` prefix |
| **Monitoring/Logging** | Limited | Structured logging module |
| **Configuration** | String-based | Typed Pydantic Settings |

---

## 11. DEVELOPER EXPERIENCE

### Anawuma

**Setup:**
```bash
npm install
npm run start:dev      # Hot reload
npm run test           # Jest tests
npm run build          # Production build
```

**DX Metrics:**
- Fast hot reload (HMR via react-scripts)
- Familiar NestJS patterns
- Built-in validation decorators
- Simple debugging (Node inspector)

### HotelMS

**Backend Setup:**
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload  # Auto-reload
pytest tests/                   # Pytest
python -m alembic revision -m "message"  # Migrations
```

**Frontend Setup:**
```bash
npm install
npm run dev            # Vite dev server (2x faster)
npm test              # Vitest watch mode
npm run test:e2e      # Playwright tests
```

**DX Metrics:**
- Faster Vite rebuilds
- TypeScript strict mode everywhere
- Pydantic IDE autocomplete
- Better error messages

---

## 12. MIGRATION PATH ANALYSIS

If migrating from Anawuma to HotelMS architecture:

1. **Backend:** NestJS → FastAPI
   - Extract service logic (preserve)
   - Implement repository pattern
   - Convert TypeORM entities → SQLAlchemy models
   - Set up Alembic migrations
   - Estimated effort: 40% of backend

2. **Frontend:** React (pages) → React (features)
   - Reorganize by feature/domain
   - Extract API calls to centralized layer
   - Migrate styling (Bootstrap → Tailwind)
   - Upgrade to TypeScript strict
   - Estimated effort: 35% of frontend

3. **Database:**
   - Generate Alembic migration for existing schema
   - Remove auto-sync, use explicit migrations
   - Effort: 10%

---

## 13. SUMMARY TABLE

| Category | Anawuma | HotelMS |
|----------|---------|---------|
| **Backend Framework** | NestJS v11 | FastAPI |
| **ORM** | TypeORM | SQLAlchemy 2.0+ |
| **Frontend Framework** | React 19 + Bootstrap | React 18 + TypeScript + Tailwind |
| **Build Tool** | react-scripts (CRA) | Vite |
| **Database Migrations** | Auto-sync | Alembic (explicit) |
| **Caching/Real-time** | Socket.io | Redis + WebSocket |
| **State Management** | Zustand | React Context/Hooks |
| **Testing** | Jest (limited) | Pytest + Vitest + Playwright (comprehensive) |
| **Modules** | 22 | 32 (more specialized) |
| **Multi-tenancy** | No | Yes |
| **Configuration** | Environment strings | Pydantic Settings (typed) |
| **Maturity Level** | MVP/Early Stage | Production Ready |
| **Scalability** | Medium | High |
| **Code Organization** | Monolithic modules | Feature-based domains |

---

## 14. RECOMMENDATIONS

### For Learning from Anawuma:
1. Study the domain module patterns (auth, orders, billing)
2. Understand the decorator-based validation approach
3. Learn WebSocket integration strategies

### For HotelMS Improvements:
1. Continue the feature-based organization
2. Maintain strict TypeScript in frontend
3. Keep comprehensive test coverage as codebase grows
4. Document module dependencies to prevent circular imports

### For New Features:
1. Use the repository pattern for data access
2. Keep services thin (orchestration only)
3. Write tests alongside features
4. Update Alembic migrations for schema changes
5. Follow the feature-based structure in frontend

---

## Appendix: File Structure Quick Reference

```
Anawuma Restaurant App
├── restaurant-backend-nestjs/     (NestJS: 22 modules)
│   ├── src/
│   │   ├── (modules)/
│   │   │   ├── .controller.ts
│   │   │   ├── .service.ts
│   │   │   ├── .module.ts
│   │   │   ├── dto/
│   │   │   ├── entities/
│   │   │   └── ...
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   └── docker-compose.yml
└── restaurant-frontend/           (React + Bootstrap)
    ├── src/
    │   ├── pages/         (64+ pages)
    │   ├── components/    (8 feature groups)
    │   ├── hooks/
    │   ├── store/         (Zustand)
    │   └── App.js
    └── Dockerfile

HotelMS (Current Active)
├── backend/                       (FastAPI: 32 modules)
│   ├── app/
│   │   ├── modules/       (32 domain modules)
│   │   │   ├── (module)/
│   │   │   │   ├── model.py
│   │   │   │   ├── repository.py
│   │   │   │   ├── service.py
│   │   │   │   ├── router.py
│   │   │   │   └── schemas.py
│   │   ├── api/           (Central router)
│   │   ├── core/          (Config, dependencies, security)
│   │   ├── db/            (Alembic, session, models)
│   │   ├── workers/       (Background jobs)
│   │   ├── main.py
│   │   └── __init__.py
│   ├── alembic/           (Schema migrations)
│   ├── tests/             (18+ test files)
│   └── Dockerfile
└── frontend/              (React + TypeScript + Tailwind)
    ├── src/
    │   ├── features/       (6 feature groups)
    │   │   ├── (feature)/
    │   │   │   ├── api.ts
    │   │   │   ├── components/
    │   │   │   └── hooks/
    │   ├── pages/         (Organized by domain)
    │   ├── components/    (Shared UI)
    │   ├── lib/           (Utilities & API layer)
    │   ├── hooks/
    │   ├── types/
    │   └── App.tsx
    ├── e2e/               (Playwright tests)
    └── Dockerfile
```

---

**Document Generated:** April 2, 2026  
**Scope:** Anawuma Restaurant App vs. HotelMS Architecture Comparison  
**Status:** Complete Analysis
