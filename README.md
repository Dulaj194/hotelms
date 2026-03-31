# HotelMS

Hotel Management System — Full-Stack Starter (Phase 1 Foundation)

## Tech Stack

| Layer          | Technology                              |
| -------------- | --------------------------------------- |
| Backend        | FastAPI + Python 3.11                   |
| Frontend       | React 18 + Vite + TypeScript            |
| Styling        | Tailwind CSS + shadcn/ui                |
| Database       | MySQL 8                                 |
| Cache          | Redis 7                                 |
| Containerisation | Docker + Docker Compose               |

---

## Project Structure

```
hotelms/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── health/
│   │   │       │   ├── __init__.py
│   │   │       │   └── router.py
│   │   │       ├── __init__.py
│   │   │       └── router.py
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── redis_client.py
│   ├── .env
│   ├── .env.example
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   │   └── Dashboard.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── public/
│   ├── .env
│   ├── .env.example
│   ├── components.json
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

## Getting Started

### Prerequisites

- **Docker & Docker Compose** — containerised setup
- **Python 3.11+** — local backend development
- **Node.js 20+** — local frontend development

---

### Run with Docker Compose (recommended)

```bash
# Build and start all services
docker-compose up --build

# Run in detached mode
docker-compose up --build -d

# Stop all services
docker-compose down

# Stop and remove volumes (wipe database)
docker-compose down -v
```

### One-command run (Windows)

Use the root scripts for quickest startup:

```powershell
cd d:\in_project\hotelms

# Start all services (build + up)
.\run.ps1

# Start in background
.\run.ps1 -Detached

# Stop all services
.\stop.ps1

# Stop and wipe DB volume
.\stop.ps1 -WipeData
```

Batch shortcuts are also available:

```powershell
.\run.bat
.\stop.bat
```

### Standard Build Verification

Before pushing changes, run the standardized verification flow:

```powershell
cd d:\in_project\hotelms

# Primary system checks (backend standards + frontend production build)
.\build-standard.ps1

# Also include live DB drift verification
.\build-standard.ps1 -CheckDb

# Include reference app build verification (Anawuma-Resturant-App-)
.\build-standard.ps1 -IncludeReference
```

Use `-InstallDeps` when dependencies are not yet installed:

```powershell
.\build-standard.ps1 -InstallDeps
```

---

### Run Locally (without Docker)

#### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Database Migrations (Alembic)

```bash
cd backend
alembic upgrade head
```

To create a new migration after model changes:

```bash
cd backend
alembic revision --autogenerate -m "describe_change"
```

#### Standardization Pass

```bash
# Fast pass (no live DB check)
backend/venv/Scripts/python.exe backend/scripts/standardization_pass.py --skip-db

# Full pass (checks live DB schema drift via DATABASE_URL)
backend/venv/Scripts/python.exe backend/scripts/standardization_pass.py
```

See `STANDARDIZATION_PASS.md` for architecture and workflow standards.

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

---

## Verification

| Service         | URL                                   |
| --------------- | ------------------------------------- |
| Frontend        | http://localhost:5173                 |
| Backend API     | http://localhost:8000                 |
| Health endpoint | http://localhost:8000/api/v1/health   |
| Swagger docs    | http://localhost:8000/docs            |
| ReDoc           | http://localhost:8000/redoc           |

Expected health response:
```json
{
  "status": "ok",
  "service": "hotelms-backend"
}
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable       | Description                    | Example                                        |
| -------------- | ------------------------------ | ---------------------------------------------- |
| `DATABASE_URL` | MySQL SQLAlchemy URL           | `mysql+pymysql://root:@mysql:3306/hotelms`     |
| `REDIS_URL`    | Redis connection URL           | `redis://redis:6379`                           |
| `APP_ENV`      | Application environment        | `development`                                  |
| `APP_NAME`     | Application name               | `hotelms`                                      |

### Frontend (`frontend/.env`)

| Variable         | Description              | Example                           |
| ---------------- | ------------------------ | --------------------------------- |
| `VITE_API_URL`   | Backend API base URL     | `http://localhost:8000/api/v1`    |
| `VITE_APP_NAME`  | Application display name | `HotelMS`                         |
