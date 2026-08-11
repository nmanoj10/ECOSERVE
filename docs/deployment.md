# Deployment

ECOSERVE ships as three services:

| Service | Stack | Where it deploys |
| --- | --- | --- |
| Frontend | React + Vite (static SPA) | **Vercel** |
| Backend | Express + Prisma + Socket.IO (long-running) | **Render** |
| AI service | FastAPI + PyTorch (CPU) | **Render** |

The frontend never talks to the AI service — the backend calls it server-to-server
(`POST /predict-url`). The browser talks to the backend over REST **and** Socket.IO.

```
Browser (Vercel)
   │  REST  /api/v1/*            (axios, VITE_API_URL)
   │  Socket.IO /socket.io/*     (VITE_SOCKET_URL — live tracking + notifications)
   ▼
Backend (Render :3001) ──► Postgres (DATABASE_URL, Prisma)
   │                    ──► Supabase Auth (JWKS JWT verification)
   │                    ──► ImageKit (signed client uploads)
   │                    ──► OSRM (route geometry, public demo server)
   │  POST /predict-url
   ▼
AI service (Render :8000)
```

---

## 1. Frontend → Vercel

**Files:** `frontend/vercel.json`, `frontend/package.json`.

`vercel.json` sets the Vite build (`npm run build` → `dist/`), an SPA fallback
rewrite (every path serves `index.html` so react-router works), and cache
headers (hashed `/assets/*` immutable, `index.html` no-cache).

### Steps
1. Push the repo to GitHub.
2. Vercel → **Add New Project** → import the repo.
3. Root directory: **`frontend`** · Framework preset: **Vite** (auto-detected).
4. Set these **Environment Variables** (they are baked in at build time — a
   change requires a redeploy):

   | Variable | Value |
   | --- | --- |
   | `VITE_API_URL` | `https://<your-backend>.onrender.com/api` |
   | `VITE_SOCKET_URL` | `https://<your-backend>.onrender.com` |
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
   | `VITE_IMAGEKIT_PUBLIC_KEY` | `public_…` |
   | `VITE_IMAGEKIT_URL_ENDPOINT` | `https://ik.imagekit.io/<your-id>` |

5. Deploy. Note the domain (e.g. `https://ecoserve.vercel.app`) — it goes into
   the backend's `CLIENT_URL` / `CORS_ORIGINS`.

> Vercel serves static files only. The Socket.IO connection goes **directly**
> from the browser to the Render backend, never through Vercel.

---

## 2. Backend → Render

**Files:** `backend/Dockerfile`, `backend/.dockerignore`, `render.yaml`.

Two options — the **blueprint** is easiest:

### Option A — Render blueprint (recommended)
1. Push to GitHub, then Render → **New → Blueprint** → select the repo.
2. `render.yaml` creates both the API and the AI service from their Dockerfiles.
3. Set the `sync: false` secrets in the Render dashboard (see table below),
   including `AI_SERVICE_URL` → the URL of the deployed `ecoserve-ai` service.

### Option B — manual web service
1. Render → **New → Web Service** → repo → root directory `backend`.
2. Render detects `backend/Dockerfile` and builds it.
3. Add the env vars below, set **Health Check Path** `/health`, start command
   `node dist/server.js` (already the Docker CMD).

### Backend env vars

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` |
| `TRUST_PROXY` | yes | `true` — behind Render's proxy; makes rate limiting read real client IPs |
| `CLIENT_URL` | yes | `https://<your-frontend>.vercel.app` |
| `CORS_ORIGINS` | yes | Comma-separated frontend origins (same allowlist gates REST **and** Socket.IO) |
| `DATABASE_URL` | yes | Postgres DSN, e.g. `postgresql://user:pass@host:5432/ecoserve?sslmode=require` (Supabase-hosted Postgres or Render Postgres) |
| `SUPABASE_URL` | yes | e.g. `https://<ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | yes | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | yes | `sb_secret_…` — server only |
| `SUPABASE_JWKS_URL` | yes | `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` |
| `IMAGEKIT_PUBLIC_KEY` | no | Ship `public_…` to the frontend too; without it uploads are disabled |
| `IMAGEKIT_PRIVATE_KEY` | no | Signs client uploads; without it `imagekit-auth` returns `configured: false` |
| `IMAGEKIT_URL_ENDPOINT` | no | e.g. `https://ik.imagekit.io/<id>` |
| `AI_SERVICE_URL` | no | e.g. `https://ecoserve-ai.onrender.com` — omit to run without dish enrichment |
| `API_RATE_LIMIT_MAX` | no | Default `100` per 15 min |
| `AUTH_RATE_LIMIT_MAX` | no | Default `30` per 15 min |
| `RESCUE_INTERVAL_MS` / `EXPIRY_JOB_INTERVAL_MS` / `REMINDER_JOB_INTERVAL_MS` / `ANALYTICS_JOB_INTERVAL_MS` | no | Background-job sweep intervals |

### Database migrations
Migrations run on deploy, not at boot. Run them against the production
database once before first deploy (and after any schema change):

```bash
cd backend
DATABASE_URL="<prod-dsn>" npx prisma migrate deploy
```

The migration files + `prisma.config.ts` ship inside the image, so you can also
run this from the Render shell.

---

## 3. AI service → Render

**Files:** `ai-service/Dockerfile`, `ai-service/.dockerignore`.

The image installs CPU-only PyTorch (much smaller than the CUDA wheels), ships
the trained `models/best_food_classifier_v2.pth`, and runs
`uvicorn api.main:app` on `$PORT`. No env vars required. Health check: `/health`.

**Security note:** `/predict-url` fetches whatever URL the backend sends. Keep
this service reachable **only** by the backend (Render private service / IP
allowlist, or Vercel-style auth middleware) — never expose it to the public
internet. The SSRF guard (no redirects, 8 MB / 10 s caps) is defence in depth.

---

## 4. Wiring checklist (after deploy)

- [ ] Backend `CORS_ORIGINS` contains the exact Vercel domain (no trailing slash).
- [ ] `VITE_API_URL` = backend URL + `/api` (e.g. `https://api.onrender.com/api`).
- [ ] `VITE_SOCKET_URL` = backend origin **without** `/api`.
- [ ] Open the site → log in → create a donation with a photo → the dish class
      shows up in the donation detail (AI service reachable).
- [ ] Live tracking: volunteer + NGO in two windows, marker moves (Socket.IO).
- [ ] ImageKit uploads work (backend `IMAGEKIT_PRIVATE_KEY` set).

## 5. Caveats

- **Render free tier spins down** idle web services after ~15 min. The first
  request wakes the backend, and sockets reconnect — but for a demo that must
  stay warm (live tracking, rescue jobs), use a paid instance or a UptimeRobot
  ping on `/health`.
- **Socket.IO at scale:** one instance is fine. If you ever scale horizontally,
  you need sticky sessions and the Redis adapter — not required for this
  project's size.
- **OSRM:** the app uses the public `router.project-osrm.org` demo server.
  Suitable for demos; self-host OSRM (or use a commercial provider) for
  production SLA.
- **Build-time env on Vercel:** `VITE_*` vars are compile-time. After changing
  them in the dashboard, redeploy.
