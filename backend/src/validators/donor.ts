import { z } from 'zod'

/**
 * PATCH /api/v1/donor/profile — partial update of the donor's own profile.
 * Every field is optional so the client can send just the location pin.
 * `null` clears a field (e.g. removing the coordinates).
 */
export const updateDonorProfileSchema = z
  .object({
    organizationName: z.string().trim().min(1).max(150).optional(),
    organizationType: z.string().trim().min(1).max(100).optional(),
    address: z.string().trim().min(1).max(250).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    state: z.string().trim().min(1).max(100).optional(),
    /** Location pin — falls back to the donation's own pin in the nearby search. */
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((data) => (data.latitude == null) === (data.longitude == null), {
    // A half-set pin would silently blank the nearby-donations search, so the
    // pair must always be saved (or cleared) together.
    message: 'Set both latitude and longitude together, or neither',
    path: ['longitude'],
  })

export type UpdateDonorProfileBody = z.infer<typeof updateDonorProfileSchema>
