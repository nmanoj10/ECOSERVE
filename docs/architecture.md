# Architecture

Ecoserve is a three-service monorepo: a React frontend, an Express backend, and a FastAPI AI service. This document describes the intended system once implemented.

## System overview

```
┌─────────────┐   REST / JSON   ┌──────────────┐   HTTP (internal)  ┌─────────────┐
│  frontend   │ ──────────────► │   backend    │ ─────────────────► │  ai-service │
│ React/Vite  │ ◄────────────── │ Node/Express │ ◄───────────────── │   FastAPI   │
└─────────────┘                 └──────┬───────┘                    └─────────────┘
                                       │
                              ┌────────▼────────┐
                              │   PostgreSQL    │
                              │    (planned)    │
                              └─────────────────┘
```

## Service responsibilities

### `frontend/` — React + Vite + TypeScript

- Single-page application for browsing the green business directory, tracking environmental impact, and managing the user account.
- Talks only to the backend REST API — **never** directly to the AI service.
- Planned structure: see [`frontend/README.md`](../frontend/README.md).

### `backend/` — Node.js + Express + TypeScript

- Owns authentication, authorization, request validation, and persistence.
- Exposes the `/api/v1/*` REST surface consumed by the frontend.
- Calls the AI service over internal HTTP for heavy computation (impact estimates, recommendations).
- Planned structure: see [`backend/README.md`](../backend/README.md).

### `ai-service/` — Python + FastAPI

- Stateless service for ML/AI features: carbon-impact estimation, personalized recommendations, natural-language query handling.
- Exposes its own internal API (see [`api-design.md`](api-design.md)).
- Intended to be horizontally scalable and decoupled from the rest of the system.
- Planned structure: see [`ai-service/README.md`](../ai-service/README.md).

## Data flow (planned)

1. A user searches for eco-friendly businesses in the frontend.
2. The frontend calls `GET /api/v1/businesses?q=...` on the backend.
3. The backend queries PostgreSQL and returns a paginated result.
4. To personalize the results, the backend calls `POST /v1/recommend` on the AI service with the user's profile.
5. The AI service returns ranked business IDs; the backend merges them with directory data and serves the final response.

## Cross-cutting concerns (planned)

- **Config:** per-service environment variables — see [`getting-started.md`](getting-started.md).
- **Auth:** JWT issued by the backend and consumed by the frontend; the AI service is reachable only internally.
- **Observability:** structured logging per service plus `GET /health` endpoints on the backend and AI service.
- **Testing:** unit tests per service, plus integration tests spanning the backend ↔ AI service boundary.
