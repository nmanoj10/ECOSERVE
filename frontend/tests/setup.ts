/**
 * Phase 38, Step 98 — test environment setup.
 *
 * - Registers the jest-dom matchers (toBeInTheDocument, …).
 * - Polyfills browser APIs jsdom lacks (matchMedia, ResizeObserver used by
 *   recharts' ResponsiveContainer, scrollTo).
 * - Cleans up the DOM between tests (vitest globals are off, so RTL's
 *   auto-cleanup won't fire on its own).
 */
import '@testing-library/jest-dom/vitest'

import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom doesn't implement matchMedia — components that branch on breakpoints
// (none today, but guards future responsive work) get a stable non-matching stub.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// recharts <ResponsiveContainer> measures its parent via ResizeObserver.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
window.ResizeObserver = window.ResizeObserver ?? (ResizeObserverStub as never)

// Some components scroll to top on route change.
window.scrollTo = () => {}

afterEach(() => {
  cleanup()
})
