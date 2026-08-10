import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { notifyUsers, NOTIFICATION_TYPES } from '../services/notificationService.js'

export interface ExpirySummary {
  /** Donations whose expiryTime had passed and were scanned. */
  scanned: number
  /** Donations actually transitioned to EXPIRED. */
  expired: number
  /** Notification rows created. */
  notificationsSent: number
}

/**
 * Phase 37, Step 93 — the expired-donations sweep.
 *
 * Finds every AVAILABLE or RESERVED donation whose `expiryTime` is in the
 * past and transitions it to EXPIRED. Terminal statuses (DELIVERED, CANCELLED,
 * EXPIRED) are never touched; RESERVED donations are included because an NGO
 * accepted them but the food still went past its expiry before pickup.
 *
 * The sweep is naturally idempotent — once a donation leaves AVAILABLE/RESERVED
 * it can never match the query again — and the status flip + notifications
 * commit in one transaction per donation, so a crash can't leave food
 * marked expired without its owners being told.
 */
export async function runExpiryNow(): Promise<ExpirySummary> {
  const now = new Date()

  const donations = await prisma.donation.findMany({
    where: {
      status: { in: ['AVAILABLE', 'RESERVED'] },
      expiryTime: { lt: now },
    },
    include: {
      donor: { select: { userId: true, organizationName: true } },
      requests: {
        where: { status: 'ACCEPTED' },
        take: 1,
        include: { ngo: { select: { userId: true, ngoName: true } } },
      },
    },
  })

  let expired = 0
  let notificationsSent = 0

  for (const donation of donations) {
    const ngo = donation.requests[0]?.ngo
    const food = `${donation.foodName} (${donation.quantity} ${donation.unit})`

    const sent = await prisma.$transaction(async (tx) => {
      // Conditional flip — only expires donations that are still AVAILABLE/
      // RESERVED, so a sweep overlapping a boot run or manual trigger can
      // never transition the same row twice or double-notify.
      const { count } = await tx.donation.updateMany({
        where: { id: donation.id, status: { in: ['AVAILABLE', 'RESERVED'] } },
        data: { status: 'EXPIRED' },
      })
      if (count === 0) return 0

      let notifications = 0
      notifications += await notifyUsers(
        [donation.donor.userId],
        {
          title: 'Food listing expired',
          message: ngo
            ? `Your ${food} was accepted by ${ngo.ngoName} but expired before pickup, so it has been marked EXPIRED.`
            : `Your ${food} expired before anyone claimed it and has been marked EXPIRED.`,
          type: NOTIFICATION_TYPES.FOOD_EXPIRING,
          donationId: donation.id,
        },
        tx,
      )
      if (ngo) {
        notifications += await notifyUsers(
          [ngo.userId],
          {
            title: 'Food expired before pickup',
            message: `${food} from ${donation.donor.organizationName} expired before it could be picked up and has been marked EXPIRED.`,
            type: NOTIFICATION_TYPES.FOOD_EXPIRING,
            donationId: donation.id,
          },
          tx,
        )
      }
      return notifications
    })

    if (sent === 0) continue // another run already expired it
    expired += 1
    notificationsSent += sent
  }

  return { scanned: donations.length, expired, notificationsSent }
}

let timer: NodeJS.Timeout | null = null

async function sweep(): Promise<void> {
  try {
    const summary = await runExpiryNow()
    if (summary.expired > 0) {
      console.log(
        `[expiry] ${summary.expired}/${summary.scanned} donations expired · ${summary.notificationsSent} notifications sent`,
      )
    }
  } catch (err) {
    console.error('[expiry] sweep failed:', err)
  }
}

/**
 * Phase 37, Step 93 — starts the periodic expiry sweep (every
 * `EXPIRY_JOB_INTERVAL_MS`). Runs one sweep immediately on boot to catch
 * everything that expired while the server was down. Skipped in test so unit
 * tests never fire database writes or notifications.
 */
export function startExpiryJob(): void {
  if (env.NODE_ENV === 'test' || timer) return

  void sweep()
  timer = setInterval(() => void sweep(), env.EXPIRY_JOB_INTERVAL_MS)
  timer.unref()
}
