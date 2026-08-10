import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Bell, CheckCheck, ChevronsUpDown, LayoutDashboard, Leaf, LogOut, Menu, X } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import type { Socket } from 'socket.io-client'

import { logout } from '@/api/auth'
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/api/notifications'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/Dropdown'
import { useAuth } from '@/hooks/useAuth'
import { connectSocket, disconnectSocket } from '@/services/socket'
import { supabase } from '@/services/supabase'

export interface DashboardNavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
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

  // ── Notifications (Phase 19): fetch once + live-push via Socket.IO ──
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifLoading, setNotifLoading] = useState(true)

  useEffect(() => {
    let active = true
    let live: Socket | null = null

    const init = async () => {
      const [list, socket] = await Promise.all([fetchNotifications({ limit: 20 }).catch(() => null), connectSocket()])
      if (!active) return
      if (list) {
        setNotifications(list.notifications)
        setUnreadCount(list.unreadCount)
      }
      setNotifLoading(false)

      live = socket
      socket?.on('notification', (notification: NotificationItem) => {
        setNotifications((prev) => [notification, ...prev].slice(0, 30))
        setUnreadCount((count) => count + 1)
      })
    }

    void init()
    return () => {
      active = false
      live?.off('notification')
      disconnectSocket()
    }
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })))
      setUnreadCount(0)
    } catch {
      // Keep the badge until the next successful sync — nothing to show here.
    }
  }

  const handleMarkRead = async (notification: NotificationItem) => {
    if (notification.isRead) return
    try {
      await markNotificationRead(notification.id)
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)))
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch {
      // Leave the item as-is on failure — the next sync will reconcile.
    }
  }

  const handleDelete = async (notification: NotificationItem) => {
    try {
      await deleteNotification(notification.id)
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
      if (!notification.isRead) {
        setUnreadCount((count) => Math.max(0, count - 1))
      }
    } catch {
      // Keep the item on failure — nothing to do here.
    }
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

            <Dropdown>
              <DropdownTrigger>
                <button
                  type="button"
                  aria-label={`Notifications (${unreadCount} unread)`}
                  className="relative hidden rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 sm:inline-flex"
                >
                  <Bell className="size-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold leading-none text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownTrigger>
              <DropdownContent align="end" className="w-80">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="text-sm font-semibold text-neutral-900">Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
                    >
                      <CheckCheck className="size-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>
                <DropdownSeparator />
                <div className="max-h-80 overflow-y-auto">
                  {notifLoading ? (
                    <p className="px-3 py-6 text-center text-xs text-neutral-400">Loading…</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-neutral-500">No notifications yet.</p>
                  ) : (
                    <ul className="space-y-0.5 p-1.5">
                      {notifications.map((notification) => (
                        <li key={notification.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => handleMarkRead(notification)}
                            className={`w-full rounded-lg p-2.5 pr-8 text-left transition hover:bg-neutral-50 ${
                              notification.isRead ? 'opacity-70' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="mt-1.5 w-1.5 shrink-0">
                                {!notification.isRead && <span className="block size-1.5 rounded-full bg-brand-500" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`text-sm font-medium ${
                                    notification.isRead ? 'text-neutral-600' : 'text-neutral-900'
                                  }`}
                                >
                                  {notification.title}
                                </p>
                                <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{notification.message}</p>
                                <p className="mt-1 text-[11px] text-neutral-400">{timeAgo(notification.createdAt)}</p>
                              </div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(notification)}
                            aria-label={`Delete notification: ${notification.title}`}
                            title="Delete notification"
                            className="absolute right-1.5 top-1.5 rounded-md p-1 text-neutral-300 opacity-0 transition hover:bg-neutral-100 hover:text-neutral-500 focus:opacity-100 group-hover:opacity-100"
                          >
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </DropdownContent>
            </Dropdown>

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
