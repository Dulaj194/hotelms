# HotelMS

`hotelms` is a self-contained source-first monorepo with separate backend and frontend
apps for the active localhost runtime.

## Project Structure

```text
hotelms/
├─ backend/
│  ├─ app/
│  │  ├─ api/            # API router composition
│  │  ├─ core/           # config, auth, storage, logging
│  │  ├─ db/             # database session/base/redis
│  │  ├─ modules/        # feature modules (router/service/repository/model)
│  │  └─ workers/        # background tasks
│  ├─ tests/
│  ├─ scripts/
│  ├─ data/              # local runtime data (gitkept, not tracked)
│  └─ uploads/           # local runtime uploads (gitkept, not tracked)
├─ frontend/
│  ├─ src/
│  │  ├─ app/            # app-level wiring (routing)
│  │  ├─ components/
│  │  ├─ hooks/
│  │  ├─ lib/
│  │  ├─ pages/
│  │  └─ types/
│  └─ public/
└─ docker-compose.yml
```

## Standards Enforced

- Runtime files are excluded from git (`backend/*.db`, `backend/uploads/*`, `backend/data/*`).
- Environment files are excluded (`.env*`) while `.env.example` remains versioned.
- Frontend routes are isolated in `src/app/AppRoutes.tsx` and lazy-loaded for better bundle behavior.
- Source folders contain only maintainable code; generated artifacts stay local.

## Local Start

1. Configure env files from the provided `.env.example` files.
2. Start the active HotelMS stack with `docker compose up --build` from repo root.
3. Frontend runs on `http://localhost:5173`, backend on `http://localhost:8000`.
