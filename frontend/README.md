# Frontend

The Ecoserve web application — **React 19 + Vite + TypeScript + Tailwind CSS v4**.

## Stack

- **Build:** Vite + React + TypeScript (strict)
- **Styling:** Tailwind CSS v4 via the `@tailwindcss/vite` plugin
- **Routing:** react-router-dom
- **Data fetching:** @tanstack/react-query + axios
- **Forms:** react-hook-form + zod + @hookform/resolvers
- **Charts:** recharts
- **Maps:** leaflet + react-leaflet
- **Motion:** gsap · lucide-react (icons)
- **Realtime:** socket.io-client
- **Auth:** Supabase Auth (supabase-js) — email/password sign-up & login; access tokens are sent to the backend via an axios interceptor

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck (tsc -b) + production build
npm run typecheck # typecheck only
```

## Structure

```
frontend/
├── public/            # Static assets (favicon, …)
└── src/
    ├── assets/        # Images, fonts, static resources
    ├── components/
    │   ├── ui/            # Reusable primitives (buttons, inputs, modals, …)
    │   ├── layout/        # Shell: navbar, sidebar, footer, page layouts
    │   ├── charts/        # recharts wrappers
    │   ├── maps/          # leaflet/react-leaflet wrappers
    │   ├── donation/      # Donation-flow components
    │   ├── delivery/      # Delivery/tracking components
    │   ├── ai/            # AI chat/assistant components
    │   └── notifications/ # Toasts, realtime alerts (socket.io)
    ├── pages/
    │   ├── public/        # Landing, directory, about, …
    │   ├── auth/          # Login, register, forgot password
    │   ├── donor/         # Donor dashboard & flows
    │   ├── ngo/           # NGO dashboard & flows
    │   ├── volunteer/     # Volunteer dashboard & flows
    │   └── admin/         # Admin dashboard & moderation
    ├── api/           # Axios instances & endpoint functions
    ├── hooks/         # Custom React hooks
    ├── services/      # Domain logic / integrations (socket, maps, …)
    ├── schemas/       # zod validation schemas
    ├── stores/        # Client state (e.g. zustand, planned)
    ├── types/         # Shared TypeScript types
    ├── routes/        # Route configuration & guards
    ├── animations/    # gsap/framer-motion helpers
    └── utils/         # Shared helpers
```

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | Base URL of the backend API. In dev, Vite proxies `/api` to `http://localhost:3001`. |
| `VITE_SUPABASE_URL` | — | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | — | Supabase publishable key (safe for the frontend) |

Copy `.env.example` to `.env.local` to override. Never commit `.env.local`, and never put the Supabase **secret** key in the frontend.

## Auth flow

1. `LoginPage` / `RegisterPage` use `supabase-js` (email + password).
2. `useAuth` keeps the session in sync and `ProtectedRoute` guards app routes.
3. The axios client (`src/api/client.ts`) attaches `Authorization: Bearer <access_token>` to every request.
4. `POST /auth/register` (after sign-up) creates the platform user + role profile via the backend.
5. If email confirmation is on, the user confirms, logs in, and is redirected to `/register` to finish profile setup.
