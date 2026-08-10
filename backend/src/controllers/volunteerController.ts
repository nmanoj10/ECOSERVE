import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { HttpError } from '../utils/HttpError.js'
import { estimateMeals } from '../utils/meals.js'
import type { UpdateAvailabilityBody } from '../validators/volunteer.js'

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

/** Coordinates for the drop end: the latest GPS sample, else the accepting NGO. */
function dropCoords(assignment: {
  delivery: { locations: Array<{ latitude: number; longitude: number }> } | null
  donation: { requests: Array<{ ngo: { latitude: number | null; longitude: number | null } }> }
}): { latitude: number; longitude: number } | null {
  const latest = assignment.delivery?.locations[0]
  if (latest) return { latitude: latest.latitude, longitude: latest.longitude }

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
