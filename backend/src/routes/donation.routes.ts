import { Router } from 'express'

import { createDonation, getDonation, listDonations } from '../controllers/donationController.js'
import { authRequired } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createDonationSchema } from '../validators/donation.js'

export const donationRoutes = Router()

// Phase 16 — Donation backend.
// POST  /            create a listing (upload images client-side, persist metadata)
// GET   /            list with pagination + search/status/category/date filters
// GET   /:id         full detail: images, AI prediction, requests, assignment, delivery, timeline
donationRoutes.post('/', authRequired, validate(createDonationSchema), createDonation)
donationRoutes.get('/', authRequired, listDonations)
donationRoutes.get('/:id', authRequired, getDonation)
