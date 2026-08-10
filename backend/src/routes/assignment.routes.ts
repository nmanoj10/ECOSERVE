import { Router } from 'express'

import { createAssignment, recommend } from '../controllers/assignmentController.js'
import { authRequired } from '../middleware/auth.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { createAssignmentSchema } from '../validators/assignment.js'

export const assignmentRoutes = Router()

// Phase 21 — Assignment module (Steps 59–60).
// GET /recommend  — ranked volunteers for a claimed donation (NGOs + volunteers)
// POST /          — a volunteer accepts → assignment + delivery created
assignmentRoutes.get('/recommend', authRequired, authorize('NGO', 'VOLUNTEER'), recommend)
assignmentRoutes.post('/', authRequired, authorize('VOLUNTEER'), validate(createAssignmentSchema), createAssignment)
