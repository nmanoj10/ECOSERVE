import { Router } from 'express'

import { healthController } from '../controllers/healthController.js'
import { apiLimiter } from '../middleware/rateLimiter.js'
import { adminRoutes } from './admin.routes.js'
import { authRoutes } from './auth.routes.js'
import { donationRoutes } from './donation.routes.js'
import { uploadRoutes } from './upload.routes.js'

export const rootRouter = Router()

// Liveness / readiness probe
rootRouter.get('/health', healthController)

// Versioned API
const apiRouter = Router()
apiRouter.use(apiLimiter)

apiRouter.use('/auth', authRoutes)
apiRouter.use('/admin', adminRoutes)
apiRouter.use('/donations', donationRoutes)
apiRouter.use('/uploads', uploadRoutes)
// apiRouter.use('/impact', impactRoutes)         // future phases

rootRouter.use('/api/v1', apiRouter)
