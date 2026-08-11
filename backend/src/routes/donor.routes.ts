import { Router } from 'express'

import { updateProfile } from '../controllers/donorController.js'
import { authRequired } from '../middleware/auth.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { updateDonorProfileSchema } from '../validators/donor.js'

export const donorRoutes = Router()

// Donor module. Every /donor/* route requires a donor account.
donorRoutes.use(authRequired, authorize('DONOR'))

donorRoutes.patch('/profile', validate(updateDonorProfileSchema), updateProfile)
