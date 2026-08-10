import type { Request, Response } from 'express'
import type { Prisma } from '../generated/prisma/client.js'

import { prisma } from '../config/prisma.js'
import { classifyFoodImage } from '../services/foodClassifierService.js'
import { scoreDonation } from '../services/freshnessService.js'
import { HttpError } from '../utils/HttpError.js'
import { listDonationsQuerySchema, type CreateDonationBody } from '../validators/donation.js'

interface TimelineEntry {
  type: 'listed' | 'requested' | 'accepted' | 'rejected' | 'assigned' | 'picked_up' | 'delivered' | 'expired' | 'cancelled'
  label: string
  at: Date
  detail?: string
}

/** Structural subset of the detail query result used to derive the timeline. */
interface TimelineSource {
  createdAt: Date
  updatedAt: Date
  expiryTime: Date | null
  status: string
  requests: Array<{
    requestedAt: Date
    acceptedAt: Date | null
    rejectedAt: Date | null
    status: string
    ngo: { ngoName: string }
  }>
  assignments: Array<{
    acceptedAt: Date | null
    delivery: { startedAt: Date | null; completedAt: Date | null } | null
  }>
}

/**
 * Derives a chronological event timeline for a donation from its own
 * timestamps plus those of its requests, assignment, and delivery.
 */
function buildTimeline(d: TimelineSource): TimelineEntry[] {
  const entries: TimelineEntry[] = [{ type: 'listed', label: 'Donation listed', at: d.createdAt }]

  for (const request of d.requests) {
    entries.push({
      type: 'requested',
      label: `Requested by ${request.ngo.ngoName}`,
      at: request.requestedAt,
      detail: request.status,
    })
    if (request.acceptedAt) entries.push({ type: 'accepted', label: 'Request accepted', at: request.acceptedAt })
    if (request.rejectedAt) entries.push({ type: 'rejected', label: 'Request rejected', at: request.rejectedAt })
  }

  for (const assignment of d.assignments) {
    if (assignment.acceptedAt) {
      entries.push({ type: 'assigned', label: 'Volunteer assigned', at: assignment.acceptedAt })
    }
    if (assignment.delivery?.startedAt) {
      entries.push({ type: 'picked_up', label: 'Pickup started', at: assignment.delivery.startedAt })
    }
    if (assignment.delivery?.completedAt) {
      entries.push({ type: 'delivered', label: 'Delivered', at: assignment.delivery.completedAt })
    }
  }

  if (d.status === 'EXPIRED' && d.expiryTime) {
    entries.push({ type: 'expired', label: 'Listing expired', at: d.expiryTime })
  }
  if (d.status === 'CANCELLED') {
    entries.push({ type: 'cancelled', label: 'Listing cancelled', at: d.updatedAt })
  }

  return entries.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/**
 * Creates a donation listing for the authenticated donor. Flow (Step 47):
 * authenticate → authorize donor → validate → create donation → save image
 * metadata → trigger AI freshness scoring → return the listing. The category
 * is resolved by name (created on first use); everything is saved in one
 * transaction with an audit-log entry. AI scoring never fails the request —
 * the prediction is advisory.
 */
export async function createDonation(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const body = req.body as CreateDonationBody

  if (user.role !== 'DONOR') {
    throw new HttpError(403, 'FORBIDDEN', 'Only donor accounts can list donations')
  }

  const donor = await prisma.donor.findUnique({ where: { userId: user.userId } })
  if (!donor) {
    throw new HttpError(409, 'PROFILE_INCOMPLETE', 'Donor profile not found — complete registration first')
  }

  const toDate = (iso?: string) => (iso ? new Date(iso) : null)

  const donation = await prisma.$transaction(async (tx) => {
    // Resolved by name, created on first use — inside the transaction so a
    // failed donation create can't orphan a category row.
    const category = await tx.foodCategory.upsert({
      where: { name: body.category },
      update: {},
      create: { name: body.category },
    })

    const created = await tx.donation.create({
      data: {
        donorId: donor.id,
        categoryId: category.id,
        foodName: body.foodName,
        description: body.description ?? null,
        quantity: body.quantity,
        unit: body.unit,
        preparedAt: toDate(body.preparedAt),
        expiryTime: toDate(body.expiryTime),
        pickupTime: toDate(body.pickupTime),
        pickupAddress: body.pickupAddress,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        images: {
          create: body.images.map((image) => ({
            imageUrl: image.url,
            fileId: image.fileId ?? null,
            fileName: image.fileName,
            fileSize: image.fileSize ?? null,
            mimeType: image.mimeType ?? null,
          })),
        },
      },
      include: { images: true, category: true },
    })

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: 'donation.created',
        entity: 'donation',
        entityId: created.id,
      },
    })

    return created
  })

  // Trigger AI (Step 47): score freshness + urgency from category and times.
  // The rule model is the primary signal and is intentionally never allowed to
  // fail the request; the food classifier below enriches the same row.
  let prediction = null
  try {
    const score = scoreDonation({
      category: donation.category.name,
      quantity: donation.quantity,
      expiryTime: donation.expiryTime,
      pickupTime: donation.pickupTime,
    })
    prediction = await prisma.aiPrediction.create({
      data: {
        donationId: donation.id,
        freshnessScore: score.freshnessScore,
        safeHours: score.safeHours,
        spoilageRisk: score.spoilageRisk,
        priority: score.priority,
        confidence: score.confidence,
        modelVersion: score.modelVersion,
      },
    })

    // Step 96 — dish enrichment from the Python ai-service (complementary to
    // freshness). Fail-open: when AI_SERVICE_URL is unset or the service is
    // down, `classifyFoodImage` returns null and the listing stands as-is.
    const firstImageUrl = donation.images[0]?.imageUrl
    if (firstImageUrl) {
      const food = await classifyFoodImage(firstImageUrl)
      if (food) {
        prediction = await prisma.aiPrediction.update({
          where: { id: prediction.id },
          data: {
            foodClass: food.foodClass,
            foodClassConfidence: food.confidence,
            foodClassUncertain: food.uncertain,
            foodClassifierModel: food.modelVersion,
          },
        })
      }
    }
  } catch (err) {
    console.error(`[ai] prediction failed for donation ${donation.id}:`, err)
  }

  res.status(201).json({ donation, prediction })
}

