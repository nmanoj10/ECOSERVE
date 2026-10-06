import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { findNearbyTransitPoints } from '../services/transitService.js'
import { notifyUsers, NOTIFICATION_TYPES } from '../services/notificationService.js'
import { AVG_SPEED_KMH, ROAD_FACTOR, vehicleCapacityKg } from '../services/recommendationService.js'
import { HttpError } from '../utils/HttpError.js'
import { haversineKm } from '../utils/geo.js'
import { estimateMeals } from '../utils/meals.js'
import type { UpdateAvailabilityBody, UpdateVolunteerProfileBody } from '../validators/volunteer.js'

/** Statuses that mean a delivery run is still in progress. */
const ACTIVE_ASSIGNMENT_STATUSES = ['PENDING', 'ACCEPTED', 'IN_TRANSIT'] as const

interface TimelineEntry {
  type: 'assigned' | 'accepted' | 'in_transit' | 'completed'
  label: string
  at: string
}

/** Coordinates for the pickup end: the donation's pin, falling back to the donor's. */
function pickupCoords(donation: {
  latitude: number | null
  longitude: number | null
  donor: { latitude: number | null; longitude: number | null }
}): { latitude: number; longitude: number } | null {
  const latitude = donation.latitude ?? donation.donor.latitude
  const longitude = donation.longitude ?? donation.donor.longitude
  return latitude != null && longitude != null ? { latitude, longitude } : null
}

/** Coordinates for the drop end: the latest GPS sample, else the delivery's
 *  chosen drop pin (rescue redistributions have no NGO), else the NGO. */
function dropCoords(assignment: {
  delivery: {
    locations: Array<{ latitude: number; longitude: number }>
    dropLatitude: number | null
    dropLongitude: number | null
  } | null
  donation: { requests: Array<{ ngo: { latitude: number | null; longitude: number | null } }> }
}): { latitude: number; longitude: number } | null {
  const latest = assignment.delivery?.locations[0]
  if (latest) return { latitude: latest.latitude, longitude: latest.longitude }

  if (assignment.delivery?.dropLatitude != null && assignment.delivery.dropLongitude != null) {
    return { latitude: assignment.delivery.dropLatitude, longitude: assignment.delivery.dropLongitude }
  }

  const ngo = assignment.donation.requests[0]?.ngo
  if (ngo?.latitude != null && ngo?.longitude != null) return { latitude: ngo.latitude, longitude: ngo.longitude }
  return null
}

