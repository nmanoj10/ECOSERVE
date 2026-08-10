import { Router } from 'express'

import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notificationController.js'
import { authRequired } from '../middleware/auth.js'

export const notificationsRoutes = Router()

// Any signed-in user can read their own notifications.
notificationsRoutes.use(authRequired)

// Phase 29, Step 76 — notification API.
notificationsRoutes.get('/', listNotifications)
notificationsRoutes.patch('/read-all', markAllNotificationsRead)
notificationsRoutes.patch('/:id/read', markNotificationRead)
notificationsRoutes.delete('/:id', deleteNotification)
