/**
 * Phase 38, Step 98 — Form tests.
 *
 * Login, Register, and the New Donation form: client-side validation (zod via
 * react-hook-form), submit flows (success navigation, API failures, error and
 * notice messages), and interactive controls (password toggle, role switch).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import NewDonationPage from '@/pages/donor/NewDonationPage'
import DonorProfilePage from '@/pages/donor/ProfilePage'
import { ToastProvider } from '@/components/ui/Toast'
import { fetchMe, registerUser } from '@/api/auth'
import { api } from '@/api/client'

// ── Module mocks (Supabase session, API layer, auth hook) ───────────────────

// Hoisted so the mock keeps vi.fn() typing (vi.mocked(supabase) would retain
// the real SupabaseClient types and lose mock methods).
const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}))

vi.mock('@/services/supabase', () => ({ supabase: supabaseMock }))

vi.mock('@/api/auth', () => ({
  fetchMe: vi.fn(),
  registerUser: vi.fn(),
  registerSession: vi.fn(),
  logout: vi.fn(),
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  savePendingRegistration: vi.fn(),
  getPendingRegistration: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: null,
    user: { id: 'u1', email: 'alice@example.com', user_metadata: { full_name: 'Alice' } },
    loading: false,
  }),
}))

vi.mock('@/api/notifications', () => ({
  fetchNotifications: vi.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  deleteNotification: vi.fn(),
}))

vi.mock('@/services/socket', () => ({
  connectSocket: vi.fn().mockResolvedValue(null),
  disconnectSocket: vi.fn(),
}))

vi.mock('@/components/maps/LiveTrackingMap', () => ({
  LiveTrackingMap: () => null,
}))

vi.mock('@/components/maps/LocationPinMap', () => ({
  LocationPinMap: () => null,
}))

const mockedFetchMe = vi.mocked(fetchMe)
const mockedRegisterUser = vi.mocked(registerUser)
const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
  supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null }, error: null } as never)
  supabaseMock.auth.signInWithPassword.mockResolvedValue({ error: null } as never)
  supabaseMock.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null } as never)
  supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null } as never)
  supabaseMock.auth.signUp.mockResolvedValue({ data: { session: null }, error: null } as never)
})

// ── Harnesses ────────────────────────────────────────────────────────────────

function renderLogin(initialEntry = '/login', state?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: initialEntry, ...(state ? { state } : {}) }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<div>Register page probe</div>} />
        <Route path="/donor" element={<div>Donor dashboard probe</div>} />
        <Route path="/donor/new" element={<div>New donation probe</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/donor" element={<div>Donor dashboard probe</div>} />
        <Route path="/volunteer" element={<div>Volunteer dashboard probe</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderNewDonation() {
  return render(
    <MemoryRouter initialEntries={['/donor/new']}>
      <ToastProvider>
        <Routes>
          <Route path="/donor/new" element={<NewDonationPage />} />
          <Route path="/donor" element={<div>Donor dashboard probe</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

function renderDonorProfile() {
  return render(
    <MemoryRouter initialEntries={['/donor/profile']}>
      <ToastProvider>
        <Routes>
          <Route path="/donor/profile" element={<DonorProfilePage />} />
          <Route path="/donor" element={<div>Donor dashboard probe</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

// ── Login ───────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  it('shows field errors on an empty submit and does not call Supabase', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: /log ?in/i }))

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(supabaseMock.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('surfaces the Supabase sign-in error in an alert', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    } as never)
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Email Address'), 'alice@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /log ?in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
    expect(mockedFetchMe).not.toHaveBeenCalled()
  })

  it('navigates to the role dashboard after a successful login', async () => {
    mockedFetchMe.mockResolvedValue({ user: { role: 'DONOR' } } as never)
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Email Address'), 'alice@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /log ?in/i }))

    expect(await screen.findByText('Donor dashboard probe')).toBeInTheDocument()
    expect(mockedFetchMe).toHaveBeenCalledTimes(1)
  })

  it('returns to the protected route the user came from', async () => {
    mockedFetchMe.mockResolvedValue({ user: { role: 'DONOR' } } as never)
    const user = userEvent.setup()
    renderLogin('/login', { from: '/donor/new' })

    await user.type(screen.getByLabelText('Email Address'), 'alice@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /log ?in/i }))

    expect(await screen.findByText('New donation probe')).toBeInTheDocument()
  })

  it('routes to registration when the platform user row does not exist yet (401)', async () => {
    mockedFetchMe.mockRejectedValue({ response: { status: 401 } })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Email Address'), 'alice@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /log ?in/i }))

    expect(await screen.findByText('Register page probe')).toBeInTheDocument()
  })

  it('toggles the password visibility', async () => {
    const user = userEvent.setup()
    renderLogin()

    const password = screen.getByLabelText('Password') as HTMLInputElement
    expect(password.type).toBe('password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password.type).toBe('text')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password.type).toBe('password')
  })

  it('starts Google OAuth when "Continue with Google" is clicked', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: /continue with google/i }))

    expect(supabaseMock.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    )
  })

  it('asks for an email before sending a password reset link', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: /forgot password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your email address first')
    expect(supabaseMock.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('sends a password reset link when the email is filled in', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Email Address'), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: /forgot password/i }))

    expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'alice@example.com',
      expect.any(Object),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(/password reset link to alice@example.com/i)
  })
})

// ── Register ────────────────────────────────────────────────────────────────

describe('RegisterPage', () => {
  it('switches the profile section with the selected role', async () => {
    const user = userEvent.setup()
    renderRegister()

    // Default DONOR
    expect(screen.getByText('Organization name')).toBeInTheDocument()

    await user.click(screen.getByText('NGO'))
    expect(await screen.findByText('NGO name')).toBeInTheDocument()
    expect(screen.queryByText('Organization name')).not.toBeInTheDocument()

    await user.click(screen.getByText('Volunteer'))
    expect(await screen.findByText('Vehicle type')).toBeInTheDocument()
    expect(screen.queryByText('NGO name')).not.toBeInTheDocument()
  })

  it('rejects mismatched passwords', async () => {
    const user = userEvent.setup()
    renderRegister()

    // Volunteer needs no profile fields — isolates the password check.
    await user.click(screen.getByText('Volunteer'))
    await user.type(screen.getByLabelText('Full name'), 'Ravi')
    await user.type(screen.getByLabelText('Email'), 'ravi@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm password'), 'password124')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled()
  })

  it('shows the confirmation notice and skips registration when signup needs email confirmation', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.click(screen.getByText('Volunteer'))
    await user.type(screen.getByLabelText('Full name'), 'Ravi')
    await user.type(screen.getByLabelText('Email'), 'ravi@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm password'), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/confirmation link/)
    expect(mockedRegisterUser).not.toHaveBeenCalled()
  })

  it('registers the platform user and lands on the role dashboard', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    } as never)
    mockedRegisterUser.mockResolvedValue({ user: { role: 'VOLUNTEER' } } as never)
    const user = userEvent.setup()
    renderRegister()

    await user.click(screen.getByText('Volunteer'))
    await user.type(screen.getByLabelText('Full name'), 'Ravi Kumar')
    await user.type(screen.getByLabelText('Email'), 'ravi@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm password'), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Volunteer dashboard probe')).toBeInTheDocument()
    await waitFor(() => {
      expect(mockedRegisterUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'VOLUNTEER', fullName: 'Ravi Kumar' }),
      )
    })
  })

  it('displays a registration API error', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    } as never)
    mockedRegisterUser.mockRejectedValue({
      response: { data: { error: { message: 'Email already registered' } } },
    })
    const user = userEvent.setup()
    renderRegister()

    await user.click(screen.getByText('Volunteer'))
    await user.type(screen.getByLabelText('Full name'), 'Ravi')
    await user.type(screen.getByLabelText('Email'), 'ravi@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm password'), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered')
  })
})

// ── New donation ────────────────────────────────────────────────────────────

describe('NewDonationPage', () => {
  it('shows required-field errors on an empty submit and does not call the API', async () => {
    const user = userEvent.setup()
    renderNewDonation()

    await user.click(screen.getByRole('button', { name: /list donation/i }))

    // foodName + pickupAddress both surface "Required".
    expect(await screen.findAllByText('Required')).toHaveLength(2)
    expect(screen.getByText('Enter a quantity greater than 0')).toBeInTheDocument()
    expect(screen.getByText('Pickup expiry is required')).toBeInTheDocument()
    expect(screen.getByText('Pickup time is required')).toBeInTheDocument()
    expect(mockedApi.post).not.toHaveBeenCalled()
  })

  it('rejects a pickup time after the expiry time', async () => {
    const user = userEvent.setup()
    renderNewDonation()

    await user.type(screen.getByLabelText(/food name/i), 'Paneer Biryani')
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '10' } })
    // Pickup AFTER expiry — must be rejected.
    fireEvent.change(screen.getByLabelText(/^expiry/i), { target: { value: '2026-08-10T12:00' } })
    fireEvent.change(screen.getByLabelText(/pickup time/i), { target: { value: '2026-08-10T14:00' } })
    await user.type(screen.getByLabelText(/pickup address/i), '12 MG Road, Bengaluru')
    await user.click(screen.getByRole('button', { name: /list donation/i }))

    expect(await screen.findByText('Pickup must happen before the food expires')).toBeInTheDocument()
    expect(mockedApi.post).not.toHaveBeenCalled()
  })

  it('submits a valid donation, shows a success toast, and returns to the dashboard', async () => {
    mockedApi.post.mockResolvedValue({ data: { donation: { id: 'don-1' } } } as never)
    const user = userEvent.setup()
    renderNewDonation()

    await user.type(screen.getByLabelText(/food name/i), 'Paneer Biryani')
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(/^expiry/i), { target: { value: '2026-08-10T16:00' } })
    fireEvent.change(screen.getByLabelText(/pickup time/i), { target: { value: '2026-08-10T14:00' } })
    await user.type(screen.getByLabelText(/pickup address/i), '12 MG Road, Bengaluru')
    await user.click(screen.getByRole('button', { name: /list donation/i }))

    expect(await screen.findByText('Donor dashboard probe')).toBeInTheDocument()
    expect(mockedApi.post).toHaveBeenCalledWith(
      '/v1/donations',
      expect.objectContaining({ foodName: 'Paneer Biryani', quantity: 10, unit: 'kg' }),
    )
  })

  it('shows an error toast when the listing API fails and stays on the form', async () => {
    mockedApi.post.mockRejectedValue({
      response: { data: { error: { message: 'Expiry must be in the future' } } },
    })
    const user = userEvent.setup()
    renderNewDonation()

    await user.type(screen.getByLabelText(/food name/i), 'Paneer Biryani')
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(/^expiry/i), { target: { value: '2026-08-10T16:00' } })
    fireEvent.change(screen.getByLabelText(/pickup time/i), { target: { value: '2026-08-10T14:00' } })
    await user.type(screen.getByLabelText(/pickup address/i), '12 MG Road, Bengaluru')
    await user.click(screen.getByRole('button', { name: /list donation/i }))

    expect(await screen.findByText('Could not list donation')).toBeInTheDocument()
    expect(screen.getByText('Expiry must be in the future')).toBeInTheDocument()
    // No navigation — the form stays mounted so the user can retry.
    expect(screen.getByRole('button', { name: /list donation/i })).toBeInTheDocument()
  })

  it('shows the estimated impact as the quantity is typed', async () => {
    renderNewDonation()

    expect(screen.getByText('Enter a quantity to see the estimated reach.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '40' } })

    // Grains default → ~6 meals/kg → 240 meals.
    expect(await screen.findByText('~240')).toBeInTheDocument()
    expect(screen.getByText('meals served')).toBeInTheDocument()
  })

  it('requires both latitude and longitude together before listing', async () => {
    const user = userEvent.setup()
    renderNewDonation()

    await user.type(screen.getByLabelText(/food name/i), 'Paneer Biryani')
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(/^expiry/i), { target: { value: '2026-08-10T16:00' } })
    fireEvent.change(screen.getByLabelText(/pickup time/i), { target: { value: '2026-08-10T14:00' } })
    await user.type(screen.getByLabelText(/pickup address/i), '12 MG Road, Bengaluru')
    // Only one half of the pin — must be rejected.
    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '12.9716' } })
    await user.click(screen.getByRole('button', { name: /list donation/i }))

    expect(await screen.findByText(/Set both latitude and longitude/i)).toBeInTheDocument()
    expect(mockedApi.post).not.toHaveBeenCalled()
  })

  it('sends the location pin with the listing when both coordinates are set', async () => {
    mockedApi.post.mockResolvedValue({ data: { donation: { id: 'don-1' } } } as never)
    const user = userEvent.setup()
    renderNewDonation()

    await user.type(screen.getByLabelText(/food name/i), 'Paneer Biryani')
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(/^expiry/i), { target: { value: '2026-08-10T16:00' } })
    fireEvent.change(screen.getByLabelText(/pickup time/i), { target: { value: '2026-08-10T14:00' } })
    await user.type(screen.getByLabelText(/pickup address/i), '12 MG Road, Bengaluru')
    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '12.9716' } })
    fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '77.5946' } })
    await user.click(screen.getByRole('button', { name: /list donation/i }))

    expect(await screen.findByText('Donor dashboard probe')).toBeInTheDocument()
    expect(mockedApi.post).toHaveBeenCalledWith(
      '/v1/donations',
      expect.objectContaining({ latitude: 12.9716, longitude: 77.5946 }),
    )
  })
})

// ── Donor profile ───────────────────────────────────────────────────────────

describe('DonorProfilePage', () => {
  const donorProfile = {
    organizationName: 'Spice House',
    organizationType: 'Restaurant',
    address: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    latitude: null,
    longitude: null,
  }

  beforeEach(() => {
    mockedFetchMe.mockResolvedValue({ user: { donor: donorProfile } } as never)
  })

  it('prefills the form from the profile and requires both coordinates together', async () => {
    const user = userEvent.setup()
    renderDonorProfile()

    expect(await screen.findByLabelText(/organization name/i)).toHaveValue('Spice House')

    // Only one half of the pin — must be rejected.
    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '12.9716' } })
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/Set both latitude and longitude/i)).toBeInTheDocument()
    expect(mockedApi.patch).not.toHaveBeenCalled()
  })

  it('saves the location pin with the profile and shows a success toast', async () => {
    mockedApi.patch.mockResolvedValue({
      data: { donor: { ...donorProfile, latitude: 12.9716, longitude: 77.5946 } },
    } as never)
    const user = userEvent.setup()
    renderDonorProfile()

    await screen.findByLabelText(/organization name/i)
    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '12.9716' } })
    fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '77.5946' } })
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Profile updated')).toBeInTheDocument()
    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/v1/donor/profile',
      expect.objectContaining({ latitude: 12.9716, longitude: 77.5946, organizationName: 'Spice House' }),
    )
  })

  it('clears a previously-set pin when both coordinates are blanked', async () => {
    mockedFetchMe.mockResolvedValue({
      user: { donor: { ...donorProfile, latitude: 12.9716, longitude: 77.5946 } },
    } as never)
    mockedApi.patch.mockResolvedValue({
      data: { donor: { ...donorProfile, latitude: null, longitude: null } },
    } as never)
    const user = userEvent.setup()
    renderDonorProfile()

    const lat = (await screen.findByLabelText(/latitude/i)) as HTMLInputElement
    // number inputs report their value as a number
    expect(lat).toHaveValue(12.9716)
    fireEvent.change(lat, { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Profile updated')).toBeInTheDocument()
    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/v1/donor/profile',
      expect.objectContaining({ latitude: null, longitude: null }),
    )
  })
})
