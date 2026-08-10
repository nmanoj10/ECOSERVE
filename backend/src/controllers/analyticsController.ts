import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { estimateCo2, foodKg } from '../utils/impact.js'
import { estimateMeals } from '../utils/meals.js'
import { HttpError } from '../utils/HttpError.js'

/** How many months the time-series charts cover. */
const MONTHS = 6

const round1 = (n: number): number => Math.round(n * 10) / 10

/** "YYYY-MM" label for a date, in local time. */
function monthLabel(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Zero-filled "YYYY-MM" labels for the last `count` months, oldest first. */
function monthBuckets(count: number, now = new Date()): string[] {
  const start = new Date(now.getFullYear(), now.getMonth() - (count - 1), 1)
  return Array.from({ length: count }, (_, i) => monthLabel(new Date(start.getFullYear(), start.getMonth() + i, 1)))
}

/**
 * Phase 30, Step 77 — GET /api/v1/analytics/donor.
 *
 * A donor's impact over time, computed live from the transactional tables:
 *   - summary: total donations, food saved (kg), people served, CO₂ impact
 *   - byMonth: donations listed + food saved per month (last 6 months)
 *   - byCategory: listings + food saved per food category
 *
 * "Saved" = the donation reached DELIVERED (food actually rescued).
 * byCategory.listed counts every listing in that category (any status), so it
 * can exceed the number of saved (DELIVERED) donations — see `kg` for saved weight.
 */
export async function donorAnalytics(req: Request, res: Response): Promise<void> {
  const user = req.user!
  if (user.role !== 'DONOR') {
    throw new HttpError(403, 'FORBIDDEN', 'Only donor accounts can view donor analytics')
  }

  const donor = await prisma.donor.findUnique({ where: { userId: user.userId } })

  const buckets = monthBuckets(MONTHS)
  const empty = {
    summary: { totalDonations: 0, foodSavedKg: 0, peopleServed: 0, co2Kg: 0 },
    byMonth: buckets.map((month) => ({ month, donations: 0, kg: 0 })),
    byCategory: [],
  }

  if (!donor) {
    res.json(empty)
    return
  }

  const donations = await prisma.donation.findMany({
    where: { donorId: donor.id },
    select: {
      createdAt: true,
      quantity: true,
      unit: true,
      status: true,
      category: { select: { name: true } },
    },
  })

  const byMonth = new Map(buckets.map((month) => [month, { month, donations: 0, kg: 0 }]))
  const byCategory = new Map<string, { category: string; listed: number; kg: number }>()

  let totalDonations = 0
  let foodSavedKg = 0
  let peopleServed = 0

  for (const donation of donations) {
    totalDonations += 1
    const isSaved = donation.status === 'DELIVERED'
    const kg = isSaved ? foodKg(donation.quantity, donation.unit) : 0

    const month = monthLabel(donation.createdAt)
    const bucket = byMonth.get(month)
    if (bucket) {
      bucket.donations += 1
      bucket.kg += kg
    }

    const category = donation.category.name
    const entry = byCategory.get(category) ?? { category, listed: 0, kg: 0 }
    entry.listed += 1
    entry.kg += kg
    byCategory.set(category, entry)

    if (isSaved) {
      foodSavedKg += kg
      peopleServed += estimateMeals(donation.quantity, donation.unit)
    }
  }

  res.json({
    summary: {
      totalDonations,
      foodSavedKg: round1(foodSavedKg),
      peopleServed,
      co2Kg: round1(estimateCo2(foodSavedKg)),
    },
    byMonth: buckets.map((month) => byMonth.get(month)!),
    byCategory: [...byCategory.values()].sort((a, b) => b.kg - a.kg || b.listed - a.listed),
  })
}

/**
 * Phase 30, Step 78 — GET /api/v1/analytics/ngo.
 *
 * An NGO's redistribution impact, computed live from its accepted requests:
 *   - summary: food received (kg), food distributed (kg), people served,
 *     delivery success rate (% of accepted donations actually delivered)
 *   - byMonth: kg received + distributed per month (last 6 months)
 */
export async function ngoAnalytics(req: Request, res: Response): Promise<void> {
  const user = req.user!
  if (user.role !== 'NGO') {
    throw new HttpError(403, 'FORBIDDEN', 'Only NGO accounts can view NGO analytics')
  }

  const ngo = await prisma.ngo.findUnique({ where: { userId: user.userId } })

  const buckets = monthBuckets(MONTHS)
  const empty = {
    summary: { foodReceivedKg: 0, foodDistributedKg: 0, peopleServed: 0, deliverySuccessRate: 0 },
    byMonth: buckets.map((month) => ({ month, receivedKg: 0, distributedKg: 0 })),
  }

  if (!ngo) {
    res.json(empty)
    return
  }

  const requests = await prisma.ngoRequest.findMany({
    where: { ngoId: ngo.id, status: 'ACCEPTED' },
    select: {
      requestedAt: true,
      donation: { select: { quantity: true, unit: true, status: true } },
    },
  })

  const byMonth = new Map(buckets.map((month) => [month, { month, receivedKg: 0, distributedKg: 0 }]))

  let foodReceivedKg = 0
  let foodDistributedKg = 0
  let peopleServed = 0
  let deliveredCount = 0

  for (const request of requests) {
    const kg = foodKg(request.donation.quantity, request.donation.unit)
    foodReceivedKg += kg

    const month = monthLabel(request.requestedAt)
    const bucket = byMonth.get(month)
    if (bucket) bucket.receivedKg += kg

    if (request.donation.status === 'DELIVERED') {
      foodDistributedKg += kg
      deliveredCount += 1
      peopleServed += estimateMeals(request.donation.quantity, request.donation.unit)
      if (bucket) bucket.distributedKg += kg
    }
  }

  res.json({
    summary: {
      foodReceivedKg: round1(foodReceivedKg),
      foodDistributedKg: round1(foodDistributedKg),
      peopleServed,
      deliverySuccessRate: requests.length > 0 ? Math.round((deliveredCount / requests.length) * 100) : 0,
    },
    byMonth: buckets.map((month) => byMonth.get(month)!),
  })
}

/**
 * Phase 30, Step 79 — GET /api/v1/analytics/volunteer.
 *
 * A volunteer's delivery impact, computed live from their assignments:
 *   - summary: deliveries, distance (km), meals delivered, rating, completion rate
 *   - byMonth: completed deliveries + distance per month (last 6 months)
 *
 * "Completion rate" = delivered runs ÷ attempted runs (all assignments that
 * weren't cancelled). Distance and meals only count completed runs.
 */
export async function volunteerAnalytics(req: Request, res: Response): Promise<void> {
  const user = req.user!
  if (user.role !== 'VOLUNTEER') {
    throw new HttpError(403, 'FORBIDDEN', 'Only volunteer accounts can view volunteer analytics')
  }

  const volunteer = await prisma.volunteer.findUnique({ where: { userId: user.userId } })

  const buckets = monthBuckets(MONTHS)
  const empty = {
    summary: { deliveries: 0, distanceKm: 0, mealsDelivered: 0, rating: 0, completionRate: 0 },
    byMonth: buckets.map((month) => ({ month, deliveries: 0, distanceKm: 0 })),
  }

  if (!volunteer) {
    res.json(empty)
    return
  }

  const assignments = await prisma.volunteerAssignment.findMany({
    where: { volunteerId: volunteer.id },
    select: {
      status: true,
      donation: { select: { quantity: true, unit: true } },
      delivery: { select: { distance: true, completedAt: true } },
    },
  })

  const byMonth = new Map(buckets.map((month) => [month, { month, deliveries: 0, distanceKm: 0 }]))

  let delivered = 0
  let attempted = 0
  let distanceKm = 0
  let mealsDelivered = 0

  for (const assignment of assignments) {
    if (assignment.status === 'CANCELLED') continue
    attempted += 1
    if (!assignment.delivery?.completedAt) continue

    delivered += 1
    distanceKm += assignment.delivery.distance ?? 0
    mealsDelivered += estimateMeals(assignment.donation.quantity, assignment.donation.unit)

    const month = monthLabel(assignment.delivery.completedAt)
    const bucket = byMonth.get(month)
    if (bucket) {
      bucket.deliveries += 1
      bucket.distanceKm += assignment.delivery.distance ?? 0
    }
  }

  res.json({
    summary: {
      deliveries: delivered,
      distanceKm: round1(distanceKm),
      mealsDelivered,
      rating: volunteer.rating,
      completionRate: attempted > 0 ? Math.round((delivered / attempted) * 100) : 0,
    },
    byMonth: buckets.map((month) => {
      const bucket = byMonth.get(month)!
      return { month, deliveries: bucket.deliveries, distanceKm: round1(bucket.distanceKm) }
    }),
  })
}

/** Rounds a coordinate to a ~0.1° (~11 km) grid cell for the admin heatmap. */
function heatmapCell(latitude: number, longitude: number): { lat: number; lng: number } {
  return { lat: Math.round(latitude * 10) / 10, lng: Math.round(longitude * 10) / 10 }
}

/**
 * Phase 30, Step 80 — GET /api/v1/analytics/admin.
 *
 * Platform-wide impact for admins:
 *   - summary: total users, donations, NGOs, volunteers, food saved (kg), CO₂
 *   - byMonth: food saved per month (last 6 months) — the growth chart
 *   - heatmap: DELIVERED donation pickup points binned into ~0.1° cells
 *   - topNgos: NGOs ranked by redistributed food (kg + estimated meals)
 */
export async function adminAnalytics(req: Request, res: Response): Promise<void> {
  const user = req.user!
  if (user.role !== 'ADMIN') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admin accounts can view platform analytics')
  }

  const buckets = monthBuckets(MONTHS)

  const [totalUsers, totalDonations, totalNgos, totalVolunteers, deliveredDonations, deliveredRequests] =
    await Promise.all([
      prisma.user.count(),
      prisma.donation.count(),
      prisma.ngo.count(),
      prisma.volunteer.count(),
      prisma.donation.findMany({
        where: { status: 'DELIVERED' },
        select: {
          quantity: true,
          unit: true,
          createdAt: true,
          latitude: true,
          longitude: true,
          donor: { select: { latitude: true, longitude: true } },
        },
      }),
      prisma.ngoRequest.findMany({
        where: { status: 'ACCEPTED', donation: { status: 'DELIVERED' } },
        select: {
          ngo: { select: { ngoName: true, city: true } },
          donation: { select: { quantity: true, unit: true } },
        },
      }),
    ])

  const byMonth = new Map(buckets.map((month) => [month, { month, foodSavedKg: 0 }]))
  const heatmap = new Map<string, { lat: number; lng: number; count: number; kg: number }>()

  let foodSavedKg = 0

  for (const donation of deliveredDonations) {
    const kg = foodKg(donation.quantity, donation.unit)
    foodSavedKg += kg

    const month = monthLabel(donation.createdAt)
    const bucket = byMonth.get(month)
    if (bucket) bucket.foodSavedKg += kg

    // Pickup pin: the donation's own coordinates, falling back to the donor's.
    const latitude = donation.latitude ?? donation.donor.latitude
    const longitude = donation.longitude ?? donation.donor.longitude
    if (latitude != null && longitude != null) {
      const cell = heatmapCell(latitude, longitude)
      const key = `${cell.lat},${cell.lng}`
      const entry = heatmap.get(key) ?? { ...cell, count: 0, kg: 0 }
      entry.count += 1
      entry.kg += kg
      heatmap.set(key, entry)
    }
  }

  const byNgo = new Map<string, { name: string; city: string | null; kg: number; meals: number }>()
  for (const request of deliveredRequests) {
    const kg = foodKg(request.donation.quantity, request.donation.unit)
    const entry = byNgo.get(request.ngo.ngoName) ?? {
      name: request.ngo.ngoName,
      city: request.ngo.city,
      kg: 0,
      meals: 0,
    }
    entry.kg += kg
    entry.meals += estimateMeals(request.donation.quantity, request.donation.unit)
    byNgo.set(request.ngo.ngoName, entry)
  }

  res.json({
    summary: {
      totalUsers,
      totalDonations,
      totalNgos,
      totalVolunteers,
      foodSavedKg: round1(foodSavedKg),
      co2Kg: round1(estimateCo2(foodSavedKg)),
    },
    byMonth: buckets.map((month) => {
      const bucket = byMonth.get(month)!
      return { month, foodSavedKg: round1(bucket.foodSavedKg) }
    }),
    heatmap: [...heatmap.values()].sort((a, b) => b.count - a.count),
    topNgos: [...byNgo.values()]
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 5)
      .map((ngo) => ({ ...ngo, kg: round1(ngo.kg) })),
  })
}
