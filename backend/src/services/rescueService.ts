import { prisma } from '../config/prisma.js'
import { haversineKm } from '../utils/geo.js'
import { notifyUsers, NOTIFICATION_TYPES } from './notificationService.js'
import { findNearbyTransitPoints } from './transitService.js'

export interface RescueSummary {
  /** Donations in the rescue window that were scanned. */
  scanned: number
  /** Donations that got a rescue alert (and were marked notified). */
  rescued: number
  /** Notification rows created. */
  notificationsSent: number
}

/** Donations with less than this much shelf life left trigger the rescue flow. */
const RESCUE_WINDOW_HOURS = 3
/** Sweeps also catch food that expired up to 30 minutes ago (delayed job). */
const EXPIRY_GRACE_MINUTES = 30
const VOLUNTEER_RADIUS_KM = 15
/** Cap the no-nearby-volunteer fallback so it never becomes a platform-wide broadcast. */
const VOLUNTEER_FALLBACK_LIMIT = 20

interface RescueRecipient {
  userId: string
  /** The donor who listed the food — gets a personalized alert. */
  isOwner: boolean
}

interface ActionableDonation {
  donation: { id: string; foodName: string; quantity: number; unit: string; donor: { organizationName: string } }
  dLat: number | null
  dLng: number | null
  hoursLeft: number
  recipients: RescueRecipient[]
}

/**
 * Phase 19, Step 56 — the rescue sweep.
 *
 * Finds unclaimed (AVAILABLE) donations expiring within `RESCUE_WINDOW_HOURS`,
 * locates nearby railway stations / bus stands / shelters / worship places via
 * Overpass, and notifies everyone who can act:
 * - the **original owner** (so they can donate the food directly) — always,
 * - AVAILABLE volunteers around the food.
 * Each donation is alerted exactly once (`rescueNotifiedAt`), so restarts and
 * repeated sweeps never spam.
 */
