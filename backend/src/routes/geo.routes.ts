import { Router } from 'express'

import { reverseGeocodeController } from '../controllers/geoController.js'

export const geoRoutes = Router()

// Geo helpers (reverse geocoding for profile / registration location auto-fill).
//
// Public (no session required) on purpose: the register page resolves the
// user's current location to city/state/address BEFORE an account exists, so
// this endpoint cannot sit behind authRequired. It stays protected by the
// global apiLimiter and only ever proxies a read-only Nominatim lookup with a
// proper User-Agent (see services/geocodeService.ts).
geoRoutes.get('/reverse', reverseGeocodeController)
