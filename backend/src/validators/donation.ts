import { z } from 'zod'

import { env } from '../config/env.js'
import { donationStatuses } from './statuses.js'

// Phase 35, Step 89 — server-side file validation. Uploads go straight to
// ImageKit from the browser, but the metadata the backend records is still
// constrained: only raster web formats, a hard 5 MB ceiling that mirrors the
// client-side cap (frontend/src/services/imagekit.ts), and URLs that actually
// belong to the configured ImageKit endpoint (some browsers report `image/jpg`
// for .jpg files, so it's accepted alongside `image/jpeg`).
const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024 // 5 MB per photo
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const

export const donationImageSchema = z.object({
  /**
   * Public ImageKit URL (the client uploads directly; the backend stores the
   * metadata). Must be hosted on the configured ImageKit endpoint — this stops
   * the backend from ever recording metadata for arbitrary external URLs. The
   * check is skipped while ImageKit is unconfigured (demo mode sends none).
   */
  url: z
    .string()
    .url('Invalid image URL')
    .refine((url) => !env.IMAGEKIT_URL_ENDPOINT || url.startsWith(env.IMAGEKIT_URL_ENDPOINT), {
      message: 'Image URL must be hosted on the configured ImageKit endpoint',
    }),
  /** ImageKit file id — lets us delete/transform the asset later. */
  fileId: z.string().trim().max(100).optional(),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_IMAGE_FILE_SIZE, 'Image exceeds the 5 MB limit').optional(),
  mimeType: z.enum(ACCEPTED_IMAGE_TYPES).optional(),
})

export const createDonationSchema = z
  .object({
    foodName: z.string().trim().min(1).max(150),
    /** Food category name — resolved (and created on first use) by the controller. */
    category: z.string().trim().min(1).max(100),
    quantity: z.number().positive('Quantity must be greater than 0'),
    unit: z.string().trim().min(1).max(20),
    preparedAt: z.string().datetime({ offset: true }).optional(),
    expiryTime: z.string().datetime({ offset: true }).optional(),
    pickupTime: z.string().datetime({ offset: true }).optional(),
    pickupAddress: z.string().trim().min(1).max(250),
    description: z.string().trim().max(1000).optional(),
    /** Optional geo pin for the listing — powers the nearby-search (Step 54) + map. */
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    images: z.array(donationImageSchema).max(3).default([]),
  })
  .refine((data) => !data.expiryTime || !data.pickupTime || data.expiryTime > data.pickupTime, {
    message: 'Pickup must happen before the food expires',
    path: ['pickupTime'],
  })
  .refine((data) => !data.preparedAt || !data.expiryTime || data.expiryTime > data.preparedAt, {
    message: 'Expiry must be after the prepared time',
    path: ['expiryTime'],
  })

export type CreateDonationBody = z.infer<typeof createDonationSchema>

export const listDonationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  /** Case-insensitive match on food name, description, or donor organization. */
  search: z.string().trim().max(100).optional(),
  status: z.enum(donationStatuses).optional(),
  /** Food category name (case-insensitive). */
  category: z.string().trim().max(100).optional(),
  /** Phase 36, Step 92 — minimum AI urgency (1–5); keeps listings at or above it. */
  priority: z.coerce.number().int().min(1).max(5).optional(),
  /** ISO datetime range on the listing's createdAt. */
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
})

export type ListDonationsQuery = z.infer<typeof listDonationsQuerySchema>