export async function runRescueCheck(): Promise<RescueSummary> {
  const now = new Date()
  const grace = new Date(now.getTime() - EXPIRY_GRACE_MINUTES * 60_000)
  const deadline = new Date(now.getTime() + RESCUE_WINDOW_HOURS * 3_600_000)

  const donations = await prisma.donation.findMany({
    where: {
      status: 'AVAILABLE',
      expiryTime: { gte: grace, lte: deadline },
      rescueNotifiedAt: null,
    },
    include: {
      donor: { select: { userId: true, organizationName: true, latitude: true, longitude: true } },
    },
  })

  // 1) Decide who to alert. The owner is always notified (the listing's donor)
  //    even when the donation has no coordinates — only a missing expiry can
  //    take a donation out of the rescue window.
  const actionable: ActionableDonation[] = []

  for (const donation of donations) {
    const expiryTime = donation.expiryTime
    if (!expiryTime) continue

    const dLat = donation.latitude ?? donation.donor.latitude
    const dLng = donation.longitude ?? donation.donor.longitude
    const hoursLeft = Math.max(0, Math.round((expiryTime.getTime() - now.getTime()) / 3_600_000))

    const base = {
      donation: { id: donation.id, foodName: donation.foodName, quantity: donation.quantity, unit: donation.unit, donor: { organizationName: donation.donor.organizationName } },
      dLat,
      dLng,
      hoursLeft,
    }

    if (dLat == null || dLng == null) {
      // No location: only the owner can act, so notify just them (no spots).
      actionable.push({ ...base, recipients: [{ userId: donation.donor.userId, isOwner: true }] })
      continue
    }

    const recipients = await findRecipients(dLat, dLng, donation.donor.userId)
    if (recipients.length === 0) continue
    actionable.push({ ...base, recipients })
  }

  // 2) Transit lookups in parallel (only where coordinates exist) — each one
  //    is best-effort and degrades to the donation's own location.
  const geoActionable = actionable.filter(
    (item): item is typeof item & { dLat: number; dLng: number } => item.dLat != null && item.dLng != null,
  )
  const transitResults = await Promise.all(
    geoActionable.map((item) => findNearbyTransitPoints(item.dLat, item.dLng).catch(() => [])),
  )
  const transitByDonation = new Map(geoActionable.map((item, i) => [item.donation.id, transitResults[i] ?? []]))

  // 3) Notify.
  let rescued = 0
  let notificationsSent = 0

  for (const { donation, dLat, dLng, hoursLeft, recipients } of actionable) {
    const transit = transitByDonation.get(donation.id) ?? []
    const spots =
      dLat != null && dLng != null
        ? transit.length
          ? transit.map((t) => `${t.name} (${t.label}, ${t.distanceKm} km)`).join(', ')
          : `near the donation (${dLat.toFixed(4)}, ${dLng.toFixed(4)})`
        : null
    const mapsLink = dLat != null && dLng != null ? `https://maps.google.com/?q=${dLat.toFixed(5)},${dLng.toFixed(5)}` : null

    const ownerTitle = `🚨 Your ${donation.foodName} needs rescue`
    const rescuerTitle = `🚨 Food rescue: ${donation.foodName} expiring`
    const ownerMessage = spots
      ? `Your ${donation.foodName} (${donation.quantity} ${donation.unit}) expires in ~${hoursLeft}h and ` +
        `no NGO claimed it. You can hand it directly to people in need at: ${spots}. Location: ${mapsLink}`
      : `Your ${donation.foodName} (${donation.quantity} ${donation.unit}) expires in ~${hoursLeft}h and ` +
        `no NGO claimed it. Please arrange pickup or delivery directly.`
    const rescuerMessage =
      `${donation.foodName} (${donation.quantity} ${donation.unit}) from ${donation.donor.organizationName} ` +
      `expires in ~${hoursLeft}h and no NGO claimed it. Rescue at: ${spots}. Location: ${mapsLink}`

    // Phase 29, Step 75 — persist via the shared notification service. Owner
    // and volunteers get different copy, so two calls. All rows + the
    // `rescueNotifiedAt` flag commit in ONE transaction so a crash can never
    // leave partially-alerted donations that the next sweep would re-alert.
    const ownerIds = recipients.filter((r) => r.isOwner).map((r) => r.userId)
    const rescuerIds = recipients.filter((r) => !r.isOwner).map((r) => r.userId)

    const sent = await prisma.$transaction(async (tx) => {
      let count = 0
      if (ownerIds.length > 0) {
        count += await notifyUsers(
          ownerIds,
          { title: ownerTitle, message: ownerMessage, type: NOTIFICATION_TYPES.FOOD_EXPIRING, donationId: donation.id },
          tx,
        )
      }
      if (rescuerIds.length > 0) {
        count += await notifyUsers(
          rescuerIds,
          { title: rescuerTitle, message: rescuerMessage, type: NOTIFICATION_TYPES.FOOD_EXPIRING, donationId: donation.id },
          tx,
        )
      }
      await tx.donation.update({ where: { id: donation.id }, data: { rescueNotifiedAt: now } })
      return count
    })

    rescued += 1
    notificationsSent += sent
  }

  return { scanned: donations.length, rescued, notificationsSent }
}

/**
 * Who gets alerted — always the original owner, plus AVAILABLE volunteers near
 * the food (falling back to a capped list of all AVAILABLE ones so a rescue
 * never silently no-ops). Restaurants/businesses are intentionally excluded.
 */
async function findRecipients(dLat: number, dLng: number, ownerId: string): Promise<RescueRecipient[]> {
  const volunteers = await prisma.volunteer.findMany({
    where: { availability: 'AVAILABLE' },
    select: { userId: true, currentLatitude: true, currentLongitude: true },
  })

  const nearbyVolunteers = volunteers.filter(
    (volunteer) =>
      volunteer.currentLatitude != null &&
      volunteer.currentLongitude != null &&
      haversineKm(dLat, dLng, volunteer.currentLatitude, volunteer.currentLongitude) <= VOLUNTEER_RADIUS_KM,
  )
  const volunteerIds = (nearbyVolunteers.length > 0 ? nearbyVolunteers : volunteers)
    .slice(0, VOLUNTEER_FALLBACK_LIMIT)
    .map((volunteer) => volunteer.userId)

  const recipients: RescueRecipient[] = []
  const seen = new Set<string>()

  const add = (userId: string, isOwner: boolean) => {
    if (seen.has(userId)) {
      if (isOwner) {
        const existing = recipients.find((recipient) => recipient.userId === userId)
        if (existing) existing.isOwner = true
      }
      return
    }
    seen.add(userId)
    recipients.push({ userId, isOwner })
  }

  add(ownerId, true)
  for (const userId of volunteerIds) add(userId, false)

  return recipients
}
