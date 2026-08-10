/**
 * Phase 38, Step 96 — hermetic test environment.
 *
 * Runs BEFORE any test file imports src modules. `src/config/env.ts` exits the
 * process when a required var is missing, so give every required var a safe
 * fallback. Real `.env` values still win: dotenv never overrides an existing
 * `process.env` entry, and this file only sets vars that are unset.
 */
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/ecoserve_test?sslmode=require'
process.env.SUPABASE_URL ??= 'https://test-project.supabase.co'
process.env.SUPABASE_PUBLISHABLE_KEY ??= 'test-publishable-key'
process.env.SUPABASE_SECRET_KEY ??= 'test-secret-key'
process.env.SUPABASE_JWKS_URL ??= 'https://test-project.supabase.co/auth/v1/.well-known/jwks.json'
process.env.NODE_ENV ??= 'test'

export {}
