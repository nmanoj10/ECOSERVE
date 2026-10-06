import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { haversineKm } from '../utils/geo.js'
import { notifyUsers, NOTIFICATION_TYPES } from './notificationService.js'
import { findNearbyTransitPoints, type TransitPoint } from './transitService.js'
import { RESCUE_PRIORITY_RANK, rescuePriority, type RescuePriorityLevel } from './rescuePriority.js'

export interface RescueSummary {
  /** Donations in the rescue window that were scanned. */
  scanned: number
  /** Donations that got a rescue alert (and were marked notified). */
  rescued: number
  /** Notification rows created. */
  notificationsSent: number
}

/** Sweeps also catch food that expired up to this long ago (delayed job). */
const EXPIRY_GRACE_MINUTES = env.EXPIRY_GRACE_MINUTES

interface RescueRecipient {
  userId: string
  /** The donor who listed the food — gets a personalized alert. */
  isOwner: boolean
  /** Approximate distance for the volunteer copy, e.g. "~4 km". Null for the owner / unknown. */
  distanceLabel?: string | null
}

type RescueDonationRow = {
  id: string
  foodName: string
  quantity: number
  unit: string
  expiryTime: Date | null
  latitude: number | null
  longitude: number | null
  pickupAddress: string
  rescuePriorityLevel: string | null
  donor: {
    userId: string
    organizationName: string
    city: string | null
    latitude: number | null
    longitude: number | null
    user: { locationAlertsEnabled: boolean } | null | undefined
  }
}

/**
 * Emergency Food Redistribution sweep (Phase 19, spec §1–§6).
 *
 * Finds unclaimed (AVAILABLE) donations that are inside the expiry window and
 * alerts everyone who can act:
 *   - the **original donor** (so they can hand the food out directly) — always,
 *   - **AVAILABLE volunteers within `VOLUNTEER_RADIUS_KM`** of the food.
 *
 * Expiry-based priority (§6): each donation is graded NORMAL / INCREASED /
 * URGENT / EMERGENCY from how long it has until expiry (env-tuned tiers). A
 * donation is alerted each time its tier **rises** (`rescuePriorityLevel`),
 * so a listing first caught 5 h out is pinged again at 2 h and again at
 * 45 min — the copy ramps up with the urgency instead of alerting once.
 *
 * Privacy (§9): donors and volunteers who disabled location alerts
 * (`User.locationAlertsEnabled`) are never notified.
 */
export async function runRescueCheck(): Promise<RescueSummary> {
  const now = new Date()
  const grace = new Date(now.getTime() - EXPIRY_GRACE_MINUTES * 60_000)
  const deadline = new Date(now.getTime() + env.RESCUE_WINDOW_HOURS * 3_600_000)

  // Candidate donations: AVAILABLE, inside [grace, deadline], and not yet
  // alerted at the top (EMERGENCY) tier. Escalation below EMERGENCY is handled
  // per row in JS (compare stored tier vs. current tier).
  const donations = await prisma.donation.findMany({
    where: {
      status: 'AVAILABLE',
      expiryTime: { gte: grace, lte: deadline },
      OR: [{ rescuePriorityLevel: null }, { rescuePriorityLevel: { not: 'EMERGENCY' } }],
    },
    include: {
      donor: {
        select: {
          userId: true,
          organizationName: true,
          city: true,
          latitude: true,
          longitude: true,
          user: { select: { locationAlertsEnabled: true } },
        },
      },
    },
  })

  // 1) Decide who to alert — the owner unless they opted out, plus nearby
  //    volunteers. Donations whose tier hasn't risen since the last alert
  //    (or without an expiry) are skipped here.
  const actionable = await collectActionable(donations, now)

  // 2) Transit lookups in parallel (only where coordinates exist) — best
  //    effort, degrades to an empty list when Overpass is unreachable.
  const geoActionable = actionable.filter(
    (item): item is ActionableDonation & { dLat: number; dLng: number } => item.dLat != null && item.dLng != null,
  )
  const transitResults = await Promise.all(
    geoActionable.map((item) => findNearbyTransitPoints(item.dLat, item.dLng).catch(() => [] as TransitPoint[])),
  )
  const transitByDonation = new Map(geoActionable.map((item, i) => [item.donation.id, transitResults[i] ?? []]))

  const summary = await notifyActionable(actionable, transitByDonation, now)
  return { scanned: donations.length, ...summary }
}

