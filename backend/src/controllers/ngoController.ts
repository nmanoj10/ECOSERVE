import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { notifyUsers, NOTIFICATION_TYPES } from '../services/notificationService.js'
import { isUniqueViolation } from '../services/sessionService.js'
import { haversineKm } from '../utils/geo.js'
import { HttpError } from '../utils/HttpError.js'
import { estimateMeals } from '../utils/meals.js'
import { nearbyDonationsQuerySchema } from '../validators/ngo.js'
import type { CreateNgoRequestBody, UpdateNgoProfileBody } from '../validators/ngo.js'

/** Radius (km) within which AVAILABLE volunteers are alerted when food is claimed. */
const VOLUNTEER_RADIUS_KM = 30

/**
 * AVAILABLE volunteers whose live location pin is within `radiusKm` of the
 * food. Volunteers without a pin are excluded — distance matching needs one.
 */
async function findNearbyAvailableVolunteers(lat: number, lng: number, radiusKm: number): Promise<string[]> {
  const volunteers = await prisma.volunteer.findMany({
    where: { availability: 'AVAILABLE' },
    select: { userId: true, currentLatitude: true, currentLongitude: true },
  })

  return volunteers
    .filter(
      (volunteer) =>
        volunteer.currentLatitude != null &&
        volunteer.currentLongitude != null &&
        haversineKm(lat, lng, volunteer.currentLatitude, volunteer.currentLongitude) <= radiusKm,
    )
    .map((volunteer) => volunteer.userId)
}

/**
 * Phase 18, Step 54 — GET /api/v1/donations/nearby (NGO only).
 * Returns AVAILABLE donations within `distance` km of the NGO's coordinates,
 * using the donation's own lat/lng when set and falling back to the donor
 * profile's. Results are sorted by urgency — highest AI priority first, then
 * soonest expiry — so the least-shelf-life food surfaces at the top.
 */
