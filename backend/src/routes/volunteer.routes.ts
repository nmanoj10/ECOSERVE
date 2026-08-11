import { Router } from 'express'

import { dashboardStats, updateAvailability, updateProfile } from '../controllers/volunteerController.js'
import { authRequired } from '../middleware/auth.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { updateAvailabilitySchema, updateVolunteerProfileSchema } from '../validators/volunteer.js'

export const volunteerRoutes = Router()

// Phase 20 — Volunteer module (Steps 57–58). Every /volunteer/* route requires a volunteer account.
volunteerRoutes.use(authRequired, authorize('VOLUNTEER'))

volunteerRoutes.get('/dashboard', dashboardStats)
volunteerRoutes.patch('/availability', validate(updateAvailabilitySchema), updateAvailability)
volunteerRoutes.patch('/profile', validate(updateVolunteerProfileSchema), updateProfile)
