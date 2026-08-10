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
      expiryTime: new Date(now + 2 * 3_600_000), // 2h left — inside the 3h window
      rescueNotifiedAt: null,
      latitude: 12.95,
      longitude: 77.58,
      donor: { userId: 'donor-1', organizationName: 'Spice House', latitude: null, longitude: null },
      ...over,
    }
  }

  function volunteerRow(over: Record<string, unknown> = {}) {
    return { userId: 'vol-1', currentLatitude: 12.96, currentLongitude: 77.59, ...over }
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

  it('queries the rescue window and the notified-once flag', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([] as never)

    await runRescueCheck()

    const where = mockedPrisma.donation.findMany.mock.calls[0]?.[0]?.where
    expect(where).toMatchObject({ status: 'AVAILABLE', rescueNotifiedAt: null })
    expect(where.expiryTime.gte).toBeInstanceOf(Date) // 30-min grace into the past
    expect(where.expiryTime.lte).toBeInstanceOf(Date) // 3h ahead
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

  it('includes nearby transit spots in the notification text', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([donationRow()] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow()] as never)
    mockedTransit.mockResolvedValue([
      { name: 'Central Station', label: 'railway station', type: 'railway_station', latitude: 12.95, longitude: 77.58, distanceKm: 1.2 },
    ] as never)

    await runRescueCheck()

    const rescuerMessage = mockedNotify.mock.calls[1]![1].message
    expect(rescuerMessage).toContain('Central Station (railway station, 1.2 km)')
  })

  it('degrades gracefully when the transit lookup fails', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([donationRow()] as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow()] as never)
    mockedTransit.mockRejectedValue(new Error('overpass down'))

    const summary = await runRescueCheck()

    expect(summary.rescued).toBe(1)
    expect(mockedNotify.mock.calls[1]![1].message).toContain('near the donation')
  })

  it('writes rescueNotifiedAt inside the same transaction (once-guarantee)', async () => {
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
      data: { rescueNotifiedAt: expect.any(Date) },
    })
  })

  it('does not re-alert: the sweep query itself filters rescueNotifiedAt: null', async () => {
    mockedPrisma.donation.findMany.mockResolvedValue([donationRow()] as never)

    await runRescueCheck()

    const where = mockedPrisma.donation.findMany.mock.calls[0]?.[0]?.where
    expect(where.rescueNotifiedAt).toBeNull()
    // The only protection against repeat alerts lives in the query + the
    // transactional flag write — a row that already went through the sweep
    // can never match the filter again.
  })
})
