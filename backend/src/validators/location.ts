import { z } from 'zod'

/** GPS location data submitted by the volunteer during an active delivery. */
export const submitLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
})

export type SubmitLocationBody = z.infer<typeof submitLocationSchema>