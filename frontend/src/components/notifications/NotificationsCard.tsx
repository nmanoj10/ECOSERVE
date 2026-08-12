import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, Info, Loader2, MapPin, Megaphone, Sparkles, Truck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Socket } from 'socket.io-client'

import { acceptDelivery } from '@/api/volunteer'
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
  NEEDED: { icon: Megaphone, classes: 'bg-rose-50 text-rose-600' },
}
const notificationStyleDefault = { icon: Info, classes: 'bg-neutral-50 text-neutral-500' }

/**
 * Real notifications feed card — loads from GET /v1/notifications and stays
 * live via Socket.IO pushes (same feed as the shell bell). Shared by the
 * donor, NGO, and volunteer dashboards.
 *
 * Phase 45 — pass `role="VOLUNTEER"` to unlock the "Accept rescue" action on
 * rescue alerts, which opens the donor location + handout-spots map.
 */
export default function NotificationsCard({ limit = 5, role }: { limit?: number; role?: string }) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  /** Notification currently being accepted (POST /assignments in flight). */
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

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

  /**
   * Phase 45 — a volunteer accepts a rescue alert: opens the rescue map for
   * that donation (donor location + nearby handout spots) and marks it read.
   */
  const handleAcceptRescue = async (notification: NotificationItem) => {
    if (!notification.donationId) return
    navigate(`/volunteer?rescue=${encodeURIComponent(notification.donationId)}`)
    if (!notification.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)))
      try {
        await markNotificationRead(notification.id)
      } catch {
        // Non-fatal — the notification is still marked read on the next sync.
      }
    }
  }

  /**
   * Phase 45 — a volunteer accepts a "Volunteers needed" alert: creates the
   * assignment + delivery (POST /assignments), then opens the dashboard which
   * shows the full route map (you → donor → NGO) and live tracking.
   */
  const handleAcceptDelivery = async (notification: NotificationItem) => {
    if (!notification.donationId || acceptingId) return
    setAcceptingId(notification.id)
    try {
      await acceptDelivery(notification.donationId)
      toast({
        variant: 'success',
        title: 'Delivery accepted',
        description: 'The route to the donor and NGO is on your dashboard. Start the pickup and they\u2019ll see your location live.',
      })
      if (!notification.isRead) {
        setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)))
        try {
          await markNotificationRead(notification.id)
        } catch {
          // Non-fatal.
        }
      }
      navigate('/volunteer')
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not accept delivery',
        description:
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Something went wrong — try again',
      })
    } finally {
      setAcceptingId(null)
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
              // Phase 45 — volunteers can accept a rescue alert to open the
              // donor location + nearby handout spots map for that donation.
              const showRescueAction = role === 'VOLUNTEER' && notification.type === 'RESCUE' && Boolean(notification.donationId)
              // Phase 45 — or accept a "Volunteers needed" alert to create the
              // delivery run and see the full you → donor → NGO route map.
              const showDeliveryAction = role === 'VOLUNTEER' && notification.type === 'NEEDED' && Boolean(notification.donationId)
              return (
                <li key={notification.id} className="rounded-xl p-2 transition hover:bg-neutral-50">
                  <button
                    type="button"
                    onClick={() => handleMarkRead(notification)}
                    aria-label={`${notification.title}${notification.isRead ? '' : ' — unread'}`}
                    className="flex w-full items-start gap-3 text-left"
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
                  {showRescueAction && (
                    <span className="mt-1 flex justify-end pr-0.5">
                      <button
                        type="button"
                        onClick={() => void handleAcceptRescue(notification)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600 active:scale-[0.98]"
                      >
                        <MapPin className="size-3.5" />
                        Accept rescue · view map
                      </button>
                    </span>
                  )}
                  {showDeliveryAction && (
                    <span className="mt-1 flex justify-end pr-0.5">
                      <button
                        type="button"
                        disabled={acceptingId !== null}
                        onClick={() => void handleAcceptDelivery(notification)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {acceptingId === notification.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Truck className="size-3.5" />
                        )}
                        {acceptingId === notification.id ? 'Accepting…' : 'Accept delivery · view route'}
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
