# Backend

The Ecoserve REST API — **Node.js + Express 5 + TypeScript**, with Prisma 7 (PostgreSQL) and Socket.IO.

## Stack

- **Runtime:** Node.js ≥ 20.19 (ESM, `NodeNext`)
- **Framework:** Express 5
- **Database:** PostgreSQL via Prisma 7 (driver-adapter mode with `pg`)
- **Auth:** Supabase Auth — frontend signs up via supabase-js; this backend verifies Supabase JWTs against the project JWKS (jose), and `users.id` = Supabase auth user id
- **Validation:** zod
- **Realtime:** socket.io
- **Security:** helmet, cors, express-rate-limit
- **Logging:** morgan
- **Dev:** tsx (hot reload), TypeScript 7 strict

## Getting started

```bash
cp .env.example .env    # then edit DATABASE_URL / JWT_SECRET
npm install
npm run dev             # http://localhost:3001
```

First-time database setup (once PostgreSQL is running):

```bash
npm run prisma:migrate   # creates/updates the schema
npm run prisma:generate  # regenerates the client (auto-runs on build)
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run with tsx watch (hot reload) |
| `npm run build` | `prisma generate` + compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | TypeScript check without emitting |
| `npm run prisma:generate` | Generate the Prisma client to `src/generated/prisma` |
| `npm run prisma:migrate` | Run `prisma migrate dev` |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run prisma:validate` | Validate the Prisma schema |

## Structure

```
backend/
├── prisma/
│   ├── schema.prisma   # Prisma 7 schema (datasource has provider only; URL lives in prisma.config.ts)
│   └── migrations/     # Generated migration files
├── prisma.config.ts    # Prisma CLI config (datasource URL, migrations path)
└── src/
    ├── app.ts          # Express app factory (middleware, routes, error handling)
    ├── server.ts       # Entry: HTTP server + Socket.IO + graceful shutdown
    ├── config/         # Typed env (zod), Prisma client singleton
    ├── controllers/    # HTTP request handlers
    ├── routes/         # Route definitions (root, /health, /api/v1)
    ├── services/       # Business logic
    ├── repositories/   # Data-access layer (Prisma queries)
    ├── middleware/     # auth (JWT), errorHandler, notFound, rateLimiter
    ├── validators/     # zod request schemas
    ├── sockets/        # Socket.IO setup and event handlers
    ├── jobs/           # Background/cron jobs
    ├── utils/          # HttpError and other helpers
    └── types/          # Shared types (AuthPayload, Express augmentation)
```

## Environment variables

See `.env.example`. Key ones:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API port (matches the Vite dev proxy) |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin (frontend) |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | — | JWT signing secret |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |

> ⚠️ Prisma 7 note: the datasource URL is **not** in `schema.prisma` — it lives in `prisma.config.ts`, and the client connects through the `PrismaPg` driver adapter (`src/config/prisma.ts`).

## Auth flow

1. The **frontend** signs up / logs in with `supabase-js` (email + password) and holds a Supabase session.
2. It sends requests with `Authorization: Bearer <access_token>`.
3. This backend verifies the token against the Supabase JWKS (`jose`), takes `sub` as the user id, and loads the platform `users` row (with donor/ngo/volunteer profile).
4. `POST /api/v1/auth/register` (token-protected) creates the `users` row + role profile in one transaction — idempotent.
5. `GET /api/v1/auth/me` (auth required) returns the user with their profile.

### Refresh-token lifecycle

Access tokens are short-lived Supabase JWTs (1h). Refresh tokens are tracked in the `sessions` table — stored **only as SHA-256 hashes** — which makes them revocable:

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `POST /api/v1/auth/refresh` | refresh token (body) | Exchange a refresh token for a new pair; the old row is consumed and the rotated token recorded. Rejected with `401 REFRESH_TOKEN_REVOKED` if the token is unknown or revoked |
| `POST /api/v1/auth/sessions` | access token | Record the current refresh token (hash) so it can be revoked later |
| `GET /api/v1/auth/sessions` | access token | List the user's active sessions (expired rows pruned) |
| `DELETE /api/v1/auth/sessions/:id` | access token | Revoke one session |
| `POST /api/v1/auth/logout` | refresh token (body) | Revoke the caller's session — works even when the access token has expired |

All auth routes are behind a stricter rate limiter (30 req / 15 min). The frontend's axios client refreshes via `supabase-js` on 401s (keeps the client session in sync); the backend `/refresh` endpoint serves non-browser clients and documents the server-side flow.

### Authorization (role middleware)

`authorize(...roles)` (`src/middleware/authorize.ts`) guards routes by the user's role (read fresh from the `users` table on every request, so role changes take effect immediately):

```ts
router.get('/admin/overview', authorize('ADMIN'), handler)
router.post('/donations', authorize('DONOR'), handler)
router.post('/requests', authorize('NGO'), handler)
```

- Works standalone (verifies the token + loads the user itself) or after `authRequired` (skips the duplicate lookup).
- Wrong role → `403 FORBIDDEN`; missing/invalid auth → `401 UNAUTHORIZED`.
- Example from the spec: `/api/v1/admin/*` requires `ADMIN` (`src/routes/admin.routes.ts`) — currently serves `GET /admin/overview` with platform stats (users by role, donations by status, available volunteers, verified NGOs, active sessions).

> ⚠️ `users.passwordHash` is unused (Supabase Auth owns passwords) and nullable. The Supabase **secret key** lives only in `.env` — never expose it to the frontend.

## API conventions

Responses follow `docs/api-design.md`: JSON bodies, errors shaped as `{ "error": { "code", "message" } }`. A live probe is available at `GET /health`.
