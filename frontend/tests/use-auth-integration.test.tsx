/**
 * Phase 38, Step 98 — Protected pages: real-hook integration.
 *
 * protected-route.test.tsx stubs useAuth to verify each guard branch. This file
 * drives the REAL useAuth hook against a mocked local-auth client, so a
 * regression in session restoration (getAccessToken / getCurrentUser wiring)
 * cannot hide behind a static hook mock.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/routes/ProtectedRoute'
import type { User } from '@/services/local-auth'
import { getAccessToken, getCurrentUser } from '@/services/local-auth'

// Real useAuth; only the local-auth service is mocked.
const mockedGetAccessToken = vi.mocked(getAccessToken)
const mockedGetCurrentUser = vi.mocked(getCurrentUser)

vi.mock('@/services/local-auth', () => ({
  getAccessToken: vi.fn(),
  getCurrentUser: vi.fn(),
  signup: vi.fn(),
  login: vi.fn(),
  setTokens: vi.fn(),
  logout: vi.fn(),
}))

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
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetAccessToken.mockReturnValue(null)
    mockedGetCurrentUser.mockResolvedValue(null)
  })

  it('shows the loading screen until the session resolves, then renders the children', async () => {
    let resolveUser: (value: User | null) => void = () => {}
    mockedGetAccessToken.mockReturnValue('token')
    mockedGetCurrentUser.mockReturnValue(
      new Promise((resolve) => {
        resolveUser = resolve
      }),
    )

    renderProtected()

    // Session still pending → loading screen, no guarded content.
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()

    // Local auth resolves with a signed-in user → the guard renders the children.
    resolveUser({ id: 'u1', email: 'a@b.c', role: 'DONOR', status: 'ACTIVE' })

    expect(await screen.findByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('redirects to /login when the restored session is null', async () => {
    mockedGetAccessToken.mockReturnValue('token')
    mockedGetCurrentUser.mockResolvedValue(null)

    renderProtected()

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })
})
