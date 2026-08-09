# Ecoserve 🌿

**A sustainability platform that connects people with eco-friendly services and helps them understand and reduce their environmental impact.**

Ecoserve is organized as a three-service monorepo. Each service lives in its own directory, has its own dependencies and lifecycle, and can be developed, tested, and deployed independently.

## Services

| Service | Path | Stack (planned) | Responsibility |
| --- | --- | --- | --- |
| Web frontend | [`frontend/`](frontend/README.md) | React · Vite · TypeScript | User-facing UI — green business directory, impact dashboard, account/profile flows |
| API backend | [`backend/`](backend/README.md) | Node.js · Express · TypeScript | Core business logic, authentication, data persistence, and the REST API consumed by the frontend |
| AI service | [`ai-service/`](ai-service/README.md) | Python · FastAPI | ML/AI features — carbon-impact estimates, personalized recommendations, natural-language queries |

## Repository layout

```
ecoserve/
├── frontend/      # React + Vite web app (planned)
├── backend/       # Express REST API (planned)
├── ai-service/    # FastAPI AI/ML service (planned)
├── docs/          # Architecture, API design, and setup documentation
└── README.md
```

## Architecture at a glance

```
┌─────────────┐   REST / JSON    ┌──────────────┐   HTTP (internal)   ┌─────────────┐
│  frontend   │ ───────────────► │   backend    │ ──────────────────► │  ai-service │
│ React/Vite  │ ◄─────────────── │ Node/Express │ ◄────────────────── │   FastAPI   │
└─────────────┘                  └──────┬───────┘                     └─────────────┘
                                        │
                                ┌───────▼───────┐
                                │  PostgreSQL   │ (planned)
                                └───────────────┘
```

- The **frontend** never talks to the AI service directly; all traffic flows through the backend, which owns auth, validation, and persistence.
- The **backend** calls the **AI service** over internal HTTP for heavy lifting (impact estimates, recommendations).
- The **AI service** is stateless and horizontally scalable.

See [`docs/architecture.md`](docs/architecture.md) for the full breakdown.

## Status

> **In progress.** The monorepo structure and documentation are in place. The frontend is bootstrapped (Vite + React + TypeScript + Tailwind v4) and the backend is bootstrapped (Express 5 + TypeScript + Prisma 7 + Socket.IO). **Auth is live on Supabase** — frontend signs up/logs in via supabase-js, the backend verifies Supabase JWTs via JWKS, and users/donors/ngos/volunteers tables are migrated to the hosted PostgreSQL database. The AI service is not yet implemented. See [`docs/getting-started.md`](docs/getting-started.md).

## Documentation

| Doc | Purpose |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | System architecture, component responsibilities, data flow |
| [`docs/api-design.md`](docs/api-design.md) | Planned REST surface for the backend and AI service |
| [`docs/getting-started.md`](docs/getting-started.md) | Local development setup and environment variables |

## Development conventions (planned)

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, …).
- **Branches:** `feature/<name>` / `fix/<name>`, scoped per service when a change touches one area.
- **Languages:** TypeScript on the web side, Python on the AI side.
- **Testing:** service-level unit tests plus integration tests spanning the backend ↔ AI service boundary.
