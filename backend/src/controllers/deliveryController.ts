import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { maybeNotifyApproaching } from '../services/deliveryService.js'
import { notifyUsers, NOTIFICATION_TYPES } from '../services/notificationService.js'
import { emitToDeliveryRoom, emitToUser } from '../services/realtime.js'
import { HttpError } from '../utils/HttpError.js'
import type { SubmitLocationBody } from '../validators/location.js'
import type { DeliveryStatus } from '../validators/statuses.js'

/** The one status a delivery must be in for the volunteer to start collecting and heading out. */
const STARTABLE_STATUS: DeliveryStatus = 'VOLUNTEER_ASSIGNED'

/**
 * Phase 22, Step 61 — POST /api/v1/deliveries/:id/start.
 *
 * The volunteer picks up the food and begins transit. In one transaction:
 *   - Delivery  → IN_TRANSIT (with startedAt)
 *   - Donation  → PICKED_UP
 *   - Assignment → IN_TRANSIT (with pickupTime)
 *
 * Precondition: the delivery must be exactly VOLUNTEER_ASSIGNED.
 * The atomic `updateMany` with a status filter prevents race conditions
 * between concurrent requests (unlike a read-then-write guard, which could
 * have two requests both pass the check before either commits).
 */
export async function startDelivery(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const id = req.params.id as string

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      assignment: {
        include: {
          volunteer: { include: { user: { select: { fullName: true, id: true } } } },
          donation: {
            include: {
              donor: { select: { userId: true, organizationName: true } },
              requests: {
                where: { status: 'ACCEPTED' },
                take: 1,
                include: { ngo: { select: { userId: true, ngoName: true } } },
              },
            },
          },
        },
      },
    },
  })

  if (!delivery) {
    throw new HttpError(404, 'NOT_FOUND', 'Delivery not found')
  }

  if (delivery.assignment.volunteer.userId !== user.userId) {
    throw new HttpError(403, 'FORBIDDEN', 'This delivery is assigned to another volunteer')
  }

  if (delivery.status !== STARTABLE_STATUS) {
    throw new HttpError(
      409,
      'INVALID_TRANSITION',
      `Cannot start delivery from status ${delivery.status} — only ${STARTABLE_STATUS} is allowed`,
    )
  }

  const { assignment } = delivery
  const { donation } = assignment
  const ngo = donation.requests[0]?.ngo

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    // Atomic status check + update — prevents two requests from both starting.
    const started = await tx.delivery.updateMany({
      where: { id, status: 'VOLUNTEER_ASSIGNED' },
      data: { status: 'IN_TRANSIT', startedAt: now },
    })

    if (started.count !== 1) {
      throw new HttpError(409, 'INVALID_TRANSITION', 'Delivery has already been started')
    }

    await tx.donation.update({
      where: { id: donation.id },
      data: { status: 'PICKED_UP' },
    })

    await tx.volunteerAssignment.update({
      where: { id: assignment.id },
      data: { status: 'IN_TRANSIT', pickupTime: now },
    })

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: 'delivery.started',
        entity: 'delivery',
        entityId: id,
      },
    })
  })

  // Phase 29, Step 75 — two in-app notifications: the pickup happened, and the
  // delivery leg has started. Both go to the donor + NGO (and the volunteer
  // gets a first-person confirmation so their dashboard shows the journey).
  const recipients: string[] = [donation.donor.userId]
  if (ngo?.userId) recipients.push(ngo.userId)

  await notifyUsers(recipients, {
    title: `Pickup started: ${donation.foodName}`,
    message:
      `${assignment.volunteer.user.fullName} picked up ${donation.foodName} ` +
      `from ${donation.donor.organizationName}.`,
    type: NOTIFICATION_TYPES.PICKUP_STARTED,
    donationId: donation.id,
  })
  await notifyUsers(recipients, {
    title: `In transit: ${donation.foodName}`,
    message:
      `${assignment.volunteer.user.fullName} is delivering ${donation.foodName} ` +
      `to ${ngo?.ngoName ?? delivery.dropLocation}.`,
    type: NOTIFICATION_TYPES.DELIVERY_STARTED,
    donationId: donation.id,
  })
  await notifyUsers([user.userId], {
    title: `Pickup started: ${donation.foodName}`,
    message: `You picked up ${donation.foodName} from ${donation.donor.organizationName}. Head to ${ngo?.ngoName ?? delivery.dropLocation}.`,
    type: NOTIFICATION_TYPES.PICKUP_STARTED,
    donationId: donation.id,
  })
  await notifyUsers([user.userId], {
    title: `In transit: ${donation.foodName}`,
    message: `You're delivering ${donation.foodName} to ${ngo?.ngoName ?? delivery.dropLocation}. Drive safe!`,
    type: NOTIFICATION_TYPES.DELIVERY_STARTED,
    donationId: donation.id,
  })

  // Realtime: broadcast the status flip to the delivery room so every watcher
  // (volunteer, donor, NGO) sees "In transit" the moment pickup happens.
  emitToDeliveryRoom(id, 'delivery:status', {
    deliveryId: id,
    status: 'IN_TRANSIT',
    startedAt: now.toISOString(),
  })

  res.json({
    delivery: { id, status: 'IN_TRANSIT', startedAt: now },
    donation: { id: donation.id, status: 'PICKED_UP' },
    assignment: { id: assignment.id, status: 'IN_TRANSIT' },
  })
}

