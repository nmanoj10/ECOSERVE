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
  SUPABASE_URL: z.string().url('SUPABASE_URL is required'),
  // Phase 35/36, Step 90 — guards against the most dangerous misconfiguration:
  // pasting a *secret* into a publishable (client-exposed) variable. The
  // publishable key is shipped to the browser via VITE_*, so if it accidentally
  // holds a secret key the app fails fast instead of leaking it.
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'SUPABASE_PUBLISHABLE_KEY is required')
    .refine((key) => !key.toLowerCase().startsWith('sb_secret_'), {
      message: 'SUPABASE_PUBLISHABLE_KEY looks like a secret key (sb_secret_…) — use the publishable key',
    }),
  SUPABASE_SECRET_KEY: z.string().min(1, 'SUPABASE_SECRET_KEY is required'),
  SUPABASE_JWKS_URL: z.string().url('SUPABASE_JWKS_URL is required'),

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

  // Rescue sweep (Phase 19) — how often the job scans for expiring food.
  RESCUE_INTERVAL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),

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
