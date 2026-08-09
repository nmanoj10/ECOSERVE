import { z } from 'zod'

const donationImageSchema = z.object({
  /** Public ImageKit URL (the client uploads directly; the backend stores the metadata). */
  url: z.string().url('Invalid image URL'),
  /** ImageKit file id — lets us delete/transform the asset later. */
  fileId: z.string().trim().max(100).optional(),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().trim().max(100).optional(),
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

const donationStatuses = ['AVAILABLE', 'RESERVED', 'PICKED_UP', 'DELIVERED', 'EXPIRED', 'CANCELLED'] as const

export const listDonationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  /** Case-insensitive match on food name, description, or donor organization. */
  search: z.string().trim().max(100).optional(),
  status: z.enum(donationStatuses).optional(),
  /** Food category name (case-insensitive). */
  category: z.string().trim().max(100).optional(),
  /** ISO datetime range on the listing's createdAt. */
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
})

export type ListDonationsQuery = z.infer<typeof listDonationsQuerySchema>
