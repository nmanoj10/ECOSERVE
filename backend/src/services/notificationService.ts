import { prisma } from '../config/prisma.js'
import type { Prisma } from '../generated/prisma/client.js'
import { emitToUser } from './realtime.js'

/**
 * Phase 29, Step 75 — in-app notification system.
 *
 * Every event is persisted as a `Notification` row and pushed live over
 * Socket.IO (the `user:{id}` room), so the dashboard bell updates without a
 * page reload. There is deliberately no email path — this is in-app only.
 *
 * The seven events of the notification system map to these stable type codes:
 *   Donation accepted      → REQUEST
 *   Volunteer assigned     → ASSIGNMENT
 *   Pickup started         → PICKUP
 *   Delivery started       → DELIVERY
 *   Volunteer approaching  → APPROACHING
 *   Delivery completed     → COMPLETED
 *   Food expiring          → RESCUE
 *   NGO verified/rejected  → VERIFICATION (Phase 32, Step 83)
 */
export const NOTIFICATION_TYPES = {
  DONATION_ACCEPTED: 'REQUEST',
  VOLUNTEER_ASSIGNED: 'ASSIGNMENT',
  PICKUP_STARTED: 'PICKUP',
  DELIVERY_STARTED: 'DELIVERY',
  VOLUNTEER_APPROACHING: 'APPROACHING',
  DELIVERY_COMPLETED: 'COMPLETED',
  FOOD_EXPIRING: 'RESCUE',
  NGO_VERIFIED: 'VERIFICATION',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

export interface NotifyOptions {
  title: string
  message: string
  /** One of NOTIFICATION_TYPES — the event the notification represents. */
  type: NotificationType
  /** Optional entity the notification is about (surfaced in the live payload). */
  donationId?: string
}

/**
 * Creates an in-app notification for every recipient and live-pushes it.
 *
 * - Recipient ids are deduplicated and empty ids dropped.
 * - Rows are created with the given client so callers that need atomicity with
 *   their own writes (e.g. the rescue sweep) can pass their transaction client.
 * - Each row keeps its real id so the realtime payload matches exactly what
 *   GET /notifications returns.
 * - No-op when there is nothing to notify.
 *
 * Returns the number of notification rows created.
 */
export async function notifyUsers(
  recipientIds: string[],
  options: NotifyOptions,
  client: Prisma.TransactionClient = prisma,
): Promise<number> {
  const ids = [...new Set(recipientIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return 0

  const createdAt = new Date()

  const rows = await Promise.all(
    ids.map((userId) =>
      client.notification.create({
        data: { userId, title: options.title, message: options.message, type: options.type },
      }),
    ),
  )

  for (const row of rows) {
    emitToUser(row.userId, 'notification', {
      id: row.id,
      ...(options.donationId ? { donationId: options.donationId } : {}),
      title: options.title,
      message: options.message,
      type: row.type,
      isRead: false,
      createdAt: createdAt.toISOString(),
    })
  }

  return rows.length
}
