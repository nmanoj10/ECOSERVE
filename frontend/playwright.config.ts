import { defineConfig } from '@playwright/test'

/**
 * Phase 38, Step 99 — End-to-end tests.
 *
 * The suite drives the REAL full stack (frontend :5173 → backend :3001 →
 * Supabase + ImageKit, with the AI service :8000 enriching donation photos).
 * Start those services first (see docs/e2e-testing.md) — this config does not
 * spawn them so the same stack can serve both dev and the E2E run.
 *
 * Uses the system Google Chrome (channel: 'chrome') instead of a downloaded
 * Playwright Chromium build. `reducedMotion: 'reduce'` makes the CountUp KPIs
 * render their final values instantly (they animate via gsap otherwise).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  // No retries: the journey is serial and side-effectful (users, donations,
  // assignments are created for real). Re-running a mid-suite step would
  // duplicate rows and break downstream assertions — each run starts fresh
  // accounts, so a failed run should simply be re-run in full.
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    headless: true,
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Each future spec needs its own project entry (testMatch is not a global
  // filter — it decides which files THIS project runs).
  projects: [{ name: 'happy-path', testMatch: /happy-path\.spec\.ts/ }],
})
