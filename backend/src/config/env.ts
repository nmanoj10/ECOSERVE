import 'dotenv/config'

import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  // Comma-separated CORS allowlist (Phase 35, Step 89). Defaults to CLIENT_URL
  // when unset, so a second frontend origin (staging, app subdomain) can be
  // added without weakening the policy.
  CORS_ORIGINS: z.string().optional(),
  // Set to 'true' only when the app runs behind a reverse proxy (Render,
  // Railway, Vercel, nginx). Trusting the proxy lets rate limiting read real
  // client IPs from X-Forwarded-For; leaving it off on a direct deployment
  // prevents clients from spoofing that header to bypass rate limits.
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Local JWT authentication — secret used to sign access/refresh tokens
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  // Token expiry in seconds (default 1 hour if not set)
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(3600),

  // ImageKit (Step 44). Optional — the app boots without them; the upload
  // signing endpoint reports `configured: false` until the private key is set.
  // The public key ships to the browser, so refuse a private key pasted in.
  IMAGEKIT_PUBLIC_KEY: z
    .string()
    .optional()
    .refine((key) => !key || !key.toLowerCase().startsWith('private_'), {
      message: 'IMAGEKIT_PUBLIC_KEY looks like a private key (private_…) — use the public key',
    }),
  IMAGEKIT_PRIVATE_KEY: z.string().optional(),
  IMAGEKIT_URL_ENDPOINT: z.string().optional(),

  // Python ai-service (food classifier, Step 96). Optional — when unset, the
  // backend skips dish enrichment on donation create (the rule-based freshness
  // scoring still runs). The AI service is server-to-server only; the frontend
  // never calls it directly.
  AI_SERVICE_URL: z.string().url().optional(),

  // Rate limiting (Phase 34, Step 87). Defaults match the original hardcoded
  // limits; dev/test environments (E2E suites, load checks) can raise them via
  // env without touching the security defaults for production.
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),

  // Rescue sweep (Phase 19) — how often the job scans for expiring food.
  RESCUE_INTERVAL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  // Rescue & redistribution tuning — all configurable instead of hard-coded:
  //   RESCUE_WINDOW_HOURS        – start alerting donors/volunteers this far
  //                                before the food expires (up to 6 h).
  //   EXPIRY_GRACE_MINUTES       – sweep also catches food that expired up to
  //                                this long ago (delayed job runs).
  //   VOLUNTEER_RADIUS_KM        – only volunteers within this distance of the
  //                                donation get the rescue alert.
  //   RESCUE_SPOT_RADIUS_KM      – search radius for nearby distribution spots
  //                                (bus stands, temples, shelters, …).
  //   RESCUE_AVG_SPEED_KMH       – straight-line speed used to budget the
  //                                "~X min" travel time shown per spot.
  //   RESCUE_PRIORITY_*_HOURS    – urgency tiers by hours left at alert time.
  RESCUE_WINDOW_HOURS: z.coerce.number().positive().default(6),
  EXPIRY_GRACE_MINUTES: z.coerce.number().nonnegative().default(30),
  VOLUNTEER_RADIUS_KM: z.coerce.number().positive().default(15),
  RESCUE_SPOT_RADIUS_KM: z.coerce.number().positive().default(3),
  RESCUE_AVG_SPEED_KMH: z.coerce.number().positive().default(20),
  RESCUE_PRIORITY_INCREASED_HOURS: z.coerce.number().positive().default(6),
  RESCUE_PRIORITY_URGENT_HOURS: z.coerce.number().positive().default(3),
  RESCUE_PRIORITY_EMERGENCY_HOURS: z.coerce.number().positive().default(1),

  // Phase 37 background jobs — how often each periodic sweep runs.
  // Expiry sweep (Step 93): marks past-expiry donations EXPIRED.
  EXPIRY_JOB_INTERVAL_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  // Reminder sweep (Step 94): pickup / pending-acceptance / nearing-expiry alerts.
  REMINDER_JOB_INTERVAL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  // Analytics rollup (Step 95): recomputes the daily Analytics rows.
  ANALYTICS_JOB_INTERVAL_MS: z.coerce.number().int().positive().default(6 * 60 * 60 * 1000),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
