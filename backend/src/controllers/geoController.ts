import type { Request, Response } from 'express'

import { reverseGeocode } from '../services/geocodeService.js'
import { HttpError } from '../utils/HttpError.js'
import { reverseGeocodeQuerySchema } from '../validators/geo.js'

/**
 * GET /api/v1/geo/reverse?lat=&lng= — resolves a coordinate to a
 * city/state/address so profile forms can auto-fill their location fields
 * (Nominatim proxy, see geocodeService).
 */
export async function reverseGeocodeController(req: Request, res: Response): Promise<void> {
  const parsed = reverseGeocodeQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten().fieldErrors))
  }
  const { lat, lng } = parsed.data

  let place: Awaited<ReturnType<typeof reverseGeocode>>
  try {
    place = await reverseGeocode(lat, lng)
  } catch (err) {
    console.error('[geo] reverse-geocode failed:', err)
    throw new HttpError(502, 'UPSTREAM_ERROR', 'Could not detect a place for those coordinates — try again')
  }

  res.json({ place })
}
