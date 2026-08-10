/**
 * Phase 38, Step 98 — Protected pages.
 *
 * ProtectedRoute gates every dashboard route: it shows a loading screen while
 * the session resolves, redirects to /login (remembering the origin) when
 * unauthenticated, and renders the route children when signed in.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)

/** Renders at /login and echoes the redirect state the guard passed along. */
function LocationSpy() {
  const location = useLocation()
  return (
    <div>
      Login page — from: <span data-testid="from">{String((location.state as { from?: string } | null)?.from ?? 'none')}</span>
    </div>
  )
}

function renderProtected(initialEntry = '/donor') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LocationSpy />} />
        <Route path="*" element={<ProtectedRoute>secret content</ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('shows a loading screen while the session is resolving', () => {
    mockedUseAuth.mockReturnValue({ session: null, user: null, loading: true } as never)
    renderProtected()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })

  it('redirects unauthenticated users to /login with the origin in state', () => {
    mockedUseAuth.mockReturnValue({ session: null, user: null, loading: false } as never)
    renderProtected('/donor')

    expect(screen.getByTestId('from')).toHaveTextContent('/donor')
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })

  it('renders the children for an authenticated user', () => {
    mockedUseAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      user: { id: 'u1' },
      loading: false,
    } as never)
    renderProtected()

    expect(screen.getByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })
})
