import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { estimateCo2, foodKg } from '../utils/impact.js'
import { estimateMeals } from '../utils/meals.js'

/**
 * Phase 37, Step 95 — daily aggregated analytics job.
 *
 * Rolls the transactional tables up into one `Analytics` row per UTC day
 * (the table's `date` column is unique and must be normalized to midnight
 * UTC, which `startOfUtcDay` guarantees). Metrics follow the Phase 30/33
 * conventions exactly:
 *
 *   - donations   — listings created that day (any status)
 *   - foodSaved   — kg of food whose delivery completed that day
 *   - mealsServed — estimated meals from those completed deliveries
 *   - co2Saved    — CO₂e avoided from that food (kg)
 *   - deliveries  — deliveries completed that day
 *   - activeUsers — distinct users who acted that day (donors who listed,
 *                   volunteers who delivered, NGOs who accepted a request)
 *
 * Upserts are idempotent: the boot pass backfills history so the table is
 * populated even for long-running installs, and every tick recomputes a small
 * trailing window (yesterday + today) so today's row stays fresh as the day
 * accrues.
 */

/** Days of history written on boot. */
const BOOT_BACKFILL_DAYS = 90
/** Trailing window recomputed on every tick. */
const TICK_RECOMPUTE_DAYS = 2

const round1 = (n: number): number => Math.round(n * 10) / 10

/** Midnight UTC of the day containing `date` — the Analytics.date convention. */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

interface DayAccumulator {
  donations: number
  foodSavedKg: number
  mealsServed: number
  deliveries: number
  activeUserIds: Set<string>
}

/** Computes and upserts one row per day in the trailing `days` window. */
async function computeDayRange(days: number): Promise<number> {
  const now = new Date()
  const start = startOfUtcDay(new Date(now.getTime() - (days - 1) * 86_400_000))

  const [donations, deliveries, acceptedRequests] = await Promise.all([
    prisma.donation.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, donor: { select: { userId: true } } },
    }),
    prisma.delivery.findMany({
      where: { status: 'DELIVERED', completedAt: { gte: start } },
      select: {
        completedAt: true,
        assignment: {
          select: {
            volunteer: { select: { userId: true } },
            donation: { select: { quantity: true, unit: true } },
          },
        },
      },
    }),
    prisma.ngoRequest.findMany({
      where: { status: 'ACCEPTED', acceptedAt: { gte: start } },
      select: { acceptedAt: true, ngo: { select: { userId: true } } },
    }),
  ])

  const rows = new Map<string, DayAccumulator>()

  const rowFor = (date: Date): DayAccumulator => {
    const key = startOfUtcDay(date).toISOString()
    let row = rows.get(key)
    if (!row) {
      row = { donations: 0, foodSavedKg: 0, mealsServed: 0, deliveries: 0, activeUserIds: new Set() }
      rows.set(key, row)
    }
    return row
  }

  for (const donation of donations) {
    const row = rowFor(donation.createdAt)
    row.donations += 1
    row.activeUserIds.add(donation.donor.userId)
  }

  for (const delivery of deliveries) {
    if (!delivery.completedAt) continue
    const row = rowFor(delivery.completedAt)
    const { donation } = delivery.assignment
    row.deliveries += 1
    row.foodSavedKg += foodKg(donation.quantity, donation.unit)
    row.mealsServed += estimateMeals(donation.quantity, donation.unit)
    row.activeUserIds.add(delivery.assignment.volunteer.userId)
  }

  for (const request of acceptedRequests) {
    if (!request.acceptedAt) continue
    const row = rowFor(request.acceptedAt)
    row.activeUserIds.add(request.ngo.userId)
  }

  await Promise.all(
    [...rows.entries()].map(([dateKey, row]) => {
      const data = {
        donations: row.donations,
        foodSaved: round1(row.foodSavedKg),
        mealsServed: row.mealsServed,
        co2Saved: round1(estimateCo2(row.foodSavedKg)),
        deliveries: row.deliveries,
        activeUsers: row.activeUserIds.size,
      }
      return prisma.analytics.upsert({
        where: { date: new Date(dateKey) },
        update: data,
        create: { date: new Date(dateKey), ...data },
      })
    }),
  )

  return rows.size
}

export interface AnalyticsRunSummary {
  /** Trailing window size used for this run. */
  days: number
  /** Number of daily rows upserted. */
  upserts: number
}

/** Runs one aggregation pass over the trailing `days` window (default 2). */
export async function runAnalyticsNow(days = TICK_RECOMPUTE_DAYS): Promise<AnalyticsRunSummary> {
  const upserts = await computeDayRange(days)
  return { days, upserts }
}

let timer: NodeJS.Timeout | null = null

async function tick(days: number): Promise<void> {
  try {
    const summary = await runAnalyticsNow(days)
    console.log(`[analytics] aggregated last ${summary.days} day(s) · ${summary.upserts} daily rows upserted`)
  } catch (err) {
    console.error('[analytics] sweep failed:', err)
  }
}

/**
 * Phase 37, Step 95 — starts the daily analytics job. Backfills the last
 * `BOOT_BACKFILL_DAYS` on boot, then recomputes a trailing window every
 * `ANALYTICS_JOB_INTERVAL_MS`. Skipped in test so unit tests never write.
 */
export function startAnalyticsJob(): void {
  if (env.NODE_ENV === 'test' || timer) return

  void tick(BOOT_BACKFILL_DAYS)
  timer = setInterval(() => void tick(TICK_RECOMPUTE_DAYS), env.ANALYTICS_JOB_INTERVAL_MS)
  timer.unref()
}
