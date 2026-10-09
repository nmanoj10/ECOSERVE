/**
 * Phase 38, Step 98 — Loading & error states.
 *
 * - The donor dashboard shows skeleton placeholders while data loads and an
 *   ErrorState with a working retry when the API call fails.
 * - ErrorState renders its message and invokes onRetry.
 * - ErrorBoundary catches a crashing subtree and recovers when resetKey changes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import DonorDashboardPage from '@/pages/donor/DashboardPage'
import { ToastProvider } from '@/components/ui/Toast'
import { ErrorState } from '@/components/ui/ErrorState'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { fetchMe, listSessions } from '@/api/auth'
import { fetchDonorAnalytics } from '@/api/analytics'
import { fetchDonations } from '@/api/donations'
import { fetchActiveDeliveries } from '@/api/volunteer'

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: null,
    user: { id: 'u1', email: 'alice@example.com', user_metadata: { full_name: 'Alice' } },
    loading: false,
  }),
}))

vi.mock('@/api/auth', () => ({
  fetchMe: vi.fn(),
  listSessions: vi.fn(),
  logout: vi.fn(),
  registerSession: vi.fn(),
  revokeSession: vi.fn(),
}))

vi.mock('@/api/analytics', () => ({ fetchDonorAnalytics: vi.fn() }))
vi.mock('@/api/donations', () => ({ fetchDonations: vi.fn() }))
vi.mock('@/api/volunteer', () => ({
  fetchActiveDeliveries: vi.fn(),
  // Phase 45 — imported by NotificationsCard (accept-delivery action).
  acceptDelivery: vi.fn(),
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

// CountUp animates via gsap until scrolled into view — jsdom never scrolls, so
// report reduced-motion: CountUp then renders the final value immediately.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as never
})

const mockedFetchMe = vi.mocked(fetchMe)
const mockedListSessions = vi.mocked(listSessions)
const mockedAnalytics = vi.mocked(fetchDonorAnalytics)
const mockedDonations = vi.mocked(fetchDonations)
const mockedActive = vi.mocked(fetchActiveDeliveries)

function successData() {
  mockedFetchMe.mockResolvedValue({
    user: { fullName: 'Alice Smith', email: 'alice@example.com', status: 'ACTIVE', role: 'DONOR', donor: { organizationName: 'Green Kitchen', organizationType: 'Restaurant', city: 'Bengaluru', state: 'Karnataka' } },
  } as never)
  mockedListSessions.mockResolvedValue({ sessions: [] } as never)
  mockedAnalytics.mockResolvedValue({
    summary: { totalDonations: 12, foodSavedKg: 48.5, peopleServed: 194, co2Kg: 121.3 },
    byMonth: [
      { month: '2026-03', donations: 1, kg: 2 },
      { month: '2026-04', donations: 3, kg: 10 },
    ],
    byCategory: [{ category: 'Cooked', listed: 4, kg: 20 }],
  } as never)
  mockedDonations.mockResolvedValue({
    donations: [
      {
        id: 'don-abc123',
        foodName: 'Paneer Biryani',
        quantity: 8,
        unit: 'kg',
        status: 'DELIVERED',
        createdAt: '2026-08-01T10:00:00Z',
        category: { name: 'Cooked' },
      },
    ],
    pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
  } as never)
  mockedActive.mockResolvedValue({ deliveries: [] } as never)
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/donor']}>
      <ToastProvider>
        <DonorDashboardPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('DonorDashboardPage loading & error states', () => {
  it('shows skeleton placeholders while the initial data loads', () => {
    mockedFetchMe.mockReturnValue(new Promise(() => {}) as never) // never resolves
    mockedListSessions.mockReturnValue(new Promise(() => {}) as never)
    mockedAnalytics.mockReturnValue(new Promise(() => {}) as never)
    mockedDonations.mockReturnValue(new Promise(() => {}) as never)
    mockedActive.mockResolvedValue({ deliveries: [] } as never)

    const { container } = renderDashboard()

    // KPI row + chart skeletons render with the pulse animation class.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
  })

  it('shows an ErrorState with a retry that recovers', async () => {
    const user = userEvent.setup()
    mockedFetchMe.mockRejectedValue({ response: { data: { error: { message: 'Failed to load your dashboard' } } } })
    mockedListSessions.mockRejectedValue(new Error('nope'))
    mockedAnalytics.mockRejectedValue(new Error('nope'))
    mockedDonations.mockRejectedValue(new Error('nope'))
    mockedActive.mockResolvedValue({ deliveries: [] } as never)

    renderDashboard()

    // The caught fetch error surfaces through ErrorState with retry.
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load your dashboard')

    // Fix the API and click "Try again" — the dashboard recovers.
    successData()
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('Total donations')).toBeInTheDocument()
    // Exact match — /12/ would also hit the "121.3 kg" CO₂ KPI.
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders live KPI values once the data resolves', async () => {
    successData()

    renderDashboard()

    expect(await screen.findByText('Total donations')).toBeInTheDocument()
    // "Food saved" is both a KPI label and the chart card title.
    expect(screen.getAllByText('Food saved').length).toBeGreaterThan(0)
    expect(screen.getByText('People served')).toBeInTheDocument()
    // Recent donations table renders the live listing.
    expect(await screen.findByText('Paneer Biryani')).toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it('renders the title, description, and retry label', () => {
    render(<ErrorState title="Oops" description="Something broke" retryLabel="Reload" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Oops')
    expect(screen.getByText('Something broke')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument() // no onRetry → no button
  })

  it('invokes onRetry when clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn().mockResolvedValue(undefined)
    render(<ErrorState title="Oops" onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows a retry button when an error is supplied', () => {
    render(
      <ErrorState title="Oops" description="Something broke" retryLabel="Try again" error={new Error('refused')} onRetry={() => {}} />,
    )

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('shows a waiting spinner when a 429/403 is waiting for Retry-After', () => {
    const error = new Error('Too Many Requests')
    Object.defineProperty(error, 'response', {
      value: { headers: { 'retry-after': '2' } },
      writable: true,
    })

    render(<ErrorState title="Oops" error={error} onRetry={() => {}} />)

    expect(screen.getByRole('button', { name: /waiting/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /waiting/i })).toBeDisabled()
  })
})

describe('ErrorBoundary', () => {
  // Spy is owned by the describe block so a failed assertion can never leave
  // console.error silenced for later tests.
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('catches a crashing child and shows the fallback', () => {
    function Bomb(): never {
      throw new Error('boom')
    }

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
  })

  it('recovers when resetKey changes', () => {
    function Bomb({ boom }: { boom: boolean }) {
      if (boom) throw new Error('boom')
      return <div>Safe content</div>
    }

    const { rerender } = render(
      <ErrorBoundary resetKey={1}>
        <Bomb boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(
      <ErrorBoundary resetKey={2}>
        <Bomb boom={false} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Safe content')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
