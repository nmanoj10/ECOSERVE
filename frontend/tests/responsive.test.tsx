/**
 * Phase 38, Step 98 — Responsive layouts.
 *
 * Layout breakpoints are Tailwind classes (asserted structurally here — visual
 * verification happens in a real browser) and the behaviors that change at
 * breakpoints (the dashboard's mobile drawer) are exercised functionally.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'

import AuthLayout from '@/components/layout/AuthLayout'
import DashboardShell from '@/components/layout/DashboardShell'

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
  logout: vi.fn(),
  registerSession: vi.fn(),
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

describe('AuthLayout', () => {
  it('hides the brand panel below lg and always shows the form panel', () => {
    render(
      <MemoryRouter>
        <AuthLayout title="Welcome back" subtitle="Log in">
          <div>Form content</div>
        </AuthLayout>
      </MemoryRouter>,
    )

    const aside = document.querySelector('aside')!
    expect(aside.className).toContain('hidden')
    expect(aside.className).toContain('lg:block')

    // The mobile-only brand link is the inverse: hidden on lg+.
    const mobileBrand = screen.getAllByLabelText('Ecoserve home').find((el) => el.className.includes('lg:hidden'))
    expect(mobileBrand).toBeDefined()

    expect(screen.getByText('Form content')).toBeInTheDocument()
  })
})

describe('DashboardShell responsive navigation', () => {
  const nav = [{ label: 'Overview', to: '/donor', icon: LayoutDashboard, end: true }]

  function renderShell() {
    return render(
      <MemoryRouter initialEntries={['/donor']}>
        <DashboardShell roleLabel="Donor" nav={nav} title="Donor dashboard" subtitle="At a glance">
          <p>Dashboard body</p>
        </DashboardShell>
      </MemoryRouter>,
    )
  }

  it('renders the sidebar as a fixed desktop panel and the menu button as mobile-only', () => {
    renderShell()

    const desktopSidebar = document.querySelector('aside')!
    expect(desktopSidebar.className).toContain('hidden')
    expect(desktopSidebar.className).toContain('lg:block')
    expect(desktopSidebar).toHaveTextContent('Overview')

    const menuButton = screen.getByRole('button', { name: 'Open menu' })
    expect(menuButton.className).toContain('lg:hidden')
  })

  it('opens and closes the mobile drawer', async () => {
    const user = userEvent.setup()
    renderShell()

    // Drawer is closed initially.
    expect(screen.queryByLabelText('Close menu')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    // Drawer appears with a close button and the nav content.
    const drawer = screen.getByLabelText('Close menu').closest('.fixed')!
    expect(drawer.className).toContain('lg:hidden')
    expect(withinDrawer('Overview')).toBeDefined()

    await user.click(screen.getByLabelText('Close menu'))
    expect(screen.queryByLabelText('Close menu')).not.toBeInTheDocument()
  })
})

/** Finds an element with the given text inside the mobile drawer region. */
function withinDrawer(text: string) {
  return [...document.querySelectorAll('.fixed')]
    .flatMap((node) => [...node.querySelectorAll('*')])
    .find((el) => el.textContent === text)
}
