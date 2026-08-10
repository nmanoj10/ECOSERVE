import { z } from 'zod'

/** Phase 21, Step 60 — POST /api/v1/assignments. */
export const createAssignmentSchema = z.object({
  donationId: z.string().trim().min(1).max(64),
})

export type CreateAssignmentBody = z.infer<typeof createAssignmentSchema>

/** Phase 21, Step 59 — GET /api/v1/assignments/recommend. */
export const recommendQuerySchema = z.object({
  donationId: z.string().trim().min(1).max(64),
  limit: z.coerce.number().int().positive().max(20).default(5),
})

export type RecommendQuery = z.infer<typeof recommendQuerySchema>
