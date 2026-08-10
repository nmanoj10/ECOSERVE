# Security — protecting sensitive data

> Phase 35/36, Step 90 — never expose credentials to clients.

## The rule

Server-only secrets must never appear in:

- any API response body or header,
- frontend code or client-visible env vars,
- logs, or
- git history.

The only environment variables that may reach the browser are `VITE_*` vars,
bundled by Vite **by definition** — anything not prefixed with `VITE_` is
impossible for the frontend build to access.

## Secrets inventory

| Secret | Exists? | Where it may live | Never in |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ backend | `backend/.env` only | responses, logs, frontend |
| `SUPABASE_SECRET_KEY` | ✅ backend | `backend/.env` only | responses, logs, frontend |
| `IMAGEKIT_PRIVATE_KEY` | ✅ backend | `backend/.env` only; signs uploads server-side | responses (the signing endpoint returns only `token`/`expire`/`signature`), frontend |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | ❌ not used | JWTs are issued + verified by Supabase Auth (GoTrue) via the project JWKS; the platform holds no signing secret | n/a |
| AI credentials | ❌ not used | freshness scoring is a local rule model (`services/freshnessService.ts`); the Python `ai-service` is a skeleton with no keys | n/a |

## Guards in place

1. **Gitignore matrix** — `.env` and `.env.*` (with `!.env.example`) are ignored
   at the repo root, and in `backend/`, `frontend/`, and `ai-service/`. Commit
   the `.example` templates only, never real values.
2. **Fail-fast env validation** (`config/env.ts`) — the publishable keys
   (`SUPABASE_PUBLISHABLE_KEY`, `IMAGEKIT_PUBLIC_KEY`) refuse to boot if they
   accidentally contain a secret-shaped value (`sb_secret_…`, `private_…`).
   This catches the classic paste-the-wrong-key mistake before the secret can
   ship to a browser.
3. **Client exposure is opt-in by prefix** — the frontend only reads `VITE_*`
   vars (see `frontend/.env.example`; ImageKit docs there warn against the
   private key).
4. **Error handler** (`middleware/errorHandler.ts`) — unexpected errors return
   a generic 500 message; stack traces and internals are logged server-side
   only, never serialized to responses.
5. **Health/status endpoints** — `GET /health` returns status, service,
   uptime, timestamp — no environment values.

## Verifying a deployment

- `grep -r "sb_secret_\\|private_" --include="*.tsx" --include="*.ts" frontend/src` → no matches.
- `backend/.env` and `frontend/.env` are untracked (`git check-ignore`).
- The upload signing response contains only `token`, `expire`, `signature`.
- No `DATABASE_URL` or key material appears in any response body or error.
