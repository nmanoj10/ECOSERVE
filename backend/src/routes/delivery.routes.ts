import { Router } from 'express'

import {
  completeDelivery,
  listActiveDeliveries,
  startDelivery,
  submitLocation,
} from '../controllers/deliveryController.js'
import { authRequired } from '../middleware/auth.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { submitLocationSchema } from '../validators/location.js'

export const deliveryRoutes = Router()

// Phase 28 — Active deliveries for live tracking (must be before /:id routes).
deliveryRoutes.get('/tracking', authRequired, listActiveDeliveries)

// Phase 22 — Delivery module (Steps 61–62).
// POST /:id/start — volunteer picks up the food and begins transit.
deliveryRoutes.post('/:id/start', authRequired, authorize('VOLUNTEER'), startDelivery)

// Phase 25, Step 66 — GPS tracking while in transit.
// POST /:id/location — volunteer submits a GPS sample.
deliveryRoutes.post('/:id/location', authRequired, authorize('VOLUNTEER'), validate(submitLocationSchema), submitLocation)

// Phase 29, Step 75 — volunteer confirms the delivery reached the NGO.
// POST /:id/complete — delivery → DELIVERED, volunteer freed up.
deliveryRoutes.post('/:id/complete', authRequired, authorize('VOLUNTEER'), completeDelivery)