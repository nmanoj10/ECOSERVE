import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { notifyUsers, NOTIFICATION_TYPES } from '../services/notificationService.js'
import {
  AVG_SPEED_KMH,
  recommendVolunteers,
  ROAD_FACTOR,
  vehicleCapacityKg,
} from '../services/recommendationService.js'
import { haversineKm } from '../utils/geo.js'
import { HttpError } from '../utils/HttpError.js'
import type { CreateAssignmentBody } from '../validators/assignment.js'
import { recommendQuerySchema } from '../validators/assignment.js'

/**
 * Phase 21, Step 59 — GET /api/v1/assignments/recommend?donationId=…
 * Ranked AVAILABLE volunteers for a claimed donation, with the score breakdown.
 * Empty when the donation isn't claimed yet (nothing to deliver).
 */
export async function recommend(req: Request, res: Response): Promise<void> {
  const parsed = recommendQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', JSON.stringify(parsed.error.flatten().fieldErrors))
  }
  const { donationId, limit } = parsed.data

  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    include: { donor: { select: { organizationName: true, latitude: true, longitude: true } } },
  })
  if (!donation) {
    throw new HttpError(404, 'NOT_FOUND', 'Donation not found')
  }

  const base = {
    id: donation.id,
    foodName: donation.foodName,
    quantity: donation.quantity,
    unit: donation.unit,
    pickupAddress: donation.pickupAddress,
    donorOrganization: donation.donor.organizationName,
  }

  if (donation.status !== 'RESERVED') {
    res.json({ donation: base, recommendations: [] })
    return
  }

  const recommendations = (await recommendVolunteers(donation)).slice(0, limit)
  res.json({ donation: base, recommendations })
}

/**
 * Phase 21, Step 60 — POST /api/v1/assignments.
 * A volunteer accepts a claimed donation → the assignment (ACCEPTED) and its
 * delivery run are created in one transaction, the volunteer flips to BUSY,
 * and the NGO + donor get notified. The response also carries the volunteer's
 * recommendation rank (Step 59) for transparency.
 */
export async function createAssignment(req: Request, res: Response): Promise<void> {
  const user = req.user!
  if (user.role !== 'VOLUNTEER') {
    throw new HttpError(403, 'FORBIDDEN', 'Only volunteers can accept deliveries')
  }

  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: user.userId },
    include: { user: { select: { fullName: true } } },
  })
  if (!volunteer) {
    throw new HttpError(409, 'PROFILE_INCOMPLETE', 'Volunteer profile not found — complete registration first')
  }
  if (volunteer.availability !== 'AVAILABLE') {
    throw new HttpError(409, 'VOLUNTEER_UNAVAILABLE', 'Set your availability to Available before accepting deliveries')
  }

  const { donationId } = req.body as CreateAssignmentBody
  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    include: {
      donor: { select: { userId: true, organizationName: true, latitude: true, longitude: true } },
      requests: {
        where: { status: 'ACCEPTED' },
        take: 1,
        include: { ngo: { select: { userId: true, ngoName: true, address: true } } },
      },
    },
  })
  if (!donation) {
    throw new HttpError(404, 'NOT_FOUND', 'Donation not found')
  }
  if (donation.status !== 'RESERVED') {
    throw new HttpError(409, 'NOT_CLAIMED', 'Only claimed donations can be assigned a delivery')
  }

  // Same vehicle-capacity rule as the Step 59 ranking — a bike can't carry 200 kg.
  if (donation.unit === 'kg' && donation.quantity > vehicleCapacityKg(volunteer.vehicleType)) {
    throw new HttpError(409, 'VEHICLE_CAPACITY', 'Your vehicle cannot carry this quantity')
  }

  const existing = await prisma.volunteerAssignment.findFirst({ where: { donationId } })
  if (existing) {
    throw new HttpError(409, 'ALREADY_ASSIGNED', 'This donation already has a delivery volunteer')
  }
  const ngo = donation.requests[0]?.ngo
  if (!ngo) {
    throw new HttpError(409, 'NO_NGO', 'No NGO has accepted this donation yet')
  }

  // Distance + ETA from the volunteer's location to the pickup point.
  const pickupLat = donation.latitude ?? donation.donor.latitude
  const pickupLng = donation.longitude ?? donation.donor.longitude
  const distanceKm =
    pickupLat != null && pickupLng != null && volunteer.currentLatitude != null && volunteer.currentLongitude != null
      ? Math.round(haversineKm(pickupLat, pickupLng, volunteer.currentLatitude, volunteer.currentLongitude) * 100) / 100
      : null
  const etaMinutes = distanceKm != null ? Math.round((distanceKm * ROAD_FACTOR * 60) / AVG_SPEED_KMH) : null

  // Where does the accepting volunteer sit in the Step 59 ranking?
  const recommendations = await recommendVolunteers(donation)
  const callerRank = recommendations.findIndex((entry) => entry.volunteerId === user.userId)
  const callerEntry = callerRank >= 0 ? recommendations[callerRank] : undefined
  const recommendation = callerEntry
    ? { rank: callerRank + 1, total: recommendations.length, score: callerEntry.score }
    : null

  let result
  try {
    result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.volunteerAssignment.create({
      data: { volunteerId: volunteer.id, donationId, status: 'ACCEPTED', acceptedAt: new Date() },
    })
    const delivery = await tx.delivery.create({
      data: {
        assignmentId: assignment.id,
        pickupLocation: donation.pickupAddress,
        dropLocation: ngo.address,
        eta: etaMinutes != null ? new Date(Date.now() + etaMinutes * 60_000) : null,
        distance: distanceKm,
        status: 'VOLUNTEER_ASSIGNED',
      },
    })
    await tx.volunteer.update({ where: { id: volunteer.id }, data: { availability: 'BUSY' } })
    await tx.auditLog.create({
      data: { userId: user.userId, action: 'assignment.created', entity: 'assignment', entityId: assignment.id },
    })
      return { assignment, delivery }
    })
  } catch (err) {
    // Unique constraint on VolunteerAssignment.donationId — the deterministic
    // guard against two volunteers accepting the same donation concurrently.
    if ((err as { code?: string }).code === 'P2002') {
      throw new HttpError(409, 'ALREADY_ASSIGNED', 'This donation already has a delivery volunteer')
    }
    throw err
  }

  // Phase 29, Step 75 — "Volunteer assigned" in-app notification to the NGO,
  // the donor, AND the volunteer themself so their dashboard shows the journey
  // from the very first step.
  const title = `Delivery volunteer assigned: ${donation.foodName}`
  const message =
    `${volunteer.user.fullName}${volunteer.vehicleType ? ` (${volunteer.vehicleType})` : ''} is delivering ` +
    `${donation.foodName} to ${ngo.ngoName}${etaMinutes != null ? ` — ETA ~${etaMinutes} min` : ''}.`
  const recipients = [...new Set([ngo.userId, donation.donor.userId, volunteer.userId])]
  await notifyUsers(recipients, {
    title,
    message,
    type: NOTIFICATION_TYPES.VOLUNTEER_ASSIGNED,
    donationId: donation.id,
  })

  res.status(201).json({ assignment: result.assignment, delivery: result.delivery, recommendation })
}
