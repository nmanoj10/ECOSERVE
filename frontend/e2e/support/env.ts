/**
 * Phase 38, Step 99 — E2E environment.
 *
 * Loads the same credentials the running apps use:
 *   - frontend/.env.local → Supabase URL + publishable key
 *   - backend/.env        → Supabase service-role key (for the Admin API),
 *                           backend API base (for direct API calls)
 *
 * Never print the secret values — only booleans/lengths should be logged.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// Resolve from this module so the suite works regardless of the cwd.
const FRONTEND_DIR = fileURLToPath(new URL('../..', import.meta.url))

function loadEnvFile(relativePath: string): Record<string, string> {
  try {
    const raw = readFileSync(resolve(FRONTEND_DIR, relativePath), 'utf8')
    const out: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (match) out[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
    return out
  } catch {
    return {}
  }
}

const frontendEnv = loadEnvFile('.env.local')
const backendEnv = loadEnvFile('../backend/.env')

const env = {
  frontendUrl: process.env.E2E_FRONTEND_URL ?? 'http://localhost:5173',
  apiBase: process.env.E2E_API_URL ?? 'http://localhost:3001/api/v1',
  supabaseUrl: (process.env.E2E_SUPABASE_URL ?? frontendEnv.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  publishableKey: process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? frontendEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  /** Service-role key — ONLY for creating confirmed test users via the Admin API. */
  serviceRoleKey: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? backendEnv.SUPABASE_SECRET_KEY ?? '',
} as const

// Fail fast with a readable message instead of cryptic empty-URL errors later.
const requiredVars = [
  ['supabaseUrl', 'VITE_SUPABASE_URL in frontend/.env.local'],
  ['publishableKey', 'VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env.local'],
  ['serviceRoleKey', 'SUPABASE_SECRET_KEY in backend/.env'],
] as const
const missing = requiredVars.filter(([key]) => !env[key])
if (missing.length > 0) {
  throw new Error(`E2E config incomplete — missing ${missing.map(([, source]) => source).join(', ')}`)
}

export { env }

/** Test users live at these coordinates so the nearby search and route maps work. */
export const TEST_COORDS = {
  donor: { latitude: 12.9716, longitude: 77.5946 }, // Bengaluru city centre
  ngo: { latitude: 12.9352, longitude: 77.6245 }, // ~5 km east — inside the 25 km radius
  volunteer: { latitude: 12.9833, longitude: 77.5811 }, // ~1.5 km north of the donor
} as const
