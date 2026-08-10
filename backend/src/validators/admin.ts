import { z } from 'zod'

import { deliveryStatuses, donationStatuses } from './statuses.js'

/** Shared pagination defaults for admin list endpoints. */
const pagination = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
}

/**
 * Phase 32, Step 82 — GET /api/v1/admin/users query params.
 * Search is loose (name / email / phone); role and status narrow the result.
 */
export const listUsersQuerySchema = z.object({
  ...pagination,
  search: z.string().trim().max(100).optional(),
  role: z.enum(['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN']).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
})

/**
 * Phase 32, Step 82 — PATCH /api/v1/admin/users/:id/status body.
 * Deactivation is SUSPENDED; activation returns the account to ACTIVE.
 */
export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
})

export type UpdateUserStatusBody = z.infer<typeof updateUserStatusSchema>

/**
 * Phase 32, Step 82 — PATCH /api/v1/admin/users/:id/role body.
 * ADMIN is deliberately not assignable here — platform admins are managed
 * outside the self-service role flow.
 */
export const updateUserRoleSchema = z.object({
  role: z.enum(['DONOR', 'NGO', 'VOLUNTEER']),
})

export type UpdateUserRoleBody = z.infer<typeof updateUserRoleSchema>

/**
 * Phase 32, Step 83 — GET /api/v1/admin/ngos query params.
 * `verification` filters by VerificationStatus (PENDING | VERIFIED | REJECTED).
 */
export const listNgosQuerySchema = z.object({
  ...pagination,
  search: z.string().trim().max(100).optional(),
  verification: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
})

/** Phase 32, Step 83 — POST /api/v1/admin/ngos/:id/reject body (optional reason). */
export const rejectNgoSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

/**
 * Phase 32, Step 84 — GET /api/v1/admin/donations query params.
 * Status mirrors the DonationStatus enum; search hits food, description, donor.
 * `priority` (Phase 36, Step 92) is a minimum AI urgency 1–5.
 */
export const listAdminDonationsQuerySchema = z.object({
  ...pagination,
  search: z.string().trim().max(100).optional(),
  status: z.enum(donationStatuses).optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
})

/**
 * Phase 32, Step 85 — GET /api/v1/admin/deliveries query params.
 * `active=true` narrows to in-progress runs (assigned → in transit); `status`
 * picks a single DeliveryStatus; search hits volunteer, food, and donor org.
 */
export const listAdminDeliveriesQuerySchema = z.object({
  ...pagination,
  search: z.string().trim().max(100).optional(),
  status: z.enum(deliveryStatuses).optional(),
  active: z.enum(['true', 'false']).optional(),
})

/**
 * Phase 33, Step 86 — GET /api/v1/admin/reports query params.
 * `range` picks a preset window; `from`/`to` (ISO datetime or YYYY-MM-DD) are
 * required for `custom`. Weekly = last 7 days, Monthly = last 30, Yearly = 365.
 */
export const reportsQuerySchema = z.object({
  range: z.enum(['weekly', 'monthly', 'yearly', 'custom']).default('monthly'),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
})
