import { z } from 'zod'

/** Phase 20, Step 58 — PATCH /api/v1/volunteer/availability. */
export const updateAvailabilitySchema = z.object({
  availability: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']),
})

export type UpdateAvailabilityBody = z.infer<typeof updateAvailabilitySchema>

/**
 * PATCH /api/v1/volunteer/profile — partial update of the volunteer's own
 * profile. Every field is optional so the client can send just the location
 * pin. `null` clears a field (e.g. removing the current location).
 */
export const updateVolunteerProfileSchema = z
  .object({
    vehicleType: z.string().trim().max(50).nullable().optional(),
    vehicleNumber: z.string().trim().max(20).nullable().optional(),
    availability: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']).optional(),
    /** Live location — used to match rescue alerts and as the delivery drop-off. */
    currentLatitude: z.number().min(-90).max(90).nullable().optional(),
    currentLongitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((data) => (data.currentLatitude == null) === (data.currentLongitude == null), {
    // A half-set pin would silently break location matching, so the pair must
    // always be saved (or cleared) together.
    message: 'Set both latitude and longitude together, or neither',
    path: ['currentLongitude'],
  })

export type UpdateVolunteerProfileBody = z.infer<typeof updateVolunteerProfileSchema>
