import { z } from 'zod'

/**
 * GET /api/v1/geo/reverse query params.
 * Parsed manually (like nearbyDonationsQuerySchema) because req.query arrives
 * as strings.
 */
export const reverseGeocodeQuerySchema = z.object({
  /** Latitude of the point to resolve. */
  lat: z.coerce.number().min(-90).max(90),
  /** Longitude of the point to resolve. */
  lng: z.coerce.number().min(-180).max(180),
})

export type ReverseGeocodeQuery = z.infer<typeof reverseGeocodeQuerySchema>
