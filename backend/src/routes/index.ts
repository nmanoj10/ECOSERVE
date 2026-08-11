import { Router } from 'express'

import { healthController } from '../controllers/healthController.js'
import { apiLimiter } from '../middleware/rateLimiter.js'
import { adminRoutes } from './admin.routes.js'
import { analyticsRoutes } from './analytics.routes.js'
import { assignmentRoutes } from './assignment.routes.js'
import { authRoutes } from './auth.routes.js'
import { deliveryRoutes } from './delivery.routes.js'
import { donationRoutes } from './donation.routes.js'
import { geoRoutes } from './geo.routes.js'
import { donorRoutes } from './donor.routes.js'
import { ngoRoutes } from './ngo.routes.js'
import { notificationsRoutes } from './notifications.routes.js'
import { uploadRoutes } from './upload.routes.js'
import { volunteerRoutes } from './volunteer.routes.js'

export const rootRouter = Router()

// Liveness / readiness probe
rootRouter.get('/health', healthController)

// Versioned API
const apiRouter = Router()
apiRouter.use(apiLimiter)

apiRouter.use('/assignments', assignmentRoutes)
apiRouter.use('/auth', authRoutes)
apiRouter.use('/admin', adminRoutes)
apiRouter.use('/analytics', analyticsRoutes)
apiRouter.use('/deliveries', deliveryRoutes)
apiRouter.use('/donations', donationRoutes)
apiRouter.use('/donor', donorRoutes)
apiRouter.use('/geo', geoRoutes)
apiRouter.use('/ngo', ngoRoutes)
apiRouter.use('/notifications', notificationsRoutes)
apiRouter.use('/uploads', uploadRoutes)
apiRouter.use('/volunteer', volunteerRoutes)
// apiRouter.use('/impact', impactRoutes)         // future phases

rootRouter.use('/api/v1', apiRouter)
