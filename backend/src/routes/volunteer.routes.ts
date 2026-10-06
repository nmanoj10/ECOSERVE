import { Router } from 'express'

import { dashboardStats, rescueClaim, rescueSpots, updateAvailability, updateProfile } from '../controllers/volunteerController.js'
import { authRequired } from '../middleware/auth.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { updateAvailabilitySchema, updateVolunteerProfileSchema } from '../validators/volunteer.js'

export const volunteerRoutes = Router()

// Phase 20 — Volunteer module (Steps 57–58). Every /volunteer/* route requires a volunteer account.
volunteerRoutes.use(authRequired, authorize('VOLUNTEER'))

volunteerRoutes.get('/dashboard', dashboardStats)
// Phase 45 — donor pickup location + nearby railway stations / bus stands / homeless spots.
volunteerRoutes.get('/rescue-spots', rescueSpots)
// Phase 46 — accept a rescue alert: creates the assignment + delivery run so the
// volunteer can pick the food up and hand it out at a distribution spot.
volunteerRoutes.post('/rescue-claim', rescueClaim)
volunteerRoutes.patch('/availability', validate(updateAvailabilitySchema), updateAvailability)
volunteerRoutes.patch('/profile', validate(updateVolunteerProfileSchema), updateProfile)