interface ActionableDonation {
  donation: RescueDonationRow
  dLat: number | null
  dLng: number | null
  countdown: string
  priority: ReturnType<typeof rescuePriority>
  recipients: RescueRecipient[]
}

async function collectActionable(donations: RescueDonationRow[], now: Date): Promise<ActionableDonation[]> {
  const actionable: ActionableDonation[] = []

  for (const donation of donations) {
    const expiryTime = donation.expiryTime
    if (!expiryTime) continue

    const hoursLeft = Math.max(0, (expiryTime.getTime() - now.getTime()) / 3_600_000)
    const priority = rescuePriority(hoursLeft)

    // Escalation only — never re-alert at the same or a lower tier.
    const storedLevel = donation.rescuePriorityLevel as RescuePriorityLevel | null
    const storedRank = storedLevel ? (RESCUE_PRIORITY_RANK[storedLevel] ?? -1) : -1
    if (RESCUE_PRIORITY_RANK[priority.level] <= storedRank) continue

    const ownerOptedOut = donation.donor.user?.locationAlertsEnabled === false
    const dLat = donation.latitude ?? donation.donor.latitude
    const dLng = donation.longitude ?? donation.donor.longitude

    const recipients =
      dLat != null && dLng != null
        ? await findRescueRecipients(dLat, dLng, donation.donor.userId, ownerOptedOut)
        : ownerOptedOut
          ? []
          : [{ userId: donation.donor.userId, isOwner: true } as RescueRecipient]

    if (recipients.length === 0) continue

    actionable.push({
      donation,
      dLat,
      dLng,
      countdown: countdownLabel(expiryTime, now),
      priority,
      recipients,
    })
  }

  return actionable
}

/**
 * Who gets alerted — the owner (unless opted out), plus AVAILABLE volunteers
 * within `VOLUNTEER_RADIUS_KM` of the food who haven't opted out. Volunteers
 * without a live location pin can't be distance-checked and are never matched;
 * the radius is strict per spec §5 (no platform-wide fallback).
 */
async function findRescueRecipients(
  dLat: number,
  dLng: number,
  ownerId: string,
  ownerOptedOut: boolean,
): Promise<RescueRecipient[]> {
  const volunteers = await prisma.volunteer.findMany({
    where: { availability: 'AVAILABLE' },
    select: {
      userId: true,
      currentLatitude: true,
      currentLongitude: true,
      user: { select: { locationAlertsEnabled: true } },
    },
  })

  const withinRadius = volunteers
    .filter((v) => v.user?.locationAlertsEnabled !== false)
    .map((v) => {
      const distance =
        v.currentLatitude != null && v.currentLongitude != null
          ? haversineKm(dLat, dLng, v.currentLatitude, v.currentLongitude)
          : null
      return { userId: v.userId, distance }
    })
    .filter((v) => v.distance != null && v.distance <= env.VOLUNTEER_RADIUS_KM)

  const recipients: RescueRecipient[] = []
  const seen = new Set<string>()

  if (!ownerOptedOut) {
    seen.add(ownerId)
    recipients.push({ userId: ownerId, isOwner: true })
  }
  for (const volunteer of withinRadius) {
    if (seen.has(volunteer.userId)) continue
    seen.add(volunteer.userId)
    recipients.push({
      userId: volunteer.userId,
      isOwner: false,
      distanceLabel: `~${Math.max(1, Math.round(volunteer.distance!))} km`,
    })
  }

  return recipients
}

interface NotifyResult {
  rescued: number
  notificationsSent: number
}

