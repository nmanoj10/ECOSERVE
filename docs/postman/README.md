# Postman API tests — Phase 38, Step 97

Ready-to-import Postman artifacts covering the whole Ecoserve API:

| File | What it is |
| --- | --- |
| `ECOSERVE.postman_collection.json` | The test suite — 9 folders, ~45 requests, with chained auth and data flow |
| `ECOSERVE.postman_environment.json` | Environment variables (base URL, Supabase, test accounts) |

## 1 · Import

1. Open Postman → **Import** → drop in both files (or Import → File → choose both).
2. In the environment dropdown (top right), select **ECOSERVE API (local)**.

## 2 · Configure the environment

| Variable | Value to set |
| --- | --- |
| `apiBase` | `http://localhost:3001` (backend root) |
| `supabaseUrl` | Your Supabase project URL — same as `SUPABASE_URL` in `backend/.env` |
| `supabaseAnonKey` | Your Supabase anon key — same as `SUPABASE_PUBLISHABLE_KEY` in `backend/.env` |
| `donorEmail` / `ngoEmail` / `volunteerEmail` / `adminEmail` / `password` | Test-account credentials (defaults provided) |

> The backend must be running (`cd backend && npm run dev`). The ai-service on
> port 8000 is optional — donation creation fails open without it.

## 3 · Create the test accounts (first run only)

Authentication works the way the frontend does: **Supabase GoTrue issues the
token, the backend trusts it** (the `Bearer` token IS the identity).

1. Run the three **Sign up** requests in `1 · Setup — Supabase auth`. They create
   the donor / NGO / volunteer accounts and store their tokens.
   - If your Supabase project requires **email confirmation**, signups return no
     token — confirm the emails (or disable confirmation in the dashboard) and
     use the **Login** requests instead.
   - Re-running signups returns `400 user already exists` — that is expected;
     the Login requests are the normal path on later runs.
2. **Admin account (required only for folders 7 & 8):** ADMIN is not a
   self-service role. Create the admin user in the Supabase dashboard
   (Users → Invite / Add user with `{{adminEmail}}` + `{{password}}`), then set
   its role in the database:
   ```bash
   cd backend
   npx tsx -e "
   import { prisma } from './src/config/prisma.js'
   ;(async () => {
     await prisma.user.update({ where: { id: process.argv[2] }, data: { role: 'ADMIN' } })
     console.log('admin role set')
     await prisma.\$disconnect()
   })()
   " <SUPABASE_USER_ID>
   ```
   (Alternatively run `UPDATE "User" SET role='ADMIN' WHERE id='...'` in your
   SQL editor.) Then run **Login Admin** to capture the admin token.

## 4 · Run the suite

Open the collection → **Run collection** (or the `>` arrow → Run). Folders run
in order and chain data automatically:

```
1 · Setup — Supabase auth   → tokens for all four roles
2 · Auth & Sessions         → backend register + /me + sessions + refresh + logout
3 · Donation                → create listing → captures donationId + AI prediction
4 · NGO                     → nearby search → claim (RESERVED) → dashboard
5 · Volunteer               → availability → recommend → accept → captures deliveryId
6 · Delivery                → tracking → start → GPS location → complete
7 · Analytics               → donor / ngo / volunteer / admin impact
8 · Admin                   → overview, users, NGOs (+verify), donations, deliveries, reports
9 · Notifications           → inbox, mark read
```

Chained values (`donationId`, `deliveryId`, tokens, …) are stored as
**collection variables** by each request's test script, so you can also run a
single request later (e.g. re-run `POST /deliveries/:id/complete`).

## 5 · Notes

- **Fresh data per run:** signups use fixed emails, so registrations and the
  created donation/delivery accumulate in your dev database. To reset, delete
  the Supabase users (and their rows via Prisma Studio) or just use new emails.
- **Expected status codes** are asserted inside each request (`pm.test`); the
  Collection Runner summary shows pass/fail per request.
- **Rate limits:** `/api/v1/*` is rate-limited (the limiter allows a generous
  burst) — running the collection once is well within it.
- **AI freshness:** `POST /donations` returns a `prediction` (freshness score,
  priority 1–5) computed by the rule engine; the Python ai-service enriches it
  with a dish classification when `AI_SERVICE_URL` is configured and an image
  URL is supplied.
