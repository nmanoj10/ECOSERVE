import { defineConfig } from 'vitest/config'

/**
 * Phase 38, Step 96 — backend unit tests.
 *
 * Tests live in `backend/tests/` (outside the `src` tree, so `tsc` keeps
 * building only production code). Node environment; the `.env` file is loaded
 * by `src/config/env.ts` itself (`import 'dotenv/config'`), which the mocked
 * modules below never touch.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Falls back to placeholder env vars so the suite runs without a .env
    // (tests/setup.ts). Real .env values still win where present.
    setupFiles: ['tests/setup.ts'],
    testTimeout: 15_000,
  },
})