async function notifyActionable(
  actionable: ActionableDonation[],
  transitByDonation: Map<string, TransitPoint[]>,
  now: Date,
): Promise<NotifyResult> {
  let rescued = 0
  let notificationsSent = 0

  for (const { donation, dLat, dLng, countdown, priority, recipients } of actionable) {
    const transit = transitByDonation.get(donation.id) ?? []

    // Each spot is clickable (the frontend linkifies every https:// token) and
    // carries its own distance + travel-time budget. Top 3 stay named so the
    // alert remains scannable; the rest are summarized.
    const spotText = (t: TransitPoint) =>
      `${t.name} (${t.label}, ${t.distanceKm} km${t.travelTimeMinutes != null ? `, ~${t.travelTimeMinutes} min` : ''}${
        t.address ? `, ${t.address}` : ''
      }) — Map: https://maps.google.com/?q=${t.latitude.toFixed(5)},${t.longitude.toFixed(5)}`
    const spots =
      dLat != null && dLng != null
        ? transit.length
          ? transit.slice(0, 3).map(spotText).join(' | ') +
            (transit.length > 3 ? ` | and ${transit.length - 3} more spots` : '')
          : `near the donation (${dLat.toFixed(4)}, ${dLng.toFixed(4)})`
        : null
    const mapsLink = dLat != null && dLng != null ? `https://maps.google.com/?q=${dLat.toFixed(5)},${dLng.toFixed(5)}` : null

    const tierSuffix = priority.level === 'NORMAL' ? '' : ` (${priority.label})`
    const ownerTitle = `${priority.emoji} Your ${donation.foodName} needs rescue${tierSuffix}`
    const rescuerTitle = `${priority.emoji} Food rescue: ${donation.foodName} expiring${tierSuffix}`

    const ownerMessage = spots
      ? `Your ${donation.foodName} (${donation.quantity} ${donation.unit}) hasn't been accepted and expires in ${countdown}. ` +
        `We found ${transit.length > 0 ? `${transit.length} places` : 'a place'} where people in need often gather: ${spots}. ` +
        `You decide where the food goes — tap any spot to open it in Maps, or use the donation location: ${mapsLink}`
      : `Your ${donation.foodName} (${donation.quantity} ${donation.unit}) hasn't been accepted and expires in ${countdown}. ` +
        `Please arrange pickup or hand it out directly.`

    const rescuerMessage = (distanceLabel?: string | null) =>
      `${donation.foodName} (${donation.quantity} ${donation.unit}) from ${donation.donor.organizationName} ` +
      `at ${donation.pickupAddress} will expire in ${countdown} — ${priority.label} redistribution.` +
      `${distanceLabel ? ` It's ${distanceLabel} from you.` : ''} Rescue at: ${spots}. ` +
      `Location: ${mapsLink}. Tap “Accept rescue” for the map and directions.`

    // Owner + volunteers get different copy; volunteers are grouped by their
    // approximate distance so each message can say "~X km from you".
    const ownerIds = recipients.filter((r) => r.isOwner).map((r) => r.userId)
    const rescuerGroups = new Map<string, string[]>()
    for (const r of recipients) {
      if (r.isOwner) continue
      const key = r.distanceLabel ?? '~' // fallback label used when distance is unknown
      rescuerGroups.set(key, [...(rescuerGroups.get(key) ?? []), r.userId])
    }

    const sent = await prisma.$transaction(async (tx) => {
      let count = 0
      if (ownerIds.length > 0) {
        count += await notifyUsers(
          ownerIds,
          { title: ownerTitle, message: ownerMessage, type: NOTIFICATION_TYPES.FOOD_EXPIRING, donationId: donation.id },
          tx,
        )
      }
      for (const [label, ids] of rescuerGroups) {
        count += await notifyUsers(
          ids,
          {
            title: rescuerTitle,
            message: rescuerMessage(label === '~' ? null : label),
            type: NOTIFICATION_TYPES.FOOD_EXPIRING,
            donationId: donation.id,
          },
          tx,
        )
      }
      // Record the tier we alerted at so the next sweep only re-alerts on
      // escalation, and the once-only timestamp that other jobs can test.
      await tx.donation.update({
        where: { id: donation.id },
        data: { rescueNotifiedAt: now, rescuePriorityLevel: priority.level },
      })
      return count
    })

    rescued += 1
    notificationsSent += sent
  }

  return { rescued, notificationsSent }
}

/** "45 min left" / "~3h left" — countdown shown in rescue alert copy. */
function countdownLabel(expiry: Date, now: Date): string {
  const diffMs = expiry.getTime() - now.getTime()
  if (diffMs <= 0) return 'past expiry'
  const minutes = Math.ceil(diffMs / 60_000)
  if (minutes < 60) return `${minutes} min`
  return `~${Math.round(minutes / 60)}h`
}