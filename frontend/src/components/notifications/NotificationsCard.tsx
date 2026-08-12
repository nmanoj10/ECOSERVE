import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, Info, MapPin, Sparkles, Truck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/api/notifications'
import { timeAgo } from '@/components/layout/DashboardShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { connectSocket } from '@/services/socket'

/** Notification icon/tone keyed by the backend's notification type codes. */
const notificationStyle: Record<string, { icon: LucideIcon; classes: string }> = {
  REQUEST: { icon: Info, classes: 'bg-brand-50 text-brand-600' },
  ASSIGNMENT: { icon: Truck, classes: 'bg-brand-50 text-brand-600' },
  PICKUP: { icon: CalendarClock, classes: 'bg-brand-50 text-brand-600' },
  DELIVERY: { icon: Truck, classes: 'bg-teal-50 text-teal-600' },
  APPROACHING: { icon: MapPin, classes: 'bg-blue-50 text-blue-600' },
  COMPLETED: { icon: CheckCircle2, classes: 'bg-emerald-50 text-emerald-600' },
  RESCUE: { icon: AlertTriangle, classes: 'bg-amber-50 text-amber-600' },
  VERIFICATION: { icon: Sparkles, classes: 'bg-teal-50 text-teal-600' },
}
const notificationStyleDefault = { icon: Info, classes: 'bg-neutral-50 text-neutral-500' }

/**
 * Real notifications feed card — loads from GET /v1/notifications and stays
 * live via Socket.IO pushes (same feed as the shell bell). Shared by the
 * donor, NGO, and volunteer dashboards.
 */
export default function NotificationsCard({ limit = 5 }: { limit?: number }) {
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      const page = await fetchNotifications({ limit })
      setNotifications(page.notifications)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoaded(true)
    }
  }, [limit])

  useEffect(() => {
    load()
  }, [load])

  // Realtime: live-pushed notifications via Socket.IO (same feed as the bell).
  useEffect(() => {
    let active = true
    let live: Socket | null = null
    const onNotification = (notification: NotificationItem) => {
      setNotifications((prev) => [notification, ...prev].slice(0, limit))
    }
    void connectSocket().then((socket) => {
      if (!active) return
      live = socket
      socket?.on('notification', onNotification)
    })
    return () => {
      active = false
      // Remove only this listener — the socket is shared with the bell.
      live?.off('notification', onNotification)
    }
  }, [limit])

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      toast({ variant: 'success', title: 'All caught up', description: 'Notifications marked as read.' })
    } catch {
      toast({ variant: 'error', title: 'Could not update notifications', description: 'Please try again.' })
    }
  }

  const handleMarkRead = async (notification: NotificationItem) => {
    if (notification.isRead) return
    // Optimistic — the next sync reconciles a failed mark.
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)))
    try {
      await markNotificationRead(notification.id)
    } catch {
      // Leave the item as-is on failure — the next sync will reconcile.
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>Notifications</CardTitle>
            <Badge variant="success" dot>
              Live
            </Badge>
          </div>
          <CardDescription>Alerts from your pickups and deliveries</CardDescription>
        </div>
        {notifications.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : failed ? (
          <div className="py-6 text-center">
            <p className="text-sm text-neutral-500">Couldn&apos;t load notifications.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={load}>
              Try again
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Pickup reminders, NGO matches and delivery alerts land here in real time."
            className="py-10"
          />
        ) : (
          <ul className="space-y-1">
            {notifications.map((notification) => {
              const { icon: Icon, classes } = notificationStyle[notification.type] ?? notificationStyleDefault
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleMarkRead(notification)}
                    aria-label={`${notification.title}${notification.isRead ? '' : ' — unread'}`}
                    className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-neutral-50"
                  >
                    <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${classes}`}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={`truncate text-sm font-medium ${notification.isRead ? 'text-neutral-500' : 'text-neutral-900'}`}
                        >
                          {notification.title}
                        </span>
                        {!notification.isRead && <span className="size-1.5 shrink-0 rounded-full bg-brand-500" />}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs leading-relaxed ${notification.isRead ? 'text-neutral-400' : 'text-neutral-500'}`}
                      >
                        {notification.message}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-neutral-400">{timeAgo(notification.createdAt)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
