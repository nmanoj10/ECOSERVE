import { Router } from 'express'

import { createRequest, dashboardStats, listRequests, updateProfile } from '../controllers/ngoController.js'
import { authRequired } from '../middleware/auth.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { createNgoRequestSchema, updateNgoProfileSchema } from '../validators/ngo.js'

export const ngoRoutes = Router()

// Phase 18 — NGO module (Steps 53–55). Every /ngo/* route requires an NGO account.
ngoRoutes.use(authRequired, authorize('NGO'))

ngoRoutes.get('/requests', listRequests)
ngoRoutes.post('/requests', validate(createNgoRequestSchema), createRequest)
ngoRoutes.get('/dashboard', dashboardStats)
ngoRoutes.patch('/profile', validate(updateNgoProfileSchema), updateProfile)
