# Getting started (planned)

> The repository is currently a **scaffold** — no runnable code yet. This page documents how each service is intended to run once implemented.

## Prerequisites

- Node.js ≥ 20 (frontend, backend)
- Python ≥ 3.11 (AI service)
- PostgreSQL ≥ 15 (planned)
- A package manager: `npm` (or `pnpm`)

## Running the services (once implemented)

Each service runs independently from its own directory.

### 1. AI service (`ai-service/`)

```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Backend (`backend/`)

```bash
cd backend
npm install
npm run dev
```

### 3. Frontend (`frontend/`)

```bash
cd frontend
npm install
npm run dev
```

## Environment variables

| Variable | Service | Purpose |
| --- | --- | --- |
| `PORT` | backend | API port (default `3001`) |
| `DATABASE_URL` | backend | PostgreSQL connection string |
| `JWT_SECRET` | backend | JWT signing secret |
| `AI_SERVICE_URL` | backend | Base URL of the AI service (default `http://localhost:8000`) |
| `VITE_API_URL` | frontend | Base URL of the backend (default `http://localhost:3001/api/v1`) |
| `MODEL_API_KEY` | ai-service | Key for the underlying model provider |

> Never commit `.env` files. Per-service `.env.example` templates will be added with the first implementation.
