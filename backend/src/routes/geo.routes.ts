import { Router } from 'express'

import { reverseGeocodeController } from '../controllers/geoController.js'
import { authRequired } from '../middleware/auth.js'

export const geoRoutes = Router()

// Geo helpers (reverse geocoding for profile location auto-fill).
// Available to any authenticated user; the upstream Nominatim service stays
// behind this proxy with a proper User-Agent.
geoRoutes.use(authRequired)

geoRoutes.get('/reverse', reverseGeocodeController)