/**
 * Phase 25, Step 66 — POST /api/v1/deliveries/:id/location.
 *
 * The volunteer's browser reports GPS data during an active delivery run.
 * Each sample is stored in the `delivery_locations` table so the donor and
 * NGO can track the delivery in real time (and the distance is logged for
 * analytics).
 *
 * Only the assigned volunteer for a delivery whose status is IN_TRANSIT
 * may submit locations.
 */
export async function submitLocation(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const id = req.params.id as string
  const body = req.body as SubmitLocationBody

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      assignment: {
        include: {
          volunteer: { select: { userId: true } },
        },
      },
    },
  })

  if (!delivery) {
    throw new HttpError(404, 'NOT_FOUND', 'Delivery not found')
  }

  if (delivery.assignment.volunteer.userId !== user.userId) {
    throw new HttpError(403, 'FORBIDDEN', 'Only the assigned volunteer can submit location data')
  }

  if (delivery.status !== 'IN_TRANSIT') {
    throw new HttpError(409, 'INVALID_TRANSITION', 'Location tracking is only active while the delivery is in transit')
  }

  const record = await prisma.deliveryLocation.create({
    data: {
      deliveryId: id,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy ?? null,
      speed: body.speed ?? null,
      heading: body.heading ?? null,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
    },
  })

  // Broadcast the location to the donor + NGO watching the delivery.
  const assignment = await prisma.volunteerAssignment.findUnique({
    where: { id: delivery.assignmentId },
    include: {
      volunteer: { include: { user: { select: { fullName: true } } } },
      donation: {
        include: {
          donor: { select: { userId: true } },
          requests: {
            where: { status: 'ACCEPTED' },
            take: 1,
            include: { ngo: { select: { userId: true, ngoName: true, latitude: true, longitude: true } } },
          },
        },
      },
    },
  })

  const watchers: string[] = []
  if (assignment?.donation.donor.userId) watchers.push(assignment.donation.donor.userId)
  if (assignment?.donation.requests[0]?.ngo.userId) watchers.push(assignment.donation.requests[0].ngo.userId)

  for (const watcherId of watchers) {
    emitToUser(watcherId, 'delivery:location', {
      deliveryId: id,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy ?? null,
      speed: body.speed ?? null,
      heading: body.heading ?? null,
      timestamp: record.timestamp.toISOString(),
    })
  }

  // Phase 29, Step 75 — once-only "Volunteer approaching" alert. Shared with
  // the Socket.IO GPS path (deliveryService.maybeNotifyApproaching), so the
  // volunteer's live position is treated identically on either channel.
  if (assignment) {
    await maybeNotifyApproaching(
      {
        id: delivery.id,
        approachingNotifiedAt: delivery.approachingNotifiedAt,
        dropLatitude: delivery.dropLatitude,
        dropLongitude: delivery.dropLongitude,
        dropLocation: delivery.dropLocation,
        assignment,
      },
      body.latitude,
      body.longitude,
    )
  }

  res.status(201).json({ location: record })
}

// ── Active-delivery shape returned by the tracking endpoint ───────────────

interface DeliveryTrackingItem {
  id: string
  status: string
  startedAt: string | null
  eta: string | null
  distance: number | null
  donation: {
    id: string
    foodName: string
    donorOrganization: string
    ngoName: string | null
  }
  pickup: { latitude: number; longitude: number } | null
  drop: { latitude: number; longitude: number } | null
  volunteerName: string | null
}

/**
 * Phase 28 — GET /api/v1/deliveries/tracking.
 *
 * Returns the authenticated user's active in-transit deliveries based on
 * their role:
 *   - VOLUNTEER → their current IN_TRANSIT assignment
 *   - DONOR     → their donations that are being delivered
 *   - NGO       → their accepted requests that are in transit
 */