export async function nearbyDonations(req: Request, res: Response): Promise<void> {
  const parsed = nearbyDonationsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten().fieldErrors))
  }
  const { lat, lng, distance, status, priority, page, limit } = parsed.data

  const candidates = await prisma.donation.findMany({
    where: { status },
    include: {
      images: { select: { id: true, imageUrl: true } },
      category: { select: { name: true } },
      donor: {
        select: { organizationName: true, city: true, state: true, latitude: true, longitude: true },
      },
      predictions: { orderBy: { createdAt: 'desc' }, take: 1, select: { priority: true } },
    },
  })

  const nearby = candidates
    .map((donation) => {
      const dLat = donation.latitude ?? donation.donor.latitude
      const dLng = donation.longitude ?? donation.donor.longitude
      if (dLat == null || dLng == null) return null

      return {
        donation,
        latitude: dLat,
        longitude: dLng,
        distanceKm: haversineKm(lat, lng, dLat, dLng),
        priority: donation.predictions[0]?.priority ?? null,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => item.distanceKm <= distance && (priority == null || (item.priority ?? 0) >= priority))
    .sort((a, b) => {
      // Urgency first: highest priority, then soonest expiry.
      const pa = a.priority ?? 0
      const pb = b.priority ?? 0
      if (pb !== pa) return pb - pa
      const ea = a.donation.expiryTime?.getTime() ?? Number.POSITIVE_INFINITY
      const eb = b.donation.expiryTime?.getTime() ?? Number.POSITIVE_INFINITY
      return ea - eb
    })

  const total = nearby.length
  const pageItems = nearby.slice((page - 1) * limit, page * limit)
  const donations = pageItems.map(({ donation, latitude, longitude, distanceKm, priority }) => ({
      id: donation.id,
      foodName: donation.foodName,
      description: donation.description,
      quantity: donation.quantity,
      unit: donation.unit,
      pickupAddress: donation.pickupAddress,
      expiryTime: donation.expiryTime,
      pickupTime: donation.pickupTime,
      status: donation.status,
      latitude,
      longitude,
      distanceKm: Math.round(distanceKm * 100) / 100,
      priority,
      category: donation.category.name,
      imageUrl: donation.images[0]?.imageUrl ?? null,
      donorOrganization: donation.donor.organizationName,
      donorCity: donation.donor.city,
      donorState: donation.donor.state,
    }))

  res.json({ donations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

/**
 * PATCH /api/v1/ngo/profile — updates the NGO's own profile. The location
 * fields (address/city/state + lat/lng pin) power the nearby-donations search
 * and the surplus map on the dashboard; sending `null` clears a pin.
 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const body = req.body as UpdateNgoProfileBody

  const ngo = await prisma.ngo.findUnique({ where: { userId: user.userId } })
  if (!ngo) {
    throw new HttpError(404, 'NOT_FOUND', 'NGO profile not found')
  }

  try {
    const updated = await prisma.ngo.update({
      where: { id: ngo.id },
      data: {
        ...(body.ngoName !== undefined && { ngoName: body.ngoName }),
        ...(body.registrationNumber !== undefined && { registrationNumber: body.registrationNumber }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.city !== undefined && { city: body.city }),
        ...(body.state !== undefined && { state: body.state }),
        ...(body.latitude !== undefined && { latitude: body.latitude }),
        ...(body.longitude !== undefined && { longitude: body.longitude }),
        ...(body.capacity !== undefined && { capacity: body.capacity }),
        ...(body.description !== undefined && { description: body.description }),
      },
    })
    await prisma.auditLog.create({
      data: { userId: user.userId, action: 'ngo.profile.updated', entity: 'ngo', entityId: ngo.id },
    })
    res.json({ ngo: updated })
  } catch (err) {
    // registrationNumber is unique platform-wide — surface a clear message.
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'DUPLICATE_REGISTRATION', 'An NGO with that registration number already exists')
    }
    throw err
  }
}

/**
 * Phase 18, Step 55 — POST /api/v1/ngo/requests.
 * One-step claim: the NGO's request is created as ACCEPTED.
 * Supports partial quantity claims — donation stays AVAILABLE until fully claimed.
 * If no quantity specified, claims the full donation (backward compatible).
 */
export async function createRequest(req: Request, res: Response): Promise<void> {
  const user = req.user!
  if (user.role !== 'NGO') {
    throw new HttpError(403, 'FORBIDDEN', 'Only NGO accounts can claim donations')
  }

  const ngo = await prisma.ngo.findUnique({ where: { userId: user.userId } })
  if (!ngo) {
    throw new HttpError(409, 'PROFILE_INCOMPLETE', 'NGO profile not found — complete registration first')
  }

  const { donationId, quantity: requestedQuantity, unit: requestedUnit } = req.body as CreateNgoRequestBody
  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    include: {
      donor: { select: { userId: true, organizationName: true, latitude: true, longitude: true } },
    },
  })
  if (!donation) {
    throw new HttpError(404, 'NOT_FOUND', 'Donation not found')
  }
  if (donation.status !== 'AVAILABLE') {
    throw new HttpError(409, 'NOT_AVAILABLE', 'This donation is no longer available')
  }

  // Validate requested quantity if provided
  const isPartialClaim = requestedQuantity != null && requestedQuantity > 0
  if (isPartialClaim) {
    if (requestedQuantity > donation.quantity) {
      throw new HttpError(400, 'INVALID_QUANTITY', `Requested quantity (${requestedQuantity}) exceeds available quantity (${donation.quantity} ${donation.unit})`)
    }
    if (requestedUnit && requestedUnit !== donation.unit) {
      throw new HttpError(400, 'INVALID_UNIT', `Unit must match donation unit (${donation.unit})`)
    }
  }

  const request = await prisma.$transaction(async (tx) => {
    // Calculate already claimed quantity from ACCEPTED requests
    const acceptedRequests = await tx.ngoRequest.findMany({
      where: { donationId, status: 'ACCEPTED' },
      select: { quantity: true },
    })
    const totalClaimed = acceptedRequests.reduce((sum, r) => sum + (r.quantity ?? 0), 0)
    const remainingQuantity = donation.quantity - totalClaimed

    if (isPartialClaim) {
      if (requestedQuantity > remainingQuantity) {
        throw new HttpError(409, 'INSUFFICIENT_QUANTITY', `Only ${remainingQuantity} ${donation.unit} remaining`)
      }
    }

    const effectiveQuantity = isPartialClaim ? requestedQuantity : remainingQuantity
    const effectiveUnit = requestedUnit ?? donation.unit

    // Create the request
    const created = await tx.ngoRequest.create({
      data: {
        ngoId: ngo.id,
        donationId,
        quantity: isPartialClaim ? requestedQuantity : null, // null = full claim
        unit: isPartialClaim ? effectiveUnit : null,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    })

    // Check if donation is now fully claimed
    const newTotalClaimed = totalClaimed + effectiveQuantity
    const isFullyClaimed = newTotalClaimed >= donation.quantity

    if (isFullyClaimed) {
      // Mark donation as RESERVED (fully claimed)
      await tx.donation.update({
        where: { id: donationId },
        data: { status: 'RESERVED' },
      })
    }
    // If partial claim and not fully claimed, donation stays AVAILABLE

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: 'ngo.request.accepted',
        entity: 'ngo_request',
        entityId: created.id,
      },
    })
    return { created, isFullyClaimed, effectiveQuantity, effectiveUnit, totalClaimed }
  })

  // Phase 29, Step 75 — "Donation accepted" in-app notification to the donor.
  const title = `Donation ${request.isFullyClaimed ? 'fully claimed' : 'partially claimed'}: ${donation.foodName}`
  const claimedQty = request.effectiveQuantity
  const claimedUnit = request.effectiveUnit
  const message =
    `${ngo.ngoName} claimed ${claimedQty} ${claimedUnit} of your ${donation.foodName} ` +
    `(${donation.quantity} ${donation.unit} total)${request.isFullyClaimed ? ' — donation is now fully reserved.' : ' — donation remains available for other NGOs.'}`
  await notifyUsers([donation.donor.userId], {
    title,
    message,
    type: NOTIFICATION_TYPES.DONATION_ACCEPTED,
    donationId: donation.id,
  })

  // "Volunteers needed" notification — only for full claims or first partial claim
  // to avoid spamming volunteers for every small claim
  // We already know if there were previous claims from totalClaimed > 0
  const hadPreviousClaims = request.totalClaimed > 0
  const shouldNotifyVolunteers = request.isFullyClaimed || (isPartialClaim && !hadPreviousClaims)
  if (shouldNotifyVolunteers) {
    const dLat = donation.latitude ?? donation.donor.latitude
    const dLng = donation.longitude ?? donation.donor.longitude
    if (dLat != null && dLng != null) {
      const volunteerIds = await findNearbyAvailableVolunteers(dLat, dLng, VOLUNTEER_RADIUS_KM)
      if (volunteerIds.length > 0) {
        const pickup = donation.pickupTime
          ? ` Pickup at ${String(donation.pickupTime.getHours()).padStart(2, '0')}:${String(donation.pickupTime.getMinutes()).padStart(2, '0')}.`
          : ''
        await notifyUsers(volunteerIds, {
          title: `Volunteers needed: ${donation.foodName}`,
          message:
            `${donation.foodName} (${claimedQty} ${claimedUnit} of ${donation.quantity} ${donation.unit}) from ${donation.donor.organizationName} ` +
            `was claimed by ${ngo.ngoName}. Pickup: ${donation.pickupAddress}.${pickup} Offer to help with the delivery.`,
          type: NOTIFICATION_TYPES.VOLUNTEER_NEEDED,
          donationId: donation.id,
        })
      }
    }
  }

  res.status(201).json({ request: request.created })
}

