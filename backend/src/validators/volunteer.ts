import { z } from 'zod'

/** Phase 20, Step 58 — PATCH /api/v1/volunteer/availability. */
export const updateAvailabilitySchema = z.object({
  availability: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']),
})

export type UpdateAvailabilityBody = z.infer<typeof updateAvailabilitySchema>
