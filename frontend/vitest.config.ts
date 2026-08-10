import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Phase 38, Step 98 — frontend unit/component tests.
 *
 * Tests live in `frontend/tests/` and run in jsdom. The `@` alias mirrors
 * vite.config.ts. The Tailwind plugin is intentionally omitted — components
 * don't import CSS, so the plugin would only slow the test transform down.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15_000,
  },
})
