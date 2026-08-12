import { api } from './client'

export interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
  /** Phase 45 — the donation this alert is about (rescue alerts link to it). */
  donationId?: string | null
}

export interface NotificationsPage {
  notifications: NotificationItem[]
  /** Always global — not affected by pagination. */
  unreadCount: number
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/** Phase 36, Step 91 — page through the notification list (?page=1&limit=20). */
export async function fetchNotifications(params?: { limit?: number; page?: number }): Promise<NotificationsPage> {
  const { data } = await api.get<NotificationsPage>('/v1/notifications', {
    params: { page: params?.page ?? 1, limit: params?.limit ?? 20 },
  })
  return data
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/v1/notifications/read-all')
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/v1/notifications/${id}/read`)
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/v1/notifications/${id}`)
}
