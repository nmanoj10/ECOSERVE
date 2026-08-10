import { Router } from 'express'

import {
  adminAnalytics,
  donorAnalytics,
  ngoAnalytics,
  volunteerAnalytics,
} from '../controllers/analyticsController.js'
import { authRequired } from '../middleware/auth.js'
import { authorize } from '../middleware/authorize.js'

export const analyticsRoutes = Router()

// Phase 30 — Analytics module (Steps 77–80).
// GET /donor     — donor impact: donations by month, categories, food saved, people, CO₂.
// GET /ngo       — NGO impact: food received/distributed, people served, delivery success, growth.
// GET /volunteer — volunteer impact: deliveries, distance, meals, rating, completion rate.
// GET /admin     — platform overview: users, donations, food saved, growth, heatmap, top NGOs.
analyticsRoutes.get('/donor', authRequired, authorize('DONOR'), donorAnalytics)
analyticsRoutes.get('/ngo', authRequired, authorize('NGO'), ngoAnalytics)
analyticsRoutes.get('/volunteer', authRequired, authorize('VOLUNTEER'), volunteerAnalytics)
analyticsRoutes.get('/admin', authRequired, authorize('ADMIN'), adminAnalytics)
