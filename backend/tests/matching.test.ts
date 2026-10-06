/**
 * Phase 38, Step 96 — Matching unit tests.
 *
 * Covers the volunteer recommendation scoring (recommendationService) and the
 * rescue sweep (rescueService): who gets alerted, dedupe, and the
 * notified-once guarantee.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { recommendVolunteers, vehicleCapacityKg } from '../src/services/recommendationService.js'
import { runRescueCheck } from '../src/services/rescueService.js'
import { notifyUsers } from '../src/services/notificationService.js'
import { findNearbyTransitPoints } from '../src/services/transitService.js'

const prismaMock = vi.hoisted(() => ({
  volunteer: { findMany: vi.fn() },
  donation: { findMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

vi.mock('../src/services/notificationService.js', () => ({
  NOTIFICATION_TYPES: { FOOD_EXPIRING: 'RESCUE' },
  notifyUsers: vi.fn(),
}))

vi.mock('../src/services/transitService.js', () => ({
  findNearbyTransitPoints: vi.fn(),
}))

// The hoisted mock doubles as the assertion handle (keeps full vi.fn() types).
const mockedPrisma = prismaMock
const mockedNotify = vi.mocked(notifyUsers)
const mockedTransit = vi.mocked(findNearbyTransitPoints)

describe('vehicleCapacityKg', () => {
  it('maps known vehicle types to their capacity', () => {
    expect(vehicleCapacityKg('truck')).toBe(1000)
    expect(vehicleCapacityKg('Tata Van')).toBe(500)
    expect(vehicleCapacityKg('car')).toBe(120)
    expect(vehicleCapacityKg('auto rickshaw')).toBe(100)
    expect(vehicleCapacityKg('motorcycle')).toBe(30)
  })

  it('falls back to a small default for unknown or missing vehicles', () => {
    expect(vehicleCapacityKg(null)).toBe(10)
    expect(vehicleCapacityKg('on foot')).toBe(10)
  })
})

describe('recommendVolunteers', () => {
  const donation = {
    latitude: 12.95,
    longitude: 77.58,
    unit: 'kg',
    quantity: 100,
    donor: { latitude: null, longitude: null },
  }

  function volunteer(over: Record<string, unknown> = {}) {
    return {
      id: 'vol-1',
      userId: 'u-1',
      vehicleType: 'van',
      rating: 4.5,
      currentLatitude: 12.96,
      currentLongitude: 77.59,
      assignments: [],
      user: { fullName: 'Ravi' },
      ...over,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty list when there are no volunteers', async () => {
    mockedPrisma.volunteer.findMany.mockResolvedValue([] as never)
    await expect(recommendVolunteers(donation)).resolves.toEqual([])
  })

  it('excludes volunteers without a current location', async () => {
    mockedPrisma.volunteer.findMany.mockResolvedValue([
      volunteer({ userId: 'u-here', currentLatitude: 12.96, currentLongitude: 77.59 }),
      volunteer({ userId: 'u-lost', currentLatitude: null, currentLongitude: null }),
    ] as never)

    const result = await recommendVolunteers(donation)
    expect(result.map((r) => r.volunteerId)).toEqual(['u-here'])
  })

  it('returns an empty list when the donation has no coordinates at all', async () => {
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteer()] as never)
    const noCoords = { ...donation, latitude: null, longitude: null, donor: { latitude: null, longitude: null } }

    await expect(recommendVolunteers(noCoords)).resolves.toEqual([])
  })

  it('falls back to the donor profile coordinates for the pickup point', async () => {
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteer({ userId: 'u-1', currentLatitude: 20, currentLongitude: 78 })] as never)
    const donorCoords = { ...donation, latitude: null, longitude: null, donor: { latitude: 12.95, longitude: 77.58 } }

    const result = await recommendVolunteers(donorCoords)
    // ~780 km away — distance sub-score is 0, but the volunteer still ranks.
    expect(result[0]?.distanceKm).toBeGreaterThan(700)
  })

  it('excludes volunteers whose vehicle cannot carry the quantity', async () => {
    mockedPrisma.volunteer.findMany.mockResolvedValue([
      volunteer({ userId: 'u-big', vehicleType: 'truck' }),
      volunteer({ userId: 'u-small', vehicleType: 'bike' }),
    ] as never)

    const result = await recommendVolunteers(donation) // 100 kg
    expect(result.map((r) => r.volunteerId)).toEqual(['u-big'])
  })

  it('does not enforce capacity for non-kg units', async () => {
    mockedPrisma.volunteer.findMany.mockResolvedValue([
      volunteer({ userId: 'u-small', vehicleType: 'bike' }),
    ] as never)

    const plates = { ...donation, unit: 'plate', quantity: 500 }
    const result = await recommendVolunteers(plates)
    expect(result).toHaveLength(1)
  })

  it('sorts by descending score and exposes the breakdown', async () => {
    mockedPrisma.volunteer.findMany.mockResolvedValue([
      volunteer({
        userId: 'u-far',
        currentLatitude: 13.2,
        currentLongitude: 77.8,
        rating: 3,
        assignments: [{ id: 'a1' }, { id: 'a2' }],
      }),
      volunteer({ userId: 'u-close', currentLatitude: 12.9501, currentLongitude: 77.5801, rating: 5 }),
    ] as never)

    const result = await recommendVolunteers(donation)

    expect(result).toHaveLength(2)
    expect(result[0]!.volunteerId).toBe('u-close')
    expect(result[0]!.score).toBeGreaterThan(result[1]!.score)
    expect(result[0]!.breakdown).toMatchObject({
      distance: expect.any(Number),
      availability: 100,
      vehicle: expect.any(Number),
      workload: expect.any(Number),
      eta: expect.any(Number),
      rating: 100, // 5/5
    })
    expect(result[0]!.score).toBeGreaterThan(0)
    expect(result[0]!.score).toBeLessThanOrEqual(100)
  })

  it('computes a higher workload penalty for busier volunteers', async () => {
    mockedPrisma.volunteer.findMany.mockResolvedValue([
      volunteer({
        userId: 'u-idle',
        currentLatitude: 12.96,
        currentLongitude: 77.59,
        assignments: [],
      }),
      volunteer({
        userId: 'u-busy',
        currentLatitude: 12.96,
        currentLongitude: 77.59,
        assignments: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
      }),
    ] as never)

    const result = await recommendVolunteers(donation)
    const idle = result.find((r) => r.volunteerId === 'u-idle')!
    const busy = result.find((r) => r.volunteerId === 'u-busy')!
    expect(idle.breakdown.workload).toBeGreaterThan(busy.breakdown.workload)
    expect(idle.score).toBeGreaterThan(busy.score)
  })

  it('queries only AVAILABLE volunteers with their active assignments', async () => {
    mockedPrisma.volunteer.findMany.mockResolvedValue([] as never)
    await recommendVolunteers(donation)

    expect(mockedPrisma.volunteer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { availability: 'AVAILABLE' },
        include: expect.objectContaining({
          assignments: { where: { status: { in: ['PENDING', 'ACCEPTED', 'IN_TRANSIT'] } }, select: { id: true } },
        }),
      }),
    )
  })
})

describe('runRescueCheck', () => {
  const now = Date.now()

  function donationRow(over: Record<string, unknown> = {}) {
    return {
      id: 'don-1',
      foodName: 'Biryani',
      quantity: 10,
      unit: 'kg',
      status: 'AVAILABLE',
      expiryTime: new Date(now + 2 * 3_600_000), // 2h left — URGENT tier
      rescueNotifiedAt: null,
      rescuePriorityLevel: null,
      latitude: 12.95,
      longitude: 77.58,
      pickupAddress: 'Church Street, Bengaluru',
      donor: {
        userId: 'donor-1',
        organizationName: 'Spice House',
        city: 'Bengaluru',
        latitude: null,
        longitude: null,
        user: { locationAlertsEnabled: true },
      },
      ...over,
    }
  }

  function volunteerRow(over: Record<string, unknown> = {}) {
    return {
      userId: 'vol-1',
      currentLatitude: 12.96,
      currentLongitude: 77.59,
      user: { locationAlertsEnabled: true },
      ...over,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedNotify.mockResolvedValue(2)
    mockedTransit.mockResolvedValue([])
    mockedPrisma.$transaction.mockImplementation((cb: (tx: never) => Promise<unknown>) => {
      const tx = {
        donation: { update: vi.fn().mockResolvedValue({}) },
        notification: { create: vi.fn().mockResolvedValue({ id: 'n1' }) },
      }
      return cb(tx as never)
    })
  })

  it('scans nothing and alerts nobody when there are no eligible donations', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([] as never)

    await expect(runRescueCheck()).resolves.toEqual({ scanned: 0, rescued: 0, notificationsSent: 0 })
    expect(mockedNotify).not.toHaveBeenCalled()
  })

  it('alerts the owner and nearby volunteers, and marks the donation notified once', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([donationRow()] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow()] as never)

    const summary = await runRescueCheck()

    // notifyUsers is mocked to resolve 2 rows per call → 2 calls = 4 total.
    expect(summary).toEqual({ scanned: 1, rescued: 1, notificationsSent: 4 })

    // Owner call + rescuer call, both inside the same transaction client.
    expect(mockedNotify).toHaveBeenCalledTimes(2)
    const ownerCall = mockedNotify.mock.calls[0]!
    const rescuerCall = mockedNotify.mock.calls[1]!
    expect(ownerCall[0]).toEqual(['donor-1'])
    expect(ownerCall[1].title).toContain('needs rescue')
    expect(rescuerCall[0]).toEqual(['vol-1'])
    expect(rescuerCall[1].title).toContain('Food rescue')
    expect(ownerCall[2]).toBeDefined() // transaction client passed through
  })

  it('queries the rescue window and excludes donations already at the top tier', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([] as never)

    await runRescueCheck()

    const where = mockedPrisma.donation.findMany.mock.calls[0]?.[0]?.where
    expect(where).toMatchObject({ status: 'AVAILABLE' })
    expect(where.expiryTime.gte).toBeInstanceOf(Date) // 30-min grace into the past
    expect(where.expiryTime.lte).toBeInstanceOf(Date) // 6h ahead
    // Never re-alert EMERGENCY rows; everything else is escalated per-row in JS.
    expect(where.OR).toEqual([{ rescuePriorityLevel: null }, { rescuePriorityLevel: { not: 'EMERGENCY' } }])
  })

  it('notifies only the owner when the donation has no coordinates', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([
      donationRow({ latitude: null, longitude: null, donor: { userId: 'donor-1', organizationName: 'Spice House', latitude: null, longitude: null } }),
    ] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow()] as never)

    const summary = await runRescueCheck()

    expect(summary.rescued).toBe(1)
    expect(mockedNotify).toHaveBeenCalledTimes(1)
    expect(mockedNotify.mock.calls[0]![0]).toEqual(['donor-1'])
  })

  it('dedupes a volunteer who is also the owner', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([donationRow()] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow({ userId: 'donor-1' })] as never)

    const summary = await runRescueCheck()

    expect(summary.rescued).toBe(1)
    expect(mockedNotify).toHaveBeenCalledTimes(1)
    expect(mockedNotify.mock.calls[0]![0]).toEqual(['donor-1'])
  })

  it('includes nearby transit spots with distance and travel time in the notification text', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([donationRow()] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow()] as never)
    mockedTransit.mockResolvedValue([
      {
        name: 'Central Station',
        label: 'railway station',
        type: 'railway_station',
        latitude: 12.95,
        longitude: 77.58,
        distanceKm: 1.2,
        travelTimeMinutes: 5,
      },
    ] as never)

    await runRescueCheck()

    const rescuerMessage = mockedNotify.mock.calls[1]![1].message
    expect(rescuerMessage).toContain('Central Station (railway station, 1.2 km, ~5 min)')
    expect(rescuerMessage).toContain('Map: https://maps.google.com/?q=12.95000,77.58000')
  })

  it('degrades gracefully when the transit lookup fails', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([donationRow()] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow()] as never)
    mockedTransit.mockRejectedValue(new Error('overpass down'))

    const summary = await runRescueCheck()

    expect(summary.rescued).toBe(1)
    expect(mockedNotify.mock.calls[1]![1].message).toContain('near the donation')
  })

  it('writes rescueNotifiedAt and the alerted tier inside the same transaction', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([donationRow()] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow()] as never)
    let capturedUpdate: ((...args: never[]) => unknown) | undefined
    mockedPrisma.$transaction.mockImplementation((cb: (tx: never) => Promise<unknown>) => {
      const tx = {
        donation: { update: vi.fn().mockResolvedValue({}) },
        notification: { create: vi.fn().mockResolvedValue({ id: 'n1' }) },
      }
      capturedUpdate = tx.donation.update as (...args: never[]) => unknown
      return cb(tx as never)
    })

    await runRescueCheck()

    expect(capturedUpdate).toHaveBeenCalledWith({
      where: { id: 'don-1' },
      data: { rescueNotifiedAt: expect.any(Date), rescuePriorityLevel: 'URGENT' },
    })
  })

  it('escalates: re-alerts when the tier rises (2h left is more urgent than the stored 3–6h tier)', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([
      donationRow({ rescuePriorityLevel: 'INCREASED' }), // 2h left → URGENT > INCREASED
    ] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow()] as never)

    const summary = await runRescueCheck()

    expect(summary).toEqual({ scanned: 1, rescued: 1, notificationsSent: 4 })
    expect(mockedNotify.mock.calls[0]![1].title).toContain('(urgent)')
  })

  it('does not re-alert at the same tier (URGENT already alerted)', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([
      donationRow({ rescuePriorityLevel: 'URGENT' }), // 2h left → still URGENT
    ] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow()] as never)

    const summary = await runRescueCheck()

    expect(summary).toEqual({ scanned: 1, rescued: 0, notificationsSent: 0 })
    expect(mockedNotify).not.toHaveBeenCalled()
  })

  it('never re-alerts a donation that already reached EMERGENCY', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([
      donationRow({ rescuePriorityLevel: 'EMERGENCY', expiryTime: new Date(now + 30 * 60_000) }),
    ] as never)

    const summary = await runRescueCheck()

    expect(summary).toEqual({ scanned: 1, rescued: 0, notificationsSent: 0 })
  })

  it('skips the owner who opted out of location-based alerts (volunteers still get it)', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([
      donationRow({ donor: { userId: 'donor-1', organizationName: 'Spice House', city: 'Bengaluru', latitude: null, longitude: null, user: { locationAlertsEnabled: false } } }),
    ] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow()] as never)

    const summary = await runRescueCheck()

    expect(summary.rescued).toBe(1)
    expect(mockedNotify).toHaveBeenCalledTimes(1)
    expect(mockedNotify.mock.calls[0]![0]).toEqual(['vol-1']) // owner absent
  })

  it('skips volunteers who opted out of location-based alerts', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([donationRow()] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([
      volunteerRow({ user: { locationAlertsEnabled: false } }),
    ] as never)

    const summary = await runRescueCheck()

    expect(summary.rescued).toBe(1)
    expect(mockedNotify).toHaveBeenCalledTimes(1)
    expect(mockedNotify.mock.calls[0]![0]).toEqual(['donor-1']) // volunteer absent
  })

  it('only alerts volunteers within the configured radius (15 km by default)', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([donationRow()] as never)
    // ~2,200 km away — way beyond VOLUNTEER_RADIUS_KM.
    mockedPrisma.volunteer.findMany.mockResolvedValue([
      volunteerRow({ currentLatitude: 32.9, currentLongitude: 78.6 }),
    ] as never)

    const summary = await runRescueCheck()

    expect(summary.rescued).toBe(1)
    expect(mockedNotify).toHaveBeenCalledTimes(1)
    expect(mockedNotify.mock.calls[0]![0]).toEqual(['donor-1'])
  })
})
