import { Router } from 'express'

import { createDonation, getDonation, listDonations } from '../controllers/donationController.js'
import { nearbyDonations } from '../controllers/ngoController.js'
import { authRequired } from '../middleware/auth.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { createDonationSchema } from '../validators/donation.js'

export const donationRoutes = Router()

// Phase 16 — Donation backend.
// POST  /            create a listing (upload images client-side, persist metadata)
// GET   /            list with pagination + search/status/category/date filters
// GET   /:id         full detail: images, AI prediction, requests, assignment, delivery, timeline
donationRoutes.post('/', authRequired, validate(createDonationSchema), createDonation)
donationRoutes.get('/', authRequired, listDonations)
// Phase 18, Step 54 — NGO-only geolocation search. Registered BEFORE /:id so
// 'nearby' is never treated as a donation id by the catch-all detail route.
donationRoutes.get('/nearby', authRequired, authorize('NGO'), nearbyDonations)
donationRoutes.get('/:id', authRequired, getDonation)
