import type { Request, Response } from 'express'
import type { Prisma } from '../generated/prisma/client.js'

import { prisma } from '../config/prisma.js'
import { runRescueNow } from '../jobs/rescueJob.js'
import { notifyUsers, NOTIFICATION_TYPES } from '../services/notificationService.js'
import { estimateCo2, foodKg } from '../utils/impact.js'
import { HttpError } from '../utils/HttpError.js'
import { estimateMeals } from '../utils/meals.js'
import type { DeliveryStatus } from '../validators/statuses.js'
import {
  listAdminDeliveriesQuerySchema,
  listAdminDonationsQuerySchema,
  listNgosQuerySchema,
  listUsersQuerySchema,
  reportsQuerySchema,
  type UpdateUserRoleBody,
  type UpdateUserStatusBody,
} from '../validators/admin.js'

/** Platform-wide overview for admins. Guarded by authorize('ADMIN'). */
export async function overview(_req: Request, res: Response): Promise<void> {
  const [usersByRole, donationsByStatus, volunteersAvailable, verifiedNgos, activeSessions] =
    await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.donation.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.volunteer.count({ where: { availability: 'AVAILABLE' } }),
      prisma.ngo.count({ where: { verificationStatus: 'VERIFIED' } }),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    ])

  res.json({
    users: Object.fromEntries(usersByRole.map((row) => [row.role, row._count._all])),
    donations: Object.fromEntries(donationsByStatus.map((row) => [row.status, row._count._all])),
    volunteersAvailable,
    verifiedNgos,
    activeSessions,
  })
}

/** Manually runs one rescue sweep (Phase 19) — useful for testing without waiting for the timer. */
export async function runRescue(_req: Request, res: Response): Promise<void> {
  const summary = await runRescueNow()
  res.json(summary)
}

// ── Phase 32, Step 82 — User management ─────────────────────────────────────

/**
 * Lists users with pagination + filters (Step 82). Supports free-text search
 * (name / email / phone), role, and account-status filters. Each row carries a
 * light role-profile summary for the table view.
 */
export async function listUsers(req: Request, res: Response): Promise<void> {
  const parsed = listUsersQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten().fieldErrors))
  }
  const { page, limit, search, role, status } = parsed.data

  const where: Prisma.UserWhereInput = {}
  if (role) where.role = role
  if (status) where.status = status
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        donor: { select: { organizationName: true } },
        ngo: { select: { ngoName: true, verificationStatus: true } },
        volunteer: { select: { availability: true, totalDeliveries: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  res.json({ users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

/**
 * Returns one user with full role profiles and platform stats (Step 82).
 * The stats let an admin see at a glance how active the account is.
 */
export async function getUser(req: Request, res: Response): Promise<void> {
  const id = req.params.id
  if (typeof id !== 'string' || !id) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid user id')
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: { donor: true, ngo: true, volunteer: true },
  })
  if (!user) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found')
  }

  const [donations, requests, deliveries, sessions] = await Promise.all([
    prisma.donation.count({ where: { donor: { userId: id } } }),
    prisma.ngoRequest.count({ where: { ngo: { userId: id } } }),
    prisma.delivery.count({ where: { assignment: { volunteer: { userId: id } } } }),
    prisma.session.count({ where: { userId: id } }),
  ])

  res.json({
    user,
    stats: { donations, requests, deliveries, sessions },
  })
}

/**
 * Activates or deactivates a user (Step 82). Deactivation sets SUSPENDED and
 * revokes every recorded session so the account is locked out immediately
 * (the auth middleware rejects SUSPENDED users on the very next call).
 * Admins cannot deactivate themselves or another ADMIN account.
 */
export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  const adminId = req.user!.userId
  const id = req.params.id
  if (typeof id !== 'string' || !id) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid user id')
  }
  const { status } = req.body as UpdateUserStatusBody

  if (id === adminId) {
    throw new HttpError(409, 'SELF_ACTION', "You can't change your own account status")
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found')
  }
  if (target.role === 'ADMIN') {
    throw new HttpError(409, 'PROTECTED_ACCOUNT', 'Admin accounts cannot be modified')
  }
  if (target.status === status) {
    throw new HttpError(409, 'NO_CHANGE', `User is already ${status.toLowerCase()}`)
  }

  const user = await prisma.$transaction(async (tx) => {
    if (status === 'SUSPENDED') {
      // Kill every session so the user is signed out across all devices.
      await tx.session.deleteMany({ where: { userId: id } })
    }
    const updated = await tx.user.update({
      where: { id },
      data: { status },
    })
    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: `user.status.${status.toLowerCase()}`,
        entity: 'user',
        entityId: id,
      },
    })
    return updated
  })

  res.json({ user })
}

