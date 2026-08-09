import { Router } from 'express'

import { overview } from '../controllers/adminController.js'
import { authorize } from '../middleware/authorize.js'
import { authRequired } from '../middleware/auth.js'

export const adminRoutes = Router()

// Every /admin/* route requires ADMIN (Phase 10, Step 35).
adminRoutes.use(authRequired, authorize('ADMIN'))

adminRoutes.get('/overview', overview)
