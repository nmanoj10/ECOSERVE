import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Bell, ChevronsUpDown, LayoutDashboard, Leaf, LogOut, Menu, X } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/Dropdown'
import { logout } from '@/api/auth'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/services/supabase'

export interface DashboardNavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

interface DashboardShellProps {
  /** Role label shown as a badge in the sidebar, e.g. "Donor". */
  roleLabel: string
  nav: DashboardNavItem[]
  title: string
  subtitle?: string
  children: ReactNode
}

export default function DashboardShell({ roleLabel, nav, title, subtitle, children }: DashboardShellProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [title])

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Ecoserve user'
  const email = user?.email ?? ''

  const handleSignOut = async () => {
    const { data } = await supabase.auth.getSession()
    const refreshToken = data.session?.refresh_token
    await supabase.auth.signOut()
    if (refreshToken) {
      logout(refreshToken).catch(() => {})
    }
    navigate('/')
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <Link to="/" className="flex h-16 items-center gap-2.5 px-5" aria-label="Ecoserve home">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
          <Leaf className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-neutral-900">Ecoserve</span>
      </Link>

      <div className="px-4 pt-2">
        <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
          {roleLabel}
        </span>
      </div>

      {/* Nav */}
      <nav aria-label="Dashboard" className="mt-4 flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`
            }
          >
            <item.icon className="size-4.5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User card */}
      <div className="border-t border-neutral-100 p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Avatar name={displayName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">{displayName}</p>
            <p className="truncate text-xs text-neutral-500">{email || roleLabel}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out" className="size-8 rounded-lg">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-neutral-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-overlay-in absolute inset-0 bg-neutral-950/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="animate-panel-in absolute inset-y-0 left-0 w-72 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="size-4.5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="lg:hidden"
            >
              <Menu className="size-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold tracking-tight text-neutral-900">{title}</h1>
              {subtitle && <p className="truncate text-xs text-neutral-500">{subtitle}</p>}
            </div>

            <Button variant="ghost" size="icon" aria-label="Notifications" className="hidden sm:inline-flex">
              <Bell className="size-4.5" />
            </Button>

            <Dropdown>
              <DropdownTrigger>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full p-1 transition hover:bg-neutral-100"
                >
                  <Avatar name={displayName} size="sm" />
                  <ChevronsUpDown className="size-3.5 text-neutral-400" />
                </button>
              </DropdownTrigger>
              <DropdownContent align="end">
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={displayName} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{displayName}</p>
                    <p className="truncate text-xs text-neutral-500">{email || roleLabel}</p>
                  </div>
                </div>
                <DropdownSeparator />
                <DropdownItem onClick={() => navigate('/')}>
                  <LayoutDashboard className="size-4" />
                  Back to home
                </DropdownItem>
                <DropdownItem danger onClick={handleSignOut}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">{children}</main>
      </div>
    </div>
  )
}
