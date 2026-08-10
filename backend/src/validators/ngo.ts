import { z } from 'zod'

import { donationStatuses } from './statuses.js'

/**
 * Phase 18, Step 54 — GET /api/v1/donations/nearby query params.
 * Parsed manually in the controller (like listDonations) because req.query
 * arrives as strings and Prisma rejects string coordinates.
 */
export const nearbyDonationsQuerySchema = z.object({
  /** Origin latitude (the NGO's location). */
  lat: z.coerce.number().min(-90).max(90),
  /** Origin longitude (the NGO's location). */
  lng: z.coerce.number().min(-180).max(180),
  /** Search radius in kilometers. */
  distance: z.coerce.number().positive().max(500).default(25),
  status: z.enum(donationStatuses).default('AVAILABLE'),
  /** Minimum AI urgency (1–5) — only show donations at or above this. */
  priority: z.coerce.number().int().min(1).max(5).optional(),
  /** Phase 36, Step 91 — pagination over the urgency-sorted result. */
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

/**
 * Phase 18, Step 55 — POST /api/v1/ngo/requests body.
 * One-step claim: creating the request accepts the donation (see controller).
 */
export const createNgoRequestSchema = z.object({
  donationId: z.string().trim().min(1).max(64),
})

export type CreateNgoRequestBody = z.infer<typeof createNgoRequestSchema>
