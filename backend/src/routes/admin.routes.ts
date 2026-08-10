import { Router } from 'express'

import {
  adminReports,
  getNgo,
  getUser,
  listAdminDeliveries,
  listAdminDonations,
  listNgos,
  listUsers,
  overview,
  rejectNgo,
  runRescue,
  updateUserRole,
  updateUserStatus,
  verifyNgo,
} from '../controllers/adminController.js'
import { authorize } from '../middleware/authorize.js'
import { authRequired } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { rejectNgoSchema, updateUserRoleSchema, updateUserStatusSchema } from '../validators/admin.js'

export const adminRoutes = Router()

// Every /admin/* route requires ADMIN (Phase 10, Step 35).
adminRoutes.use(authRequired, authorize('ADMIN'))

adminRoutes.get('/overview', overview)
adminRoutes.post('/rescue/run', runRescue)

// Phase 32, Step 82 — User management
adminRoutes.get('/users', listUsers)
adminRoutes.get('/users/:id', getUser)
adminRoutes.patch('/users/:id/status', validate(updateUserStatusSchema), updateUserStatus)
adminRoutes.patch('/users/:id/role', validate(updateUserRoleSchema), updateUserRole)

// Phase 32, Step 83 — NGO verification
adminRoutes.get('/ngos', listNgos)
adminRoutes.get('/ngos/:id', getNgo)
adminRoutes.post('/ngos/:id/verify', verifyNgo)
adminRoutes.post('/ngos/:id/reject', validate(rejectNgoSchema), rejectNgo)

// Phase 32, Step 84 — Donation monitoring
adminRoutes.get('/donations', listAdminDonations)

// Phase 32, Step 85 — Delivery monitoring
adminRoutes.get('/deliveries', listAdminDeliveries)

// Phase 33, Step 86 — Reports
adminRoutes.get('/reports', adminReports)
