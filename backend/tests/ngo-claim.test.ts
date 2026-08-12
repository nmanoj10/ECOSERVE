/**
 * Phase 40 — NGO claim (createRequest) volunteer-alert tests.
 *
 * When an NGO accepts food, AVAILABLE volunteers within 30 km of the food
 * should get a "Volunteers needed" (NEEDED) notification so they can offer
 * pickup/delivery help — in addition to the existing donor notification.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createRequest } from '../src/controllers/ngoController.js'

const prismaMock = vi.hoisted(() => ({
  ngo: { findUnique: vi.fn() },
  donation: { findUnique: vi.fn() },
  volunteer: { findMany: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

vi.mock('../src/services/notificationService.js', () => ({
  NOTIFICATION_TYPES: { DONATION_ACCEPTED: 'REQUEST', VOLUNTEER_NEEDED: 'NEEDED' },
  notifyUsers: vi.fn(),
}))

import { notifyUsers } from '../src/services/notificationService.js'

const mockedPrisma = prismaMock
const mockedNotify = vi.mocked(notifyUsers)

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { userId: 'ngo-1', role: 'NGO', email: 'ngo@example.com' },
    body: { donationId: 'don-1' },
    ...overrides,
  }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

function ngoRow(over: Record<string, unknown> = {}) {
  return { id: 'ngo-1', ngoName: 'Hope NGO', ...over }
}

function donationRow(over: Record<string, unknown> = {}) {
  return {
    id: 'don-1',
    foodName: 'Biryani',
    quantity: 10,
    unit: 'kg',
    status: 'AVAILABLE',
    pickupAddress: '12 MG Road, Bengaluru',
    pickupTime: null,
    latitude: 12.9716,
    longitude: 77.5946,
    donor: { userId: 'donor-1', organizationName: 'Spice House', latitude: null, longitude: null },
    ...over,
  }
}

function volunteerRow(userId: string, lat: number | null, lng: number | null) {
  return { userId, currentLatitude: lat, currentLongitude: lng }
}

function mockTransactionSuccess() {
  mockedPrisma.$transaction.mockImplementation((cb: (tx: never) => Promise<unknown>) => {
    const tx = {
      donation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      ngoRequest: { create: vi.fn().mockResolvedValue({ id: 'req-1' }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    return cb(tx as never)
  })
}

describe('createRequest — volunteer alert on claim', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedNotify.mockResolvedValue(1)
    mockedPrisma.ngo.findUnique.mockResolvedValue(ngoRow() as never)
    mockTransactionSuccess()
  })

  it('notifies the donor AND AVAILABLE volunteers within 30 km', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow() as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([
      volunteerRow('vol-near', 12.973, 77.596), // ~0.25 km away
    ] as never)

    const req = makeReq()
    const res = makeRes()
    await createRequest(req as never, res as never)

    // Donor call (REQUEST) + volunteer call (NEEDED).
    expect(mockedNotify).toHaveBeenCalledTimes(2)
    expect(mockedNotify.mock.calls[0]![0]).toEqual(['donor-1'])
    expect(mockedNotify.mock.calls[0]![1].type).toBe('REQUEST')

    expect(mockedNotify.mock.calls[1]![0]).toEqual(['vol-near'])
    expect(mockedNotify.mock.calls[1]![1].type).toBe('NEEDED')
    expect(mockedNotify.mock.calls[1]![1].title).toContain('Volunteers needed')
    expect(mockedNotify.mock.calls[1]![1].message).toContain('Hope NGO')
    expect(mockedNotify.mock.calls[1]![1].donationId).toBe('don-1')
  })

  it('excludes volunteers beyond 30 km', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow() as never)
    // ~12.97, 77.5946 → a volunteer 100+ km away in longitude terms.
    mockedPrisma.volunteer.findMany.mockResolvedValue([
      volunteerRow('vol-far', 12.9716, 78.5946), // ~100 km away
      volunteerRow('vol-near', 12.973, 77.596), // ~0.25 km away
    ] as never)

    const req = makeReq()
    await createRequest(req as never, makeRes() as never)

    const volunteerCall = mockedNotify.mock.calls.find(([, options]) => options.type === 'NEEDED')
    expect(volunteerCall?.[0]).toEqual(['vol-near'])
  })

  it('excludes BUSY and OFFLINE volunteers via the AVAILABLE filter', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow() as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([] as never)

    const req = makeReq()
    await createRequest(req as never, makeRes() as never)

    expect(mockedPrisma.volunteer.findMany).toHaveBeenCalledWith({
      where: { availability: 'AVAILABLE' },
      select: { userId: true, currentLatitude: true, currentLongitude: true },
    })
  })

  it('queries only AVAILABLE volunteers and skips volunteers without a pin', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow() as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([
      volunteerRow('vol-no-pin', null, null),
      volunteerRow('vol-near', 12.973, 77.596),
    ] as never)

    const req = makeReq()
    await createRequest(req as never, makeRes() as never)

    const volunteerCall = mockedNotify.mock.calls.find(([, options]) => options.type === 'NEEDED')
    expect(volunteerCall?.[0]).toEqual(['vol-near'])
  })

  it('falls back to the donor profile coordinates for the food location', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(
      donationRow({
        latitude: null,
        longitude: null,
        donor: { userId: 'donor-1', organizationName: 'Spice House', latitude: 12.9716, longitude: 77.5946 },
      }) as never,
    )
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow('vol-near', 12.973, 77.596)] as never)

    const req = makeReq()
    await createRequest(req as never, makeRes() as never)

    const volunteerCall = mockedNotify.mock.calls.find(([, options]) => options.type === 'NEEDED')
    expect(volunteerCall?.[0]).toEqual(['vol-near'])
  })

  it('skips the volunteer alert entirely when no coordinates exist anywhere', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(
      donationRow({
        latitude: null,
        longitude: null,
        donor: { userId: 'donor-1', organizationName: 'Spice House', latitude: null, longitude: null },
      }) as never,
    )
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow('vol-any', 12.9, 77.5)] as never)

    const req = makeReq()
    await createRequest(req as never, makeRes() as never)

    // Only the donor notification fires — no NEEDED call, no volunteer query.
    expect(mockedNotify).toHaveBeenCalledTimes(1)
    expect(mockedNotify.mock.calls[0]![1].type).toBe('REQUEST')
    expect(mockedPrisma.volunteer.findMany).not.toHaveBeenCalled()
  })

  it('sends no volunteer alert when no volunteers are within range', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow() as never)
    mockedPrisma.volunteer.findMany.mockResolvedValue([volunteerRow('vol-far', 12.9716, 78.5946)] as never)

    const req = makeReq()
    await createRequest(req as never, makeRes() as never)

    expect(mockedNotify).toHaveBeenCalledTimes(1) // donor only
    const volunteerCall = mockedNotify.mock.calls.find(([, options]) => options.type === 'NEEDED')
    expect(volunteerCall).toBeUndefined()
  })

  it('still claims the donation and responds 201 when the alert is skipped', async () => {
    mockedPrisma.donation.findUnique.mockResolvedValue(
      donationRow({
        latitude: null,
        longitude: null,
        donor: { userId: 'donor-1', organizationName: 'Spice House', latitude: null, longitude: null },
      }) as never,
    )

    const req = makeReq()
    const res = makeRes()
    await createRequest(req as never, res as never)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ request: { id: 'req-1' } })
  })
})