/**
 * Changes a user's role (Step 82 — roles managed where appropriate). Only the
 * three participant roles are assignable; ADMIN accounts and the acting admin
 * are protected. The target role's profile is created with placeholder data
 * when it doesn't exist yet (registration data isn't editable via the API), and
 * the previous profile row is kept so historical donations/reviews stay intact.
 */
export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const adminId = req.user!.userId
  const id = req.params.id
  if (typeof id !== 'string' || !id) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid user id')
  }
  const { role } = req.body as UpdateUserRoleBody

  if (id === adminId) {
    throw new HttpError(409, 'SELF_ACTION', "You can't change your own role")
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found')
  }
  if (target.role === 'ADMIN') {
    throw new HttpError(409, 'PROTECTED_ACCOUNT', 'Admin accounts cannot be modified')
  }
  if (target.role === role) {
    throw new HttpError(409, 'NO_CHANGE', `User is already a ${role} account`)
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: { role } })

    // Upsert the new role's profile (placeholder values when it doesn't exist).
    if (role === 'DONOR') {
      await tx.donor.upsert({
        where: { userId: id },
        update: {},
        create: {
          userId: id,
          organizationName: target.fullName,
          organizationType: 'Other',
          address: '—',
          city: '—',
          state: '—',
        },
      })
    } else if (role === 'NGO') {
      await tx.ngo.upsert({
        where: { userId: id },
        update: {},
        create: {
          userId: id,
          ngoName: target.fullName,
          registrationNumber: `NG-${id}`,
          address: '—',
          city: '—',
          state: '—',
          verificationStatus: 'PENDING',
        },
      })
    } else {
      await tx.volunteer.upsert({
        where: { userId: id },
        update: {},
        create: { userId: id },
      })
    }

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'user.role.updated',
        entity: 'user',
        entityId: id,
      },
    })
    return updated
  })

  res.json({ user })
}

// ── Phase 32, Step 83 — NGO verification ────────────────────────────────────

/**
 * Lists NGOs for review (Step 83). Filters by verification status (the review
 * queue), with search over name, registration number, city, and contact email.
 */