/**
 * Lists donations with pagination + filters (Step 48). Donors see their own
 * listings by default; other roles browse the whole pool. Filters: `search`
 * (food name / description / donor org), `status`, `category` (name),
 * `dateFrom`/`dateTo` (createdAt range).
 */
export async function listDonations(req: Request, res: Response): Promise<void> {
  const user = req.user!

  // Run the schema (not just cast): coerces page/limit to ints and applies
  // defaults — req.query arrives as strings, and Prisma rejects string values.
  const parsed = listDonationsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten().fieldErrors))
  }
  const { page, limit, search, status, category, priority, dateFrom, dateTo } = parsed.data

  const where: Prisma.DonationWhereInput = {}

  if (user.role === 'DONOR') {
    const donor = await prisma.donor.findUnique({ where: { userId: user.userId } })
    if (!donor) {
      res.json({ donations: [], pagination: { page, limit, total: 0, totalPages: 0 } })
      return
    }
    where.donorId = donor.id
  }

  if (status) where.status = status
  if (category) where.category = { name: { equals: category, mode: 'insensitive' } }
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
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    }
  }

  const [donations, total] = await prisma.$transaction([
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
          select: {
            freshnessScore: true,
            safeHours: true,
            spoilageRisk: true,
            priority: true,
            foodClass: true,
            foodClassConfidence: true,
            foodClassUncertain: true,
          },
        },
      },
    }),
    prisma.donation.count({ where }),
  ])

  res.json({
    donations,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

/**
 * Returns one donation with its full context (Step 49): images, latest AI
 * prediction, NGO requests, volunteer assignment + delivery (with the most
 * recent GPS point), and a derived event timeline.
 */
export async function getDonation(req: Request, res: Response): Promise<void> {
  const id = req.params.id
  if (typeof id !== 'string' || !id) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid donation id')
  }

  const donation = await prisma.donation.findUnique({
    where: { id },
    include: {
      images: true,
      category: true,
      // City/state only — street addresses are sensitive and belong to the
      // pickup address on the donation itself (already visible to claimers).
      donor: {
        select: {
          organizationName: true,
          organizationType: true,
          city: true,
          state: true,
        },
      },
      predictions: { orderBy: { createdAt: 'desc' }, take: 1 },
      requests: {
        orderBy: { requestedAt: 'desc' },
        include: {
          ngo: { select: { id: true, ngoName: true, city: true, state: true, verificationStatus: true } },
        },
      },
      assignments: {
        orderBy: { assignedAt: 'desc' },
        include: {
          // No contact details: phone is only shared with the parties involved
          // in a live assignment via a separate, role-checked flow.
          volunteer: {
            select: {
              id: true,
              vehicleType: true,
              availability: true,
              rating: true,
              totalDeliveries: true,
              user: { select: { fullName: true, profileImage: true } },
            },
          },
          delivery: { include: { locations: { orderBy: { timestamp: 'desc' }, take: 1 } } },
        },
      },
    },
  })

  if (!donation) {
    throw new HttpError(404, 'NOT_FOUND', 'Donation not found')
  }

  res.json({ donation: { ...donation, timeline: buildTimeline(donation) } })
}
