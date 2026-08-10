import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { notifyUsers, NOTIFICATION_TYPES } from '../services/notificationService.js'

/**
 * Phase 37, Step 94 — in-app reminder job.
 *
 * Three periodic passes, each firing at most once per donation thanks to the
 * dedicated dedupe flags added in the Phase 37 migration (the same convention
 * as `rescueNotifiedAt`):
 *
 *   1. Upcoming pickup  — pickupTime is within the next few hours. Reminds the
 *      donor, the accepting NGO, and the assigned volunteer (who does the
 *      pickup) when the food is RESERVED.
 *   2. Pending acceptance — an NGO request has been waiting on the donor for
 *      a while. Reminds the donor how many requests need a response.
 *   3. Food nearing expiry — the listing is still AVAILABLE and expires
 *      within the next few hours. A gentler heads-up that runs *before* the
 *      Phase 19 rescue sweep (3h window) escalates to volunteers.
 *
 * Every pass wraps its writes + notifications in one transaction per donation,
 * so a crash mid-sweep can never re-remind people on the next run.
 */

/** Remind about pickups that start within this window. */
const PICKUP_REMINDER_HOURS = 2
/** Consider a request "stale" once it has been pending this long. */
const REQUEST_REMINDER_HOURS = 3
/** Warn about food that expires within this window (before the rescue sweep). */
const NEARING_EXPIRY_HOURS = 6

export interface ReminderSummary {
  pickupReminders: number
  acceptanceReminders: number
  expiryReminders: number
  notificationsSent: number
}

/** "HH:MM" (24h) for reminder copy — locale-independent. */
function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Pass 1 — scheduled pickups happening soon. */
async function remindUpcomingPickups(now: Date): Promise<{ reminders: number; notificationsSent: number }> {
  const deadline = new Date(now.getTime() + PICKUP_REMINDER_HOURS * 3_600_000)

  const donations = await prisma.donation.findMany({
    where: {
      status: { in: ['AVAILABLE', 'RESERVED'] },
      pickupTime: { gte: now, lte: deadline },
      pickupReminderSentAt: null,
    },
    include: {
      donor: { select: { userId: true, organizationName: true } },
      requests: {
        where: { status: 'ACCEPTED' },
        take: 1,
        include: { ngo: { select: { userId: true, ngoName: true } } },
      },
      // The volunteer who accepted the delivery is the one doing the pickup.
      assignments: {
        where: { status: 'ACCEPTED' },
        take: 1,
        include: { volunteer: { select: { userId: true } } },
      },
    },
  })

  let reminders = 0
  let notificationsSent = 0
  for (const donation of donations) {
    if (!donation.pickupTime) continue
    const ngo = donation.requests[0]?.ngo
    const volunteerUserId = donation.assignments[0]?.volunteer?.userId
    const at = formatTime(donation.pickupTime)
    const food = `${donation.foodName} (${donation.quantity} ${donation.unit})`

    const sent = await prisma.$transaction(async (tx) => {
      let count = 0
      count += await notifyUsers(
        [donation.donor.userId],
        {
          title: 'Pickup coming up',
          message: ngo
            ? `${food} is scheduled for pickup at ${at} by ${ngo.ngoName}. Make sure it is ready.`
            : `${food} is scheduled for pickup at ${at}. Make sure it is ready.`,
          type: NOTIFICATION_TYPES.PICKUP_STARTED,
          donationId: donation.id,
        },
        tx,
      )
      if (ngo) {
        count += await notifyUsers(
          [ngo.userId],
          {
            title: 'Pickup coming up',
            message: `${food} from ${donation.donor.organizationName} is ready for pickup at ${at}.`,
            type: NOTIFICATION_TYPES.PICKUP_STARTED,
            donationId: donation.id,
          },
          tx,
        )
      }
      if (volunteerUserId) {
        count += await notifyUsers(
          [volunteerUserId],
          {
            title: 'Pickup coming up',
            message: `Pickup of ${food} from ${donation.donor.organizationName} is scheduled for ${at}. Please be on time.`,
            type: NOTIFICATION_TYPES.PICKUP_STARTED,
            donationId: donation.id,
          },
          tx,
        )
      }
      await tx.donation.update({ where: { id: donation.id }, data: { pickupReminderSentAt: now } })
      return count
    })

    reminders += 1
    notificationsSent += sent
  }

  return { reminders, notificationsSent }
}

