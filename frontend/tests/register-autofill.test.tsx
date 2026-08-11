/**
 * Register address auto-fill — when creating an account as a DONOR or NGO,
 * the Address / City / State fields are filled automatically from the user's
 * current location (browser geolocation + the backend reverse-geocode proxy).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import RegisterPage from '@/pages/auth/RegisterPage'
import { reverseGeocode } from '@/api/geo'

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signUp: vi.fn(),
    },
  },
}))

vi.mock('@/api/auth', () => ({
  registerUser: vi.fn(),
  registerSession: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/api/geo', () => ({ reverseGeocode: vi.fn() }))

const mockedReverseGeocode = vi.mocked(reverseGeocode)

beforeEach(() => {
  vi.clearAllMocks()
  mockedReverseGeocode.mockResolvedValue({
    place: { address: '123, MG Road', city: 'Mumbai', state: 'Maharashtra' },
  } as never)
})

// jsdom ships no Geolocation API (or only a stub) — provide a fake that
// resolves instantly to Mumbai coordinates.
Object.defineProperty(navigator, 'geolocation', {
  configurable: true,
  value: {
    getCurrentPosition: vi.fn((success: (pos: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) =>
      success({ coords: { latitude: 19.076, longitude: 72.8777, accuracy: 50 } }),
    ),
  },
})

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/donor" element={<div>Donor dashboard probe</div>} />
        <Route path="/ngo" element={<div>NGO dashboard probe</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RegisterPage address auto-fill', () => {
  it('auto-fills the DONOR address fields from the current location', async () => {
    renderRegister()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Street address')).toHaveValue('123, MG Road')
    })
    expect(screen.getByPlaceholderText('Mumbai')).toHaveValue('Mumbai')
    expect(screen.getByPlaceholderText('Maharashtra')).toHaveValue('Maharashtra')
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('auto-fills the NGO address fields after switching roles', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.click(screen.getByText('NGO'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Street address')).toHaveValue('123, MG Road')
    })
    expect(screen.getByPlaceholderText('Mumbai')).toHaveValue('Mumbai')
    expect(screen.getByPlaceholderText('Maharashtra')).toHaveValue('Maharashtra')
  })
})
