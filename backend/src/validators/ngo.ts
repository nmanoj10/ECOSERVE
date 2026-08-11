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

/**
 * PATCH /api/v1/ngo/profile — partial update of the NGO's own profile.
 * Every field is optional so the client can send just the location pin.
 * `null` clears a field (e.g. removing the coordinates).
 */
export const updateNgoProfileSchema = z
  .object({
    ngoName: z.string().trim().min(1).max(150).optional(),
    registrationNumber: z.string().trim().min(1).max(100).optional(),
    address: z.string().trim().min(1).max(250).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    state: z.string().trim().min(1).max(100).optional(),
    /** Location pin — powers the nearby-donations search + surplus map. */
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    capacity: z.number().int().positive().nullable().optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((data) => (data.latitude == null) === (data.longitude == null), {
    // A half-set pin would silently blank the nearby-donations search, so the
    // pair must always be saved (or cleared) together.
    message: 'Set both latitude and longitude together, or neither',
    path: ['longitude'],
  })

export type UpdateNgoProfileBody = z.infer<typeof updateNgoProfileSchema>
