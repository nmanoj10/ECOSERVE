# Phase 38, Step 99 — End-to-end testing

The E2E suite drives the **real full stack** through a real browser (Playwright +
system Chrome) and exercises the complete happy path:

```
Register → Login → Create Donation → Image Upload → AI → NGO Accept →
Volunteer Accept → Pickup → Live Tracking → Delivery → Impact
```

## What actually runs

| Step | Driver | What it proves |
|---|---|---|
| Register | Supabase Admin API + real `POST /auth/register` | Confirmed users + role profiles (with coords) |
| Login | Browser (`/login` form → GoTrue) | The real sign-in flow lands on the role dashboard |
| Create Donation | Browser (New Donation form) | Form → `POST /donations` → listing on the donor dashboard |
| Image Upload | Browser (hidden file input) | **Real ImageKit upload** — blob preview swaps to an `ik.imagekit.io` URL |
| AI | Server-side + API assertion | Rule-based freshness + food-classifier enrichment persisted on the prediction |
| NGO Accept | Browser ("Accept food" button) | One-step claim → donation `RESERVED` |
| Volunteer Accept | API `POST /assignments` | Assignment + delivery created; volunteer dashboard shows it |
| Pickup | API `POST /deliveries/:id/start` | Delivery → `IN_TRANSIT`, donation → `PICKED_UP` |
| Live Tracking | API GPS + browser | GPS samples accepted (incl. the once-only "approaching" alert); donor sees the **Live deliveries** card |
| Delivery | Browser ("Mark as delivered") | `DELIVERED` state; volunteer freed up; recent deliveries updated |
| Impact | Browser (dashboards) + API | KPIs increment on all three role dashboards; donor analytics agree |

### Why two steps use the API instead of a button

Both are real product capabilities that the UI does not expose yet (documented
gaps, not test shortcuts):

1. **Role registration with coordinates** — the Supabase project requires email
   confirmation (a platform setting), and the register UI does not collect
   lat/lng (the NGO nearby search depends on coords). The suite creates users
   via the Supabase Admin API (`email_confirm: true`) and registers profiles
   through the backend's real, idempotent `/auth/register` with coordinates —
   the same path the Postman collection (Step 97) uses.
2. **Volunteer assignment accept + pickup start** — backend endpoints exist
   (validated in Step 97) but the volunteer dashboard has no buttons yet. The
   suite calls the API and then verifies every resulting UI state in the
   browser (assignment card, live-tracking badge, "Mark as delivered" button).

## Prerequisites

All three services running locally:

```bash
# backend (:3001)          — tsx watch, auto-restarts on edits
cd backend && npm run dev

# frontend (:5173)
cd frontend && npm run dev

# ai-service (:8000)       — food classifier, model v2
cd ai-service && python -m uvicorn api.main:app --port 8000
```

Env files (already configured for local dev):

- `frontend/.env.local` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_IMAGEKIT_PUBLIC_KEY`, `VITE_IMAGEKIT_URL_ENDPOINT`
- `backend/.env` — `SUPABASE_SECRET_KEY` (service role, used only to create
  confirmed test users), `IMAGEKIT_PRIVATE_KEY`, `AI_SERVICE_URL`

Rate limits: the dev `.env` raises the per-window caps
(`API_RATE_LIMIT_MAX=2000`, `AUTH_RATE_LIMIT_MAX=1000`) so the suite's ~40–60
API calls per run fit comfortably. Production defaults (100/30) are unchanged;
a full backend restart resets the in-memory counters.

## Running

```bash
cd frontend && npm run test:e2e        # full suite (≈45 s)
npx playwright test -g "NGO"           # one step
```

Uses the installed system Chrome (`channel: 'chrome'`) — no Playwright browser
download needed. `reducedMotion: 'reduce'` makes the CountUp KPIs render final
values instantly.

## Notes

- **Fresh data every run** — users are timestamped (`e2e.<role>.<ts>@gmail.com`)
  and the donation name is unique per run, so past runs' listings never collide
  in the nearby search. Test data accumulates in the DB by design (same as the
  Step 97 collection).
- **Screenshots + traces** are saved to `frontend/test-results/` on failure
  (`npx playwright show-trace <file>`).
- The ImageKit upload + AI classification are exercised with a real generated
  PNG (128×128, above the AI service's 100×100 minimum).

## Removing test data

`backend/scripts/cleanup-test-data.ts` deletes everything the testing steps
created — platform rows, Supabase Auth users, and ImageKit uploads — while
never touching real accounts. Preview first, then execute:

```bash
cd backend
npx tsx scripts/cleanup-test-data.ts            # dry run (prints every test account)
DRY_RUN=0 npx tsx scripts/cleanup-test-data.ts  # delete for real
```

It also recomputes the daily Analytics rollup from the remaining real data.