export async function listNgos(req: Request, res: Response): Promise<void> {
  const parsed = listNgosQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten().fieldErrors))
  }
  const { page, limit, search, verification } = parsed.data

  const where: Prisma.NgoWhereInput = {}
  if (verification) where.verificationStatus = verification
  if (search) {
    where.OR = [
      { ngoName: { contains: search, mode: 'insensitive' } },
      { registrationNumber: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [ngos, total] = await prisma.$transaction([
    prisma.ngo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { fullName: true, email: true, phone: true, status: true, createdAt: true } },
      },
    }),
    prisma.ngo.count({ where }),
  ])

  res.json({ ngos, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

/**
 * Full review context for one NGO (Step 83): profile, contact, headline stats,
 * and recent requests. This is what the admin sees before verifying or
 * rejecting the application.
 */
export async function getNgo(req: Request, res: Response): Promise<void> {
  const id = req.params.id
  if (typeof id !== 'string' || !id) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid NGO id')
  }

  const ngo = await prisma.ngo.findUnique({
    where: { id },
    include: {
      user: { select: { fullName: true, email: true, phone: true, status: true, createdAt: true } },
      requests: {
        orderBy: { requestedAt: 'desc' },
        take: 10,
        include: {
          donation: {
            select: { id: true, foodName: true, quantity: true, unit: true, status: true, createdAt: true },
          },
        },
      },
    },
  })
  if (!ngo) {
    throw new HttpError(404, 'NOT_FOUND', 'NGO not found')
  }

  const [accepted, totalRequests] = await Promise.all([
    prisma.ngoRequest.findMany({
      where: { ngoId: id, status: 'ACCEPTED' },
      include: { donation: { select: { status: true, quantity: true, unit: true } } },
    }),
    prisma.ngoRequest.count({ where: { ngoId: id } }),
  ])
  const delivered = accepted.filter((r) => r.donation.status === 'DELIVERED')
  const foodSavedKg = delivered.reduce((sum, r) => sum + r.donation.quantity, 0)

  res.json({
    ngo,
    stats: {
      totalRequests,
      acceptedRequests: accepted.length,
      deliveredCount: delivered.length,
      foodSavedKg,
      mealsServed: delivered.reduce((sum, r) => sum + estimateMeals(r.donation.quantity, r.donation.unit), 0),
    },
  })
}

/**
 * Verifies an NGO application (Step 83). Moves PENDING → VERIFIED, records the
 * audit trail, and notifies the NGO owner that they can now accept food.
 */
export async function verifyNgo(req: Request, res: Response): Promise<void> {
  const adminId = req.user!.userId
  const id = req.params.id
  if (typeof id !== 'string' || !id) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid NGO id')
  }

  const ngo = await prisma.ngo.findUnique({ where: { id }, include: { user: { select: { id: true } } } })
  if (!ngo) {
    throw new HttpError(404, 'NOT_FOUND', 'NGO not found')
  }
  if (ngo.verificationStatus === 'VERIFIED') {
    throw new HttpError(409, 'NO_CHANGE', 'This NGO is already verified')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.ngo.update({ where: { id }, data: { verificationStatus: 'VERIFIED' } })
    await tx.auditLog.create({
      data: { userId: adminId, action: 'ngo.verified', entity: 'ngo', entityId: id },
    })
    return result
  })

  await notifyUsers([ngo.user.id], {
    title: 'NGO verified',
    message: `Great news — ${ngo.ngoName} is now verified on Ecoserve. You can accept and redistribute food donations.`,
    type: NOTIFICATION_TYPES.NGO_VERIFIED,
  })

  res.json({ ngo: updated })
}

/**
 * Rejects an NGO application (Step 83). Moves PENDING → REJECTED with an
 * optional reason, and notifies the owner so they can fix their registration.
 */
export async function rejectNgo(req: Request, res: Response): Promise<void> {
  const adminId = req.user!.userId
  const id = req.params.id
  if (typeof id !== 'string' || !id) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid NGO id')
  }
  const { reason } = req.body as { reason?: string }

  const ngo = await prisma.ngo.findUnique({ where: { id }, include: { user: { select: { id: true } } } })
  if (!ngo) {
    throw new HttpError(404, 'NOT_FOUND', 'NGO not found')
  }
  if (ngo.verificationStatus === 'REJECTED') {
    throw new HttpError(409, 'NO_CHANGE', 'This NGO is already rejected')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.ngo.update({ where: { id }, data: { verificationStatus: 'REJECTED' } })
    await tx.auditLog.create({
      data: { userId: adminId, action: 'ngo.rejected', entity: 'ngo', entityId: id },
    })
    return result
  })

  await notifyUsers([ngo.user.id], {
    title: 'NGO verification update',
    message: reason
      ? `${ngo.ngoName} was not approved: ${reason}`
      : `${ngo.ngoName} was not approved. Please review your registration details and try again.`,
    type: NOTIFICATION_TYPES.NGO_VERIFIED,
  })

  res.json({ ngo: updated })
}

