import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { HttpError } from '../utils/HttpError.js'

/**
 * Lists the authenticated user's notifications, newest first, with unread
 * count (Phase 36, Step 91 — ?page=1&limit=20). The unread count is always
 * global; only the list itself is paginated.
 */
export async function listNotifications(req: Request, res: Response): Promise<void> {
  const page = Math.max(Number(req.query.page) || 1, 1)
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
  const where = { userId: req.user!.userId }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
  ])

  res.json({
    notifications,
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

/** Marks every notification of the authenticated user as read. */
export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId: req.user!.userId, isRead: false },
    data: { isRead: true },
  })

  res.status(204).end()
}

/** Marks a single notification of the authenticated user as read. */
export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id as string, userId: req.user!.userId },
  })
  if (!notification) {
    throw new HttpError(404, 'NOT_FOUND', 'Notification not found')
  }

  await prisma.notification.update({ where: { id: notification.id }, data: { isRead: true } })
  res.status(204).end()
}

/** Deletes a single notification of the authenticated user. */
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id as string, userId: req.user!.userId },
  })
  if (!notification) {
    throw new HttpError(404, 'NOT_FOUND', 'Notification not found')
  }

  await prisma.notification.delete({ where: { id: notification.id } })
  res.status(204).end()
}