/** Derives the delivery timeline from the assignment/delivery timestamps. */
function buildTimeline(assignment: {
  assignedAt: Date
  acceptedAt: Date | null
  delivery: { startedAt: Date | null; completedAt: Date | null } | null
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [{ type: 'assigned', label: 'Assigned', at: assignment.assignedAt.toISOString() }]
  if (assignment.acceptedAt) {
    entries.push({ type: 'accepted', label: 'Accepted', at: assignment.acceptedAt.toISOString() })
  }
  if (assignment.delivery?.startedAt) {
    entries.push({ type: 'in_transit', label: 'Pickup started', at: assignment.delivery.startedAt.toISOString() })
  }
  if (assignment.delivery?.completedAt) {
    entries.push({ type: 'completed', label: 'Delivered', at: assignment.delivery.completedAt.toISOString() })
  }
  return entries
}

/**
 * Phase 20, Step 57 — GET /api/v1/volunteer/dashboard.
 * Today's deliveries, distance and meals delivered, the volunteer's rating,
 * the current (active) assignment with its ETA + timeline, and recent history.
 */
export async function dashboardStats(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const volunteer = await prisma.volunteer.findUnique({ where: { userId: user.userId } })
  if (!volunteer) {
    res.json({
      availability: 'OFFLINE',
      rating: 0,
      totalDeliveries: 0,
      todayDeliveries: 0,
      distanceKm: 0,
      mealsDelivered: 0,
      currentAssignment: null,
      recentDeliveries: [],
    })
    return
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const assignments = await prisma.volunteerAssignment.findMany({
    where: { volunteerId: volunteer.id },
    orderBy: { assignedAt: 'desc' },
    include: {
      donation: {
        include: {
          donor: { select: { organizationName: true, latitude: true, longitude: true } },
          category: { select: { name: true } },
          requests: {
            where: { status: 'ACCEPTED' },
            take: 1,
            include: { ngo: { select: { ngoName: true, latitude: true, longitude: true } } },
          },
        },
      },
      delivery: { include: { locations: { orderBy: { timestamp: 'desc' }, take: 1 } } },
    },
  })

  const completedToday = assignments.filter(
    (assignment) => assignment.delivery?.completedAt && assignment.delivery.completedAt >= todayStart,
  )
  const todayDeliveries = completedToday.length
  const distanceKm =
    Math.round(completedToday.reduce((sum, a) => sum + (a.delivery?.distance ?? 0), 0) * 10) / 10
  const mealsDelivered = completedToday.reduce(
    (sum, a) => sum + estimateMeals(a.donation.quantity, a.donation.unit),
    0,
  )

  const current = assignments.find((assignment) =>
    ACTIVE_ASSIGNMENT_STATUSES.some((status) => status === assignment.status),
  )

  const currentAssignment = current
    ? {
        id: current.id,
        status: current.status,
        assignedAt: current.assignedAt,
        acceptedAt: current.acceptedAt,
        donation: {
          id: current.donation.id,
          foodName: current.donation.foodName,
          quantity: current.donation.quantity,
          unit: current.donation.unit,
          pickupAddress: current.donation.pickupAddress,
          category: current.donation.category.name,
          donorOrganization: current.donation.donor.organizationName,
        },
        delivery: current.delivery
          ? {
              id: current.delivery.id,
              pickupLocation: current.delivery.pickupLocation,
              dropLocation: current.delivery.dropLocation,
              startedAt: current.delivery.startedAt,
              completedAt: current.delivery.completedAt,
              eta: current.delivery.eta,
              distance: current.delivery.distance,
              status: current.delivery.status,
            }
          : null,
        pickup: pickupCoords(current.donation),
        drop: dropCoords(current),
        timeline: buildTimeline(current),
      }
    : null

  const recentDeliveries = assignments
    .filter((assignment) => assignment.delivery?.completedAt)
    // Most recent completion first (the list is fetched ordered by assignedAt).
    .sort((a, b) => (b.delivery?.completedAt?.getTime() ?? 0) - (a.delivery?.completedAt?.getTime() ?? 0))
    .slice(0, 5)
    .map((assignment) => ({
      id: assignment.id,
      foodName: assignment.donation.foodName,
      donorOrganization: assignment.donation.donor.organizationName,
      ngoName: assignment.donation.requests[0]?.ngo.ngoName ?? null,
      distance: assignment.delivery?.distance ?? null,
      completedAt: assignment.delivery?.completedAt ?? null,
      status: assignment.status,
    }))

  res.json({
    availability: volunteer.availability,
    rating: volunteer.rating,
    totalDeliveries: volunteer.totalDeliveries,
    todayDeliveries,
    distanceKm,
    mealsDelivered,
    currentAssignment,
    recentDeliveries,
  })
}

/**
 * Phase 20, Step 58 — PATCH /api/v1/volunteer/availability.
 * Toggles the volunteer's state (AVAILABLE / BUSY / OFFLINE). The rescue sweep
 * (Phase 19) only alerts AVAILABLE volunteers, so this directly controls
 * whether they get rescue notifications.
 */
export async function updateAvailability(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const { availability } = req.body as UpdateAvailabilityBody

  const volunteer = await prisma.volunteer.findUnique({ where: { userId: user.userId } })
  if (!volunteer) {
    throw new HttpError(409, 'PROFILE_INCOMPLETE', 'Volunteer profile not found — complete registration first')
  }

  const updated = await prisma.volunteer.update({
    where: { id: volunteer.id },
    data: { availability },
  })

  res.json({ volunteer: updated })
}

/**
 * PATCH /api/v1/volunteer/profile — updates the volunteer's own profile.
 * Vehicle details plus the live location pin that rescue matching and the
 * delivery drop-off use; sending `null` clears the pin.
 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const body = req.body as UpdateVolunteerProfileBody

  const volunteer = await prisma.volunteer.findUnique({ where: { userId: user.userId } })
  if (!volunteer) {
    throw new HttpError(404, 'NOT_FOUND', 'Volunteer profile not found')
  }

  const updated = await prisma.volunteer.update({
    where: { id: volunteer.id },
    data: {
      ...(body.vehicleType !== undefined && { vehicleType: body.vehicleType }),
      ...(body.vehicleNumber !== undefined && { vehicleNumber: body.vehicleNumber }),
      ...(body.availability !== undefined && { availability: body.availability }),
      ...(body.currentLatitude !== undefined && { currentLatitude: body.currentLatitude }),
      ...(body.currentLongitude !== undefined && { currentLongitude: body.currentLongitude }),
    },
  })

  await prisma.auditLog.create({
    data: { userId: user.userId, action: 'volunteer.profile.updated', entity: 'volunteer', entityId: volunteer.id },
  })

  res.json({ volunteer: updated })
}

/** The donation shape the rescue map needs, donor pin included. */
interface RescueDonation {
  id: string
  foodName: string
  quantity: number
  unit: string
  pickupAddress: string
  expiryTime: Date | null
  status: string
  latitude: number | null
  longitude: number | null
  donor: { organizationName: string; latitude: number | null; longitude: number | null }
  /** Present when the donation was fetched by id — the volunteer's own assignment. */
  assignments?: Array<{ id: string }>
}

/**
 * Phase 45 — GET /api/v1/volunteer/rescue-spots?donationId=…
 *
 * The rescue map for a volunteer who accepted a rescue alert: the donor's
 * pickup location plus nearby railway stations, bus stands and spots where
 * homeless people gather (with street addresses), so the volunteer can pick
 * up the food and hand it out directly. Without `donationId` it anchors on
 * the volunteer's current active assignment (its donation's pickup).
 */
export async function rescueSpots(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const donationId =
    typeof req.query.donationId === 'string' && req.query.donationId.trim().length > 0
      ? req.query.donationId.trim()
      : null

  const volunteer = await prisma.volunteer.findUnique({ where: { userId: user.userId } })
  if (!volunteer) {
    throw new HttpError(409, 'PROFILE_INCOMPLETE', 'Volunteer profile not found — complete registration first')
  }

  let donation: RescueDonation

  if (donationId) {
    const found = await prisma.donation.findUnique({
      where: { id: donationId },
      include: {
        donor: { select: { organizationName: true, latitude: true, longitude: true } },
        assignments: { where: { volunteerId: volunteer.id }, select: { id: true } },
      },
    })
    if (!found) {
      throw new HttpError(404, 'NOT_FOUND', 'Donation not found')
    }
    // A rescue alert is only actionable while the food is unclaimed — unless
    // the volunteer is already assigned to this donation.
    if (found.status !== 'AVAILABLE' && found.assignments.length === 0) {
      throw new HttpError(409, 'NOT_AVAILABLE', 'This donation is no longer available for rescue')
    }
    donation = found
  } else {
    const current = await prisma.volunteerAssignment.findFirst({
      where: { volunteerId: volunteer.id, status: { in: ['PENDING', 'ACCEPTED', 'IN_TRANSIT'] } },
      orderBy: { assignedAt: 'desc' },
      include: {
        donation: {
          include: { donor: { select: { organizationName: true, latitude: true, longitude: true } } },
        },
      },
    })
    if (!current) {
      res.json({ donation: null, pickup: null, pickupMapsUrl: null, spots: [] })
      return
    }
    donation = current.donation
  }

  const dLat = donation.latitude ?? donation.donor.latitude
  const dLng = donation.longitude ?? donation.donor.longitude
  if (dLat == null || dLng == null) {
    throw new HttpError(409, 'NO_LOCATION', 'This donation has no location pin — use the pickup address instead')
  }

  // Best-effort — Overpass outages degrade to an empty spot list, never an error.
  // Radius is env-tunable (RESCUE_SPOT_RADIUS_KM) and shared with the rescue
  // alert sweep, so map and message always agree on "nearby".
  const spots = await findNearbyTransitPoints(dLat, dLng, env.RESCUE_SPOT_RADIUS_KM * 1000, 10).catch(() => [])

  res.json({
    donation: {
      id: donation.id,
      foodName: donation.foodName,
      quantity: donation.quantity,
      unit: donation.unit,
      donorOrganization: donation.donor.organizationName,
      pickupAddress: donation.pickupAddress,
      expiryTime: donation.expiryTime,
      status: donation.status,
    },
    pickup: { latitude: dLat, longitude: dLng },
    pickupMapsUrl: `https://maps.google.com/?q=${dLat.toFixed(5)},${dLng.toFixed(5)}`,
    spots: spots.map((spot) => ({
      ...spot,
      mapsUrl: `https://maps.google.com/?q=${spot.latitude.toFixed(5)},${spot.longitude.toFixed(5)}`,
    })),
  })
}

/**
 * Phase 46 — POST /api/v1/volunteer/rescue-claim.
 *
 * A volunteer accepts a rescue alert and takes responsibility for the
 * redistribution: pickup at the donor, hand the food out at the distribution
 * spot they chose (the nearest known spot when no `distributionSpot` is sent).
 *
 * One transaction reuses the standard assignment/delivery machinery so live
 * GPS tracking, pickup and complete all work for rescue runs, and the donation
 * flips to RESERVED (via an atomic AVAILABLE-update guard) so the rescue sweep
 * and any NGO claim can no longer target it. Pending NGO requests are
 * cancelled — the donor decided the volunteer route.
 */
export async function rescueClaim(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const body = (req.body ?? {}) as {
    donationId?: unknown
    distributionSpot?: { name?: unknown; latitude?: unknown; longitude?: unknown } | null
  }
  const donationId = typeof body.donationId === 'string' ? body.donationId.trim() : ''
  if (!donationId) {
    throw new HttpError(400, 'VALIDATION', 'donationId is required')
  }
  const spotValid =
    body.distributionSpot != null &&
    typeof body.distributionSpot.name === 'string' &&
    typeof body.distributionSpot.latitude === 'number' &&
    typeof body.distributionSpot.longitude === 'number'

  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: user.userId },
    include: { user: { select: { fullName: true } } },
  })
  if (!volunteer) {
    throw new HttpError(409, 'PROFILE_INCOMPLETE', 'Volunteer profile not found — complete registration first')
  }

  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    include: {
      donor: { select: { userId: true, organizationName: true, latitude: true, longitude: true } },
      requests: { where: { status: 'ACCEPTED' }, take: 1, select: { id: true } },
    },
  })
  if (!donation) {
    throw new HttpError(404, 'NOT_FOUND', 'Donation not found')
  }
  if (donation.status !== 'AVAILABLE') {
    throw new HttpError(409, 'NOT_AVAILABLE', 'This donation is no longer available for rescue')
  }

  // Same vehicle-capacity rule as the NGO delivery flow — a bike can't carry 200 kg.
  if (donation.unit === 'kg' && donation.quantity > vehicleCapacityKg(volunteer.vehicleType)) {
    throw new HttpError(409, 'VEHICLE_CAPACITY', 'Your vehicle cannot carry this quantity')
  }

  const pickupLat = donation.latitude ?? donation.donor.latitude
  const pickupLng = donation.longitude ?? donation.donor.longitude
  if (pickupLat == null || pickupLng == null) {
    throw new HttpError(409, 'NO_LOCATION', 'This donation has no location pin — the donor must add one first')
  }

  // Drop: the volunteer's chosen distribution spot, else the pickup point
  // (hand out "near the donor" and pick an exact spot on arrival).
  const dropLat = spotValid ? (body.distributionSpot!.latitude as number) : pickupLat
  const dropLng = spotValid ? (body.distributionSpot!.longitude as number) : pickupLng
  const dropLocation = spotValid ? (body.distributionSpot!.name as string) : `Near ${donation.pickupAddress}`

  // Distance + ETA from the volunteer's location to the pickup point (same
  // budget heuristic as assignmentController).
  const distanceKm =
    volunteer.currentLatitude != null && volunteer.currentLongitude != null
      ? Math.round(haversineKm(pickupLat, pickupLng, volunteer.currentLatitude, volunteer.currentLongitude) * 100) / 100
      : null
  const etaMinutes = distanceKm != null ? Math.round((distanceKm * ROAD_FACTOR * 60) / AVG_SPEED_KMH) : null

  let result
  try {
    result = await prisma.$transaction(async (tx) => {
      // Atomic claim — the AVAILABLE-update guard is the single source of
      // truth against a concurrent NGO claim or another volunteer.
      const claimed = await tx.donation.updateMany({
        where: { id: donationId, status: 'AVAILABLE' },
        data: { status: 'RESERVED', rescueNotifiedAt: new Date() },
      })
      if (claimed.count === 0) {
        throw new HttpError(409, 'NOT_AVAILABLE', 'This donation has already been claimed')
      }
      // The donor's final call was the volunteer route — clear pending NGO offers.
      await tx.ngoRequest.updateMany({
        where: { donationId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      })

      const assignment = await tx.volunteerAssignment.create({
        data: { volunteerId: volunteer.id, donationId, status: 'ACCEPTED', acceptedAt: new Date() },
      })
      const delivery = await tx.delivery.create({
        data: {
          assignmentId: assignment.id,
          pickupLocation: donation.pickupAddress,
          dropLocation,
          dropLatitude: dropLat,
          dropLongitude: dropLng,
          eta: etaMinutes != null ? new Date(Date.now() + etaMinutes * 60_000) : null,
          distance: distanceKm,
          status: 'VOLUNTEER_ASSIGNED',
        },
      })
      await tx.volunteer.update({ where: { id: volunteer.id }, data: { availability: 'BUSY' } })
      await tx.auditLog.create({
        data: { userId: user.userId, action: 'rescue.claimed', entity: 'donation', entityId: donationId },
      })
      return { assignment, delivery }
    })
  } catch (err) {
    // Unique constraint on VolunteerAssignment.donationId — two volunteers
    // claiming the same donation concurrently.
    if ((err as { code?: string }).code === 'P2002') {
      throw new HttpError(409, 'ALREADY_CLAIMED', 'Another volunteer already claimed this rescue')
    }
    throw err
  }

  // Notify the donor and the volunteer themselves so both dashboards update.
  const donorMessage = `${volunteer.user.fullName} is picking up your ${donation.foodName} and handing it out${
    spotValid ? ` at ${dropLocation}` : ' nearby'
  } — you can follow their live location during the run.`
  await notifyUsers([donation.donor.userId], {
    title: `Rescue accepted: ${donation.foodName}`,
    message: donorMessage,
    type: NOTIFICATION_TYPES.VOLUNTEER_ASSIGNED,
    donationId: donation.id,
  })
  await notifyUsers([volunteer.userId], {
    title: `Rescue claimed: ${donation.foodName}`,
    message: `You're redistributing ${donation.foodName} from ${donation.donor.organizationName} at ${donation.pickupAddress}. Start the pickup when you arrive — live tracking begins automatically.`,
    type: NOTIFICATION_TYPES.VOLUNTEER_ASSIGNED,
    donationId: donation.id,
  })

  res.status(201).json({ assignment: result.assignment, delivery: result.delivery })
}