// ── Phase 32, Step 84 — Donation monitoring ─────────────────────────────────

/**
 * Platform-wide donation feed for admins (Step 84). Paginated, searchable, and
 * filterable by any donation status; the response also carries per-status
 * counts (with all other filters applied) so the UI can render the six
 * monitoring buckets: Active · Accepted · In transit · Delivered · Expired ·
 * Cancelled.
 */
export async function listAdminDonations(req: Request, res: Response): Promise<void> {
  const parsed = listAdminDonationsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten().fieldErrors))
  }
  const { page, limit, search, status, priority } = parsed.data

  const where: Prisma.DonationWhereInput = {}
  if (status) where.status = status
  // Phase 36, Step 92 — minimum AI urgency. `some` matches any prediction row;
  // today each donation has exactly one (created at listing time), so this is
  // equivalent to filtering on the latest score.
  if (priority) where.predictions = { some: { priority: { gte: priority } } }
  if (search) {
    where.OR = [
      { foodName: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { donor: { organizationName: { contains: search, mode: 'insensitive' } } },
    ]
  }

  // Per-status totals for the monitoring buckets. The status filter is removed
  // so every bucket's count is visible while search still narrows the numbers.
  const { status: _statusFilter, ...countsWhere } = where

  const [donations, total, counts] = await prisma.$transaction([
    prisma.donation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        images: { select: { id: true, imageUrl: true } },
        category: { select: { name: true } },
        donor: { select: { organizationName: true, city: true, state: true } },
        predictions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { freshnessScore: true, safeHours: true, spoilageRisk: true, priority: true },
        },
        requests: {
          where: { status: 'ACCEPTED' },
          include: { ngo: { select: { ngoName: true, verificationStatus: true } } },
        },
      },
    }),
    prisma.donation.count({ where }),
    prisma.donation.groupBy({ by: ['status'], _count: { _all: true }, where: countsWhere }),
  ])

  const countsByStatus = Object.fromEntries(counts.map((row) => [row.status, row._count._all]))

  res.json({
    donations,
    counts: countsByStatus,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

// ── Phase 32, Step 85 — Delivery monitoring ────────────────────────────────

/** Delivery states that count as an in-progress run (matches the tracking endpoint). */
const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = ['VOLUNTEER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT']

/**
 * Platform-wide delivery feed for admins (Step 85). Paginated, searchable,
 * filterable by DeliveryStatus or the Active set, and each row carries the
 * volunteer, ETA, status, and — when the volunteer is in transit — their latest
 * reported GPS position (admins are authorized to see live location data).
 */
export async function listAdminDeliveries(req: Request, res: Response): Promise<void> {
  const parsed = listAdminDeliveriesQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten().fieldErrors))
  }
  const { page, limit, search, status, active } = parsed.data

  const where: Prisma.DeliveryWhereInput = {}
  if (status) where.status = status
  if (active === 'true') where.status = { in: ACTIVE_DELIVERY_STATUSES }
  if (search) {
    where.OR = [
      { assignment: { volunteer: { user: { fullName: { contains: search, mode: 'insensitive' } } } } },
      { assignment: { donation: { foodName: { contains: search, mode: 'insensitive' } } } },
      { assignment: { donation: { donor: { organizationName: { contains: search, mode: 'insensitive' } } } } },
    ]
  }

  // Per-status totals for the monitoring tabs; search still narrows them.
  const countsWhere: Prisma.DeliveryWhereInput = { ...where }
  delete countsWhere.status

  const [deliveries, total, counts] = await prisma.$transaction([
    prisma.delivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        assignment: {
          include: {
            volunteer: {
              include: { user: { select: { fullName: true, profileImage: true } } },
            },
            donation: {
              include: {
                category: { select: { name: true } },
                donor: { select: { organizationName: true, latitude: true, longitude: true } },
                requests: {
                  where: { status: 'ACCEPTED' },
                  take: 1,
                  include: { ngo: { select: { ngoName: true, latitude: true, longitude: true } } },
                },
              },
            },
          },
        },
        locations: { orderBy: { timestamp: 'desc' }, take: 1 },
      },
    }),
    prisma.delivery.count({ where }),
    prisma.delivery.groupBy({ by: ['status'], _count: { _all: true }, where: countsWhere }),
  ])

  const items = deliveries.map((delivery) => {
    const { assignment } = delivery
    const latest = delivery.locations[0]
    const { donation } = assignment
    const ngo = donation.requests[0]?.ngo
    const pickupLat = donation.latitude ?? donation.donor.latitude
    const pickupLng = donation.longitude ?? donation.donor.longitude
    const dropLat = ngo?.latitude ?? null
    const dropLng = ngo?.longitude ?? null
    return {
      id: delivery.id,
      status: delivery.status,
      eta: delivery.eta?.toISOString() ?? null,
      startedAt: delivery.startedAt?.toISOString() ?? null,
      completedAt: delivery.completedAt?.toISOString() ?? null,
      distance: delivery.distance,
      pickupLocation: delivery.pickupLocation,
      dropLocation: delivery.dropLocation,
      createdAt: delivery.createdAt.toISOString(),
      pickup:
        pickupLat != null && pickupLng != null ? { latitude: pickupLat, longitude: pickupLng } : null,
      drop: dropLat != null && dropLng != null ? { latitude: dropLat, longitude: dropLng } : null,
      volunteer: {
        fullName: assignment.volunteer.user.fullName,
        profileImage: assignment.volunteer.user.profileImage,
        vehicleType: assignment.volunteer.vehicleType,
        vehicleNumber: assignment.volunteer.vehicleNumber,
        availability: assignment.volunteer.availability,
      },
      donation: {
        foodName: donation.foodName,
        quantity: donation.quantity,
        unit: donation.unit,
        category: donation.category.name,
        donorOrganization: donation.donor.organizationName,
        ngoName: ngo?.ngoName ?? null,
      },
      latestLocation: latest
        ? {
            latitude: latest.latitude,
            longitude: latest.longitude,
            accuracy: latest.accuracy,
            speed: latest.speed,
            heading: latest.heading,
            timestamp: latest.timestamp.toISOString(),
          }
        : null,
    }
  })

  const countsByStatus = Object.fromEntries(counts.map((row) => [row.status, row._count._all]))
  const activeCount = ACTIVE_DELIVERY_STATUSES.reduce((sum, s) => sum + (countsByStatus[s] ?? 0), 0)

  res.json({
    deliveries: items,
    counts: countsByStatus,
    activeCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

// ── Phase 33, Step 86 — Reports ────────────────────────────────────────────

/** kg CO₂e absorbed by one mature tree per year — documented estimate. */
const KG_CO2_PER_TREE_YEAR = 21
/** kg CO₂e emitted per km driven by an average car — documented estimate. */
const KG_CO2_PER_CAR_KM = 0.17

const round1 = (n: number): number => Math.round(n * 10) / 10

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Parses an ISO datetime or a bare YYYY-MM-DD (treated as a day boundary). */
function parseReportDate(value: string, endOfDay: boolean): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Date(dateOnly ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}` : value)
}

/**
 * Phase 33, Step 86 — GET /api/v1/admin/reports.
 *
 * One aggregated report over a Weekly / Monthly / Yearly / Custom window,
 * computed live from the transactional tables (same conventions as the
 * Phase 30 analytics):
 *   - summary: food saved, meals, CO₂, donations (listed/delivered/cancelled),
 *     deliveries (created/completed/cancelled), avg delivery time, users joined
 *   - series: food saved + donations + deliveries per day (short windows) or
 *     per month (yearly and long custom windows) — drives the report charts
 *   - donationByStatus: current-state breakdown of donations listed in range
 *   - topNgos / topVolunteers: performance ranks within the window
 *   - environment: CO₂ with tree / car-km equivalences
 */
export async function adminReports(req: Request, res: Response): Promise<void> {
  const parsed = reportsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten().fieldErrors))
  }
  const { range, from, to } = parsed.data

  const now = new Date()
  let fromDate: Date
  let toEnd: Date
  let rangeLabel: string

  if (range === 'custom') {
    if (!from || !to) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Custom range requires both from and to dates')
    }
    fromDate = parseReportDate(from, false)
    toEnd = parseReportDate(to, true)
    if (isNaN(fromDate.getTime()) || isNaN(toEnd.getTime()) || fromDate > toEnd) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid date range')
    }
    rangeLabel = 'Custom range'
  } else {
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    toEnd = now
    if (range === 'weekly') {
      fromDate.setDate(fromDate.getDate() - 6)
      rangeLabel = 'Last 7 days'
    } else if (range === 'monthly') {
      fromDate.setDate(fromDate.getDate() - 29)
      rangeLabel = 'Last 30 days'
    } else {
      fromDate.setFullYear(fromDate.getFullYear() - 1)
      rangeLabel = 'Last 12 months'
    }
  }

  // Series granularity: daily for short windows, monthly for long ones.
  const daySpan = Math.ceil((toEnd.getTime() - fromDate.getTime()) / 86_400_000)
  const bucket: 'day' | 'month' = range === 'yearly' || daySpan > 62 ? 'month' : 'day'

  const keys: string[] = []
  if (bucket === 'day') {
    const cursor = new Date(fromDate)
    while (cursor <= toEnd) {
      keys.push(dayKey(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
  } else {
    let y = fromDate.getFullYear()
    let m = fromDate.getMonth()
    const endY = toEnd.getFullYear()
    const endM = toEnd.getMonth()
    while (y < endY || (y === endY && m <= endM)) {
      keys.push(monthKey(new Date(y, m, 1)))
      m += 1
      if (m > 11) {
        m = 0
        y += 1
      }
    }
  }

  const [completedDeliveries, donationsInRange, deliveriesInRange, usersJoined, ngosVerified, volunteersActive] =
    await Promise.all([
      prisma.delivery.findMany({
        where: { status: 'DELIVERED', completedAt: { gte: fromDate, lte: toEnd } },
        select: {
          startedAt: true,
          completedAt: true,
          distance: true,
          assignment: {
            select: {
              volunteer: { select: { user: { select: { fullName: true } } } },
              donation: {
                select: {
                  quantity: true,
                  unit: true,
                  requests: {
                    where: { status: 'ACCEPTED' },
                    take: 1,
                    select: { ngo: { select: { ngoName: true, city: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.donation.findMany({
        where: { createdAt: { gte: fromDate, lte: toEnd } },
        select: { status: true, createdAt: true },
      }),
      prisma.delivery.findMany({
        where: { createdAt: { gte: fromDate, lte: toEnd } },
        select: { status: true, completedAt: true },
      }),
      prisma.user.count({ where: { createdAt: { gte: fromDate, lte: toEnd } } }),
      prisma.ngo.count({ where: { verificationStatus: 'VERIFIED' } }),
      prisma.volunteer.count({ where: { availability: 'AVAILABLE' } }),
    ])

  const seriesMap = new Map(keys.map((key) => [key, { foodSavedKg: 0, donations: 0, deliveries: 0 }]))
  const byNgo = new Map<string, { name: string; city: string | null; kg: number; meals: number; deliveries: number }>()
  const byVolunteer = new Map<string, { name: string; deliveries: number; distanceKm: number; meals: number }>()

  let foodSavedKg = 0
  let mealsServed = 0
  let deliverySeconds = 0

  for (const delivery of completedDeliveries) {
    if (!delivery.completedAt) continue
    const kg = foodKg(delivery.assignment.donation.quantity, delivery.assignment.donation.unit)
    const meals = estimateMeals(delivery.assignment.donation.quantity, delivery.assignment.donation.unit)
    foodSavedKg += kg
    mealsServed += meals

    if (delivery.startedAt) deliverySeconds += (delivery.completedAt.getTime() - delivery.startedAt.getTime()) / 1000

    const point = seriesMap.get(bucket === 'month' ? monthKey(delivery.completedAt) : dayKey(delivery.completedAt))
    if (point) {
      point.foodSavedKg += kg
      point.deliveries += 1
    }

    const ngo = delivery.assignment.donation.requests[0]?.ngo
    if (ngo) {
      const entry = byNgo.get(ngo.ngoName) ?? { name: ngo.ngoName, city: ngo.city, kg: 0, meals: 0, deliveries: 0 }
      entry.kg += kg
      entry.meals += meals
      entry.deliveries += 1
      byNgo.set(ngo.ngoName, entry)
    }

    const volunteerName = delivery.assignment.volunteer.user.fullName
    const volunteer = byVolunteer.get(volunteerName) ?? { name: volunteerName, deliveries: 0, distanceKm: 0, meals: 0 }
    volunteer.deliveries += 1
    volunteer.distanceKm += delivery.distance ?? 0
    volunteer.meals += meals
    byVolunteer.set(volunteerName, volunteer)
  }

  for (const donation of donationsInRange) {
    const point = seriesMap.get(bucket === 'month' ? monthKey(donation.createdAt) : dayKey(donation.createdAt))
    if (point) point.donations += 1
  }

  const donationByStatus: Record<string, number> = {}
  for (const donation of donationsInRange) {
    donationByStatus[donation.status] = (donationByStatus[donation.status] ?? 0) + 1
  }

  const deliveriesCreated = deliveriesInRange.length
  const deliveriesCancelled = deliveriesInRange.filter((d) => d.status === 'CANCELLED').length
  // Completed = created AND finished inside the window — a strict subset of
  // `deliveriesCreated`, so the UI's completion ratio stays ≤ 100%. (Food-saved
  // and rankings use `completedDeliveries`, which counts by completedAt only.)
  const deliveriesCompleted = deliveriesInRange.filter(
    (d) => d.status === 'DELIVERED' && d.completedAt && d.completedAt >= fromDate && d.completedAt <= toEnd,
  ).length
  const avgDeliveryTimeHours =
    completedDeliveries.length > 0 ? deliverySeconds / completedDeliveries.length / 3600 : 0
  const co2Kg = estimateCo2(foodSavedKg)

  res.json({
    range: { label: rangeLabel, from: fromDate.toISOString(), to: toEnd.toISOString() },
    summary: {
      foodSavedKg: round1(foodSavedKg),
      mealsServed,
      co2Kg: round1(co2Kg),
      donationsListed: donationsInRange.length,
      donationsDelivered: donationByStatus.DELIVERED ?? 0,
      donationsCancelled: donationByStatus.CANCELLED ?? 0,
      donationsExpired: donationByStatus.EXPIRED ?? 0,
      deliveriesTotal: deliveriesCreated,
      deliveriesCompleted,
      deliveriesCancelled,
      avgDeliveryTimeHours,
      usersJoined,
      ngosVerified,
      volunteersActive,
    },
    series: {
      bucket,
      points: keys.map((key) => {
        const point = seriesMap.get(key)!
        return { key, foodSavedKg: round1(point.foodSavedKg), donations: point.donations, deliveries: point.deliveries }
      }),
    },
    donationByStatus,
    topNgos: [...byNgo.values()]
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 5)
      .map((ngo) => ({ ...ngo, kg: round1(ngo.kg) })),
    topVolunteers: [...byVolunteer.values()]
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, 5)
      .map((volunteer) => ({ ...volunteer, distanceKm: round1(volunteer.distanceKm) })),
    environment: {
      co2Kg: round1(co2Kg),
      treesEquivalent: Math.round(co2Kg / KG_CO2_PER_TREE_YEAR),
      carKmAvoided: Math.round(co2Kg / KG_CO2_PER_CAR_KM),
    },
  })
}
