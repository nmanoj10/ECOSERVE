import { Router } from 'express'

import { getPreferences, updatePreferences } from '../controllers/userController.js'
import { authRequired } from '../middleware/auth.js'

export const userRoutes = Router()

// Phase 46 — notification preferences (rescue-alert opt-out). Any signed-in user.
userRoutes.use(authRequired)
userRoutes.get('/preferences', getPreferences)
userRoutes.patch('/preferences', updatePreferences)