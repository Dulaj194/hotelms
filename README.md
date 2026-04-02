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

## Backend Tests

Backend tests use Python `unittest` as the default runner.

1. Create and activate the backend virtual environment.
2. Install backend dependencies:
   `backend/venv/Scripts/python.exe -m pip install -r backend/requirements.txt`
3. Run all backend tests from the `backend` folder:
   `venv/Scripts/python.exe -m unittest discover tests`
4. Run one test file:
   `venv/Scripts/python.exe -m unittest tests.test_realtime_ws_auth`

## Backend Quality Checks

For code quality, formatting, type checking, and security scanning, install development dependencies:

```bash
cd backend
pip install -r requirements-dev.txt
```

Then run individual checks:

```bash
# Code formatting (check only)
black --check app/ tests/

# Auto-fix formatting
black app/ tests/

# Linting (with auto-fixes)
ruff check app/ tests/ --fix

# Type checking
mypy app/

# Security scanning
bandit -r app/ -ll

# All tests with coverage
pytest tests/ --cov=app --cov-report=term-level=2
```

**CI Integration:**  
All quality checks run automatically on pull requests and pushes to `main` or `dev1` branches. Check [.github/workflows/backend-quality.yml](.github/workflows/backend-quality.yml) for the full pipeline.