export async function listActiveDeliveries(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const allStatuses: DeliveryStatus[] = ['VOLUNTEER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT']

  const deliveries = await prisma.delivery.findMany({
    where: {
      status: { in: allStatuses },
      assignment:
        user.role === 'VOLUNTEER'
          ? { volunteer: { userId: user.userId } }
          : user.role === 'DONOR'
            ? { donation: { donor: { userId: user.userId } } }
            : { donation: { requests: { some: { ngo: { userId: user.userId }, status: 'ACCEPTED' } } } },
    },
    include: {
      assignment: {
        include: {
          volunteer: { include: { user: { select: { fullName: true } } } },
          donation: {
            include: {
              donor: { select: { organizationName: true, latitude: true, longitude: true } },
              requests: {
                where: { status: 'ACCEPTED' },
                take: 1,
                include: { ngo: { select: { ngoName: true, latitude: true, longitude: true, address: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const items: DeliveryTrackingItem[] = deliveries.map((d) => {
    const { assignment } = d
    const { donation } = assignment
    const ngo = donation.requests[0]?.ngo

    return {
      id: d.id,
      status: d.status,
      startedAt: d.startedAt?.toISOString() ?? null,
      eta: d.eta?.toISOString() ?? null,
      distance: d.distance,
      donation: {
        id: donation.id,
        foodName: donation.foodName,
        donorOrganization: donation.donor.organizationName,
        ngoName: ngo?.ngoName ?? null,
      },
      pickup: {
        latitude: donation.latitude ?? donation.donor.latitude ?? 0,
        longitude: donation.longitude ?? donation.donor.longitude ?? 0,
      },
      drop: {
        // Rescue runs have no NGO — fall back to the distribution spot pin.
        latitude: ngo?.latitude ?? d.dropLatitude ?? 0,
        longitude: ngo?.longitude ?? d.dropLongitude ?? 0,
      },
      volunteerName: assignment.volunteer?.user.fullName ?? null,
    }
  })

  res.json({ deliveries: items })
}

/**
 * Phase 29, Step 75 — POST /api/v1/deliveries/:id/complete.
 *
 * The volunteer confirms the food reached the NGO. In one transaction:
 *   - Delivery   → DELIVERED (with completedAt)
 *   - Donation   → DELIVERED
 *   - Assignment → DELIVERED (with deliveryTime)
 *   - Volunteer  → AVAILABLE again, totalDeliveries +1
 *
 * Precondition: the delivery must be exactly IN_TRANSIT. The atomic
 * `updateMany` with a status filter prevents double-completion races.
 * "Delivery completed" notifications go to the donor + NGO.
 */
export async function completeDelivery(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const id = req.params.id as string

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      assignment: {
        include: {
          volunteer: { include: { user: { select: { id: true, fullName: true } } } },
          donation: {
            include: {
              donor: { select: { userId: true, organizationName: true } },
              requests: {
                where: { status: 'ACCEPTED' },
                take: 1,
                include: { ngo: { select: { userId: true, ngoName: true } } },
              },
            },
          },
        },
      },
    },
  })

  if (!delivery) {
    throw new HttpError(404, 'NOT_FOUND', 'Delivery not found')
  }

  if (delivery.assignment.volunteer.userId !== user.userId) {
    throw new HttpError(403, 'FORBIDDEN', 'This delivery is assigned to another volunteer')
  }

  if (delivery.status !== 'IN_TRANSIT') {
    throw new HttpError(
      409,
      'INVALID_TRANSITION',
      `Cannot complete delivery from status ${delivery.status} — only IN_TRANSIT is allowed`,
    )
  }

  const { assignment } = delivery
  const { donation } = assignment
  const ngo = donation.requests[0]?.ngo
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    const completed = await tx.delivery.updateMany({
      where: { id, status: 'IN_TRANSIT' },
      data: { status: 'DELIVERED', completedAt: now },
    })

    if (completed.count !== 1) {
      throw new HttpError(409, 'INVALID_TRANSITION', 'Delivery has already been completed')
    }

    await tx.donation.update({ where: { id: donation.id }, data: { status: 'DELIVERED' } })
    await tx.volunteerAssignment.update({
      where: { id: assignment.id },
      data: { status: 'DELIVERED', deliveryTime: now },
    })
    await tx.volunteer.update({
      where: { id: assignment.volunteerId },
      data: { availability: 'AVAILABLE', totalDeliveries: { increment: 1 } },
    })
    await tx.auditLog.create({
      data: { userId: user.userId, action: 'delivery.completed', entity: 'delivery', entityId: id },
    })
  })

  // Phase 29, Step 75 — "Delivery completed" in-app notification.
  const recipients: string[] = [donation.donor.userId]
  if (ngo?.userId) recipients.push(ngo.userId)
  await notifyUsers(recipients, {
    title: `Delivery completed: ${donation.foodName}`,
    message:
      `${assignment.volunteer.user.fullName} delivered ${donation.foodName} to ` +
      `${ngo?.ngoName ?? delivery.dropLocation}. Thank you for saving food!`,
    type: NOTIFICATION_TYPES.DELIVERY_COMPLETED,
    donationId: donation.id,
  })
  await notifyUsers([user.userId], {
    title: `Delivery completed: ${donation.foodName}`,
    message: `You delivered ${donation.foodName} to ${ngo?.ngoName ?? delivery.dropLocation}. Great job saving food!`,
    type: NOTIFICATION_TYPES.DELIVERY_COMPLETED,
    donationId: donation.id,
  })

  // Realtime: broadcast the terminal status flip to the delivery room so
  // donor + NGO maps move to "Delivered" immediately.
  emitToDeliveryRoom(id, 'delivery:status', {
    deliveryId: id,
    status: 'DELIVERED',
    completedAt: now.toISOString(),
  })

  res.json({
    delivery: { id, status: 'DELIVERED', completedAt: now },
    donation: { id: donation.id, status: 'DELIVERED' },
    assignment: { id: assignment.id, status: 'DELIVERED' },
  })
}