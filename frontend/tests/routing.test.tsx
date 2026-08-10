/**
 * Phase 38, Step 98 — Routing tests.
 *
 * App-level route table: the home page renders eagerly, lazy routes resolve
 * through the Suspense fallback, unknown paths hit the 404 page, and protected
 * routes bounce unauthenticated users to /login.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from '@/App'

// gsap + ScrollTrigger are DOM-measurement heavy and jsdom can't lay out —
// stub them so the public pages render inert (the animation is not under test).
vi.mock('@/utils/gsap', () => {
  const tween = { to: vi.fn(), fromTo: vi.fn(), from: vi.fn(), kill: vi.fn() }
  const timeline = () => ({ ...tween, play: vi.fn() })
  return {
    gsap: { to: vi.fn(), fromTo: vi.fn(), from: vi.fn(), timeline, registerPlugin: vi.fn() },
    ScrollTrigger: { refresh: vi.fn() },
    useGSAP: (callback: () => void) => {
      callback()
    },
  }
})

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

// No session — every protected route must redirect to /login.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ session: null, user: null, loading: false }),
}))

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderApp(path: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App routing', () => {
  it('renders the home page at "/"', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: /rescue food/i })).toBeInTheDocument()
  })

  it('resolves lazy routes through the Suspense fallback', async () => {
    renderApp('/login')

    // The lazy LoginPage starts behind the Suspense "Loading…" fallback.
    expect(await screen.findByText('Welcome back')).toBeInTheDocument()
  })

  it('shows the 404 page for unknown paths', async () => {
    renderApp('/this/route/does/not/exist')

    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  })

  it('redirects unauthenticated users from a protected route to /login', async () => {
    renderApp('/donor')

    // Redirect lands on the login page, not the donor dashboard.
    expect(await screen.findByText('Welcome back')).toBeInTheDocument()
    expect(screen.queryByText(/donor dashboard/i)).not.toBeInTheDocument()
  })
})
