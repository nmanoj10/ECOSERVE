/**
 * Phase 38, Step 98 — Protected pages: real-hook integration.
 *
 * protected-route.test.tsx stubs useAuth to verify each guard branch. This file
 * drives the REAL useAuth hook against a mocked Supabase client, so a
 * regression in session restoration (getSession / onAuthStateChange wiring)
 * cannot hide behind a static hook mock.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/routes/ProtectedRoute'

// Real useAuth; only the Supabase client and the session recorder are mocked.
const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('@/services/supabase', () => ({ supabase: supabaseMock }))

vi.mock('@/api/auth', () => ({
  registerSession: vi.fn(),
}))

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/donor']}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="*" element={<ProtectedRoute>secret content</ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute + real useAuth', () => {
  it('shows the loading screen until the session resolves, then renders the children', async () => {
    let resolveSession: (value: unknown) => void = () => {}
    supabaseMock.auth.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )

    renderProtected()

    // Session still pending → loading screen, no guarded content.
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()

    // Supabase resolves with a signed-in user → the guard renders the children.
    resolveSession({ data: { session: { user: { id: 'u1', email: 'a@b.c' } } }, error: null })

    expect(await screen.findByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('redirects to /login when the restored session is null', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    renderProtected()

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })
})
