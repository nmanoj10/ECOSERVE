import { Router } from 'express'

import { listPublicDonors } from '../controllers/donorController.js'

/**
 * Public routes — no authentication required.
 * Used for homepage showcase, landing pages, etc.
 */
export const publicRoutes = Router()

// GET /api/v1/public/donors — donors with logos for the showcase marquee
publicRoutes.get('/donors', listPublicDonors)