/** Pass 2 — NGO requests still waiting for the donor to respond. */
async function remindPendingAcceptance(now: Date): Promise<{ reminders: number; notificationsSent: number }> {
  const cutoff = new Date(now.getTime() - REQUEST_REMINDER_HOURS * 3_600_000)

  const donations = await prisma.donation.findMany({
    where: {
      status: 'AVAILABLE',
      requestReminderSentAt: null,
      requests: { some: { status: 'PENDING', requestedAt: { lte: cutoff } } },
    },
    include: {
      donor: { select: { userId: true } },
      _count: { select: { requests: { where: { status: 'PENDING' } } } },
    },
  })

  let reminders = 0
  let notificationsSent = 0
  for (const donation of donations) {
    const pending = donation._count.requests
    if (pending === 0) continue
    const noun = pending === 1 ? '1 NGO is waiting' : `${pending} NGOs are waiting`

    const sent = await prisma.$transaction(async (tx) => {
      const count = await notifyUsers(
        [donation.donor.userId],
        {
          title: 'NGO request awaiting your response',
          message: `${noun} to accept ${donation.foodName} (${donation.quantity} ${donation.unit}). Respond before the food expires.`,
          type: NOTIFICATION_TYPES.DONATION_ACCEPTED,
          donationId: donation.id,
        },
        tx,
      )
      await tx.donation.update({ where: { id: donation.id }, data: { requestReminderSentAt: now } })
      return count
    })

    reminders += 1
    notificationsSent += sent
  }

  return { reminders, notificationsSent }
}

/** Pass 3 — food that will expire soon and is still unclaimed. */
async function remindNearingExpiry(now: Date): Promise<{ reminders: number; notificationsSent: number }> {
  const deadline = new Date(now.getTime() + NEARING_EXPIRY_HOURS * 3_600_000)

  const pickupDeadline = new Date(now.getTime() + PICKUP_REMINDER_HOURS * 3_600_000)

  const donations = await prisma.donation.findMany({
    where: {
      status: 'AVAILABLE',
      expiryTime: { gte: now, lte: deadline },
      expiryReminderSentAt: null,
      // Skip food whose pickup is already imminent — the pickup pass (pass 1)
      // covers it, so the donor gets one focused reminder, not two at once.
      pickupTime: { not: { gte: now, lte: pickupDeadline } },
      // The rescue sweep (Phase 19) already escalated this one to volunteers —
      // no point sending the gentler heads-up too.
      rescueNotifiedAt: null,
    },
    include: { donor: { select: { userId: true } } },
  })

  let reminders = 0
  let notificationsSent = 0
  for (const donation of donations) {
    if (!donation.expiryTime) continue
    const hoursLeft = Math.max(1, Math.round((donation.expiryTime.getTime() - now.getTime()) / 3_600_000))

    const sent = await prisma.$transaction(async (tx) => {
      const count = await notifyUsers(
        [donation.donor.userId],
        {
          title: 'Food nearing expiry',
          message:
            `Your ${donation.foodName} (${donation.quantity} ${donation.unit}) expires in ~${hoursLeft}h. ` +
            `If no NGO claims it, arrange pickup or delivery directly.`,
          type: NOTIFICATION_TYPES.FOOD_EXPIRING,
          donationId: donation.id,
        },
        tx,
      )
      await tx.donation.update({ where: { id: donation.id }, data: { expiryReminderSentAt: now } })
      return count
    })

    reminders += 1
    notificationsSent += sent
  }

  return { reminders, notificationsSent }
}

/** Runs one full reminder sweep — all three passes. */
export async function runRemindersNow(): Promise<ReminderSummary> {
  const now = new Date()
  const [pickup, acceptance, expiry] = await Promise.all([
    remindUpcomingPickups(now),
    remindPendingAcceptance(now),
    remindNearingExpiry(now),
  ])

  return {
    pickupReminders: pickup.reminders,
    acceptanceReminders: acceptance.reminders,
    expiryReminders: expiry.reminders,
    notificationsSent: pickup.notificationsSent + acceptance.notificationsSent + expiry.notificationsSent,
  }
}

let timer: NodeJS.Timeout | null = null

async function sweep(): Promise<void> {
  try {
    const summary = await runRemindersNow()
    const total = summary.pickupReminders + summary.acceptanceReminders + summary.expiryReminders
    if (total > 0) {
      console.log(
        `[reminders] ${summary.pickupReminders} pickup · ${summary.acceptanceReminders} acceptance · ${summary.expiryReminders} expiry · ${summary.notificationsSent} notifications`,
      )
    }
  } catch (err) {
    console.error('[reminders] sweep failed:', err)
  }
}

/**
 * Phase 37, Step 94 — starts the periodic reminder sweep (every
 * `REMINDER_JOB_INTERVAL_MS`). Runs one sweep immediately on boot. Skipped in
 * test so unit tests never fire database writes or notifications.
 */
export function startReminderJob(): void {
  if (env.NODE_ENV === 'test' || timer) return

  void sweep()
  timer = setInterval(() => void sweep(), env.REMINDER_JOB_INTERVAL_MS)
  timer.unref()
}