/**
 * Lists the authenticated NGO's requests (newest first) with their donations
 * (Phase 36, Step 91 — ?page=1&limit=20).
 */
export async function listRequests(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const page = Math.max(Number(req.query.page) || 1, 1)
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)

  const ngo = await prisma.ngo.findUnique({ where: { userId: user.userId } })
  if (!ngo) {
    res.json({ requests: [], pagination: { page, limit, total: 0, totalPages: 0 } })
    return
  }

  const where = { ngoId: ngo.id }
  const [requests, total] = await prisma.$transaction([
    prisma.ngoRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        donation: {
          include: {
            images: { select: { id: true, imageUrl: true } },
            category: { select: { name: true } },
            donor: { select: { organizationName: true, city: true, state: true } },
            predictions: { orderBy: { createdAt: 'desc' }, take: 1, select: { priority: true, freshnessScore: true } },
          },
        },
      },
    }),
    prisma.ngoRequest.count({ where }),
  ])

  res.json({ requests, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

/**
 * Phase 18, Step 53 — GET /api/v1/ngo/dashboard.
 * Aggregates the NGO's headline numbers: accepted food, meals distributed,
 * people served (1 meal ≈ 1 person), today's completed deliveries, and the
 * current inventory (accepted food not yet delivered).
 */
export async function dashboardStats(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const ngo = await prisma.ngo.findUnique({ where: { userId: user.userId } })
  if (!ngo) {
    res.json({ acceptedCount: 0, mealsDistributed: 0, peopleServed: 0, todayDeliveries: 0, inventory: [] })
    return
  }

  const requests = await prisma.ngoRequest.findMany({
    where: { ngoId: ngo.id, status: 'ACCEPTED' },
    include: {
      donation: {
        include: {
          images: { select: { id: true, imageUrl: true } },
          category: { select: { name: true } },
          donor: { select: { organizationName: true } },
          predictions: { orderBy: { createdAt: 'desc' }, take: 1, select: { priority: true, freshnessScore: true } },
          assignments: { include: { delivery: { select: { status: true, completedAt: true } } } },
        },
      },
    },
  })

  const delivered = requests.filter((request) => request.donation.status === 'DELIVERED')
  const mealsDistributed = delivered.reduce(
    (sum, request) => sum + estimateMeals(request.donation.quantity, request.donation.unit),
    0,
  )

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayDeliveries = requests.filter((request) =>
    request.donation.assignments.some(
      (assignment) => assignment.delivery?.completedAt && assignment.delivery.completedAt >= todayStart,
    ),
  ).length

  const inventory = requests
    .filter((request) => request.donation.status === 'RESERVED' || request.donation.status === 'PICKED_UP')
    .map(({ donation }) => ({
      id: donation.id,
      foodName: donation.foodName,
      quantity: donation.quantity,
      unit: donation.unit,
      status: donation.status,
      expiryTime: donation.expiryTime,
      priority: donation.predictions[0]?.priority ?? null,
      freshnessScore: donation.predictions[0]?.freshnessScore ?? null,
      category: donation.category.name,
      imageUrl: donation.images[0]?.imageUrl ?? null,
      donorOrganization: donation.donor.organizationName,
    }))

  res.json({
    acceptedCount: requests.length,
    mealsDistributed,
    peopleServed: mealsDistributed,
    todayDeliveries,
    inventory,
  })
}
