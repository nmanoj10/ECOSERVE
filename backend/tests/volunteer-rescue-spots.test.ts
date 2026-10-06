/**
 * Phase 45 — Rescue-spots tests.
 *
 * Covers GET /api/v1/volunteer/rescue-spots: the donor pickup location plus
 * nearby railway stations / bus stands / homeless-gathering spots (with
 * addresses) that a volunteer who accepted a rescue alert needs to hand out
 * the food. Also covers the no-donationId fallback to the current assignment
 * and the guards (404 / not-available / no-location).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { rescueSpots } from '../src/controllers/volunteerController.js'
import { findNearbyTransitPoints } from '../src/services/transitService.js'
import { env } from '../src/config/env.js'

const prismaMock = vi.hoisted(() => ({
  volunteer: { findUnique: vi.fn() },
  donation: { findUnique: vi.fn() },
  volunteerAssignment: { findFirst: vi.fn() },
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

vi.mock('../src/services/transitService.js', () => ({
  findNearbyTransitPoints: vi.fn(),
}))

const mockedPrisma = prismaMock
const mockedTransit = vi.mocked(findNearbyTransitPoints)

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { userId: 'vol-1', role: 'VOLUNTEER', email: 'vol@example.com' },
    query: {},
    ...overrides,
  }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

function donationRow(over: Record<string, unknown> = {}) {
  return {
    id: 'don-1',
    foodName: 'Biryani',
    quantity: 10,
    unit: 'kg',
    status: 'AVAILABLE',
    pickupAddress: '42, Church Street, Bengaluru',
    expiryTime: new Date('2026-08-12T12:00:00Z'),
    latitude: 12.9716,
    longitude: 77.5946,
    donor: { organizationName: 'Spice House', latitude: null, longitude: null },
    assignments: [],
    ...over,
  }
}

const spots = [
  {
    name: 'Central Station',
    type: 'railway_station',
    label: 'railway station',
    address: '12 MG Road, Bengaluru',
    latitude: 12.975,
    longitude: 77.6,
    distanceKm: 0.7,
  },
  {
    name: 'homeless shelter',
    type: 'homeless_shelter',
    label: 'homeless shelter',
    address: null,
    latitude: 12.97,
    longitude: 77.59,
    distanceKm: 0.3,
  },
]

describe('rescueSpots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedPrisma.volunteer.findUnique.mockResolvedValue({ id: 'vol-1', userId: 'vol-1' } as never)
    mockedTransit.mockResolvedValue(spots as never)
  })

  it('returns the donor pickup + handout spots with addresses and maps links', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow() as never)

    const req = makeReq({ query: { donationId: 'don-1' } })
    const res = makeRes()

    await rescueSpots(req as never, res as never)

    expect(mockedTransit).toHaveBeenCalledWith(12.9716, 77.5946, env.RESCUE_SPOT_RADIUS_KM * 1000, 10)
    expect(res.json).toHaveBeenCalledWith({
      donation: expect.objectContaining({ id: 'don-1', foodName: 'Biryani', donorOrganization: 'Spice House' }),
      pickup: { latitude: 12.9716, longitude: 77.5946 },
      pickupMapsUrl: 'https://maps.google.com/?q=12.97160,77.59460',
      spots: [
        { ...spots[0]!, mapsUrl: 'https://maps.google.com/?q=12.97500,77.60000' },
        { ...spots[1]!, mapsUrl: 'https://maps.google.com/?q=12.97000,77.59000' },
      ],
    })
  })

  it('falls back to the donor profile coordinates when the donation has no pin', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(
      donationRow({
        latitude: null,
        longitude: null,
        donor: { organizationName: 'Spice House', latitude: 12.9, longitude: 77.6 },
      }) as never,
    )

    const req = makeReq({ query: { donationId: 'don-1' } })
    await rescueSpots(req as never, makeRes() as never)

    expect(mockedTransit).toHaveBeenCalledWith(12.9, 77.6, env.RESCUE_SPOT_RADIUS_KM * 1000, 10)
  })

  it('anchors on the current active assignment when no donationId is given', async () => {
    mockedPrisma.volunteerAssignment.findFirst.mockResolvedValue({
      id: 'asn-1',
      donation: donationRow(),
    } as never)

    const req = makeReq({ query: {} })
    const res = makeRes()

    await rescueSpots(req as never, res as never)

    expect(mockedPrisma.volunteerAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { volunteerId: 'vol-1', status: { in: ['PENDING', 'ACCEPTED', 'IN_TRANSIT'] } },
      }),
    )
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ donation: expect.objectContaining({ id: 'don-1' }) }))
  })

  it('returns an empty payload when the volunteer has no active assignment', async () => {
    mockedPrisma.volunteerAssignment.findFirst.mockResolvedValue(null)

    const req = makeReq({ query: {} })
    const res = makeRes()

    await rescueSpots(req as never, res as never)

    expect(res.json).toHaveBeenCalledWith({ donation: null, pickup: null, pickupMapsUrl: null, spots: [] })
    expect(mockedTransit).not.toHaveBeenCalled()
  })

  it('degrades gracefully when the transit lookup fails', async () => {
    mockedTransit.mockRejectedValue(new Error('overpass down'))
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow() as never)

    const req = makeReq({ query: { donationId: 'don-1' } })
    const res = makeRes()

    await rescueSpots(req as never, res as never)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ spots: [] }))
  })

  it('rejects an unknown donation with 404', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(null)

    const req = makeReq({ query: { donationId: 'missing' } })
    await expect(rescueSpots(req as never, makeRes() as never)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('rejects a claimed donation the volunteer is not assigned to', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow({ status: 'RESERVED' }) as never)

    const req = makeReq({ query: { donationId: 'don-1' } })
    await expect(rescueSpots(req as never, makeRes() as never)).rejects.toMatchObject({
      status: 409,
      code: 'NOT_AVAILABLE',
    })
  })

  it('allows a claimed donation the volunteer is assigned to', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(
      donationRow({ status: 'RESERVED', assignments: [{ id: 'asn-1' }] }) as never,
    )

    const req = makeReq({ query: { donationId: 'don-1' } })
    await expect(rescueSpots(req as never, makeRes() as never)).resolves.toBeUndefined()
  })

  it('rejects when no coordinates exist anywhere', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(
      donationRow({
        latitude: null,
        longitude: null,
        donor: { organizationName: 'Spice House', latitude: null, longitude: null },
      }) as never,
    )

    const req = makeReq({ query: { donationId: 'don-1' } })
    await expect(rescueSpots(req as never, makeRes() as never)).rejects.toMatchObject({
      status: 409,
      code: 'NO_LOCATION',
    })
    expect(mockedTransit).not.toHaveBeenCalled()
  })
})
