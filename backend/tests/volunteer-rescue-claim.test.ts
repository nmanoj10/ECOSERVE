/**
 * Phase 46 — Rescue-claim tests.
 *
 * Covers POST /api/v1/volunteer/rescue-claim: a volunteer accepting a rescue
 * alert reuses the standard assignment/delivery machinery (pickup → live
 * tracking → hand-out), flips the donation to RESERVED atomically, cancels
 * pending NGO requests, marks the volunteer BUSY, and notifies donor +
 * volunteer. Also covers the guards: vehicle capacity, missing location pin,
 * and a donation that is no longer AVAILABLE.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { rescueClaim } from '../src/controllers/volunteerController.js'
import { notifyUsers } from '../src/services/notificationService.js'
import { HttpError } from '../src/utils/HttpError.js'

const prismaMock = vi.hoisted(() => ({
  volunteer: { findUnique: vi.fn() },
  donation: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

vi.mock('../src/services/notificationService.js', () => ({
  NOTIFICATION_TYPES: { VOLUNTEER_ASSIGNED: 'VOLUNTEER_ASSIGNED' },
  notifyUsers: vi.fn(),
}))

const mockedPrisma = prismaMock
const mockedNotify = vi.mocked(notifyUsers)

function makeReq(body: Record<string, unknown> = {}) {
  return { user: { userId: 'vol-1', role: 'VOLUNTEER', email: 'vol@example.com' }, body }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

const volunteerRow = {
  id: 'vol-1',
  userId: 'vol-1',
  vehicleType: 'car', // capacity 120 kg
  currentLatitude: 12.96,
  currentLongitude: 77.59,
  user: { fullName: 'Ravi Kumar' },
}

function donationRow(over: Record<string, unknown> = {}) {
  return {
    id: 'don-1',
    foodName: 'Biryani',
    quantity: 10,
    unit: 'kg',
    status: 'AVAILABLE',
    pickupAddress: 'Church Street, Bengaluru',
    latitude: 12.95,
    longitude: 77.58,
    donor: { userId: 'donor-1', organizationName: 'Spice House', latitude: null, longitude: null },
    requests: [],
    ...over,
  }
}

/** Captures the transaction callback and mirrors its writes with in-memory fns. */
function mockTransaction(txMocks: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const tx = {
    donation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    ngoRequest: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    volunteerAssignment: { create: vi.fn().mockResolvedValue({ id: 'asg-1', status: 'ACCEPTED', acceptedAt: new Date() }) },
    delivery: {
      create: vi
        .fn()
        .mockResolvedValue({ id: 'del-1', dropLocation: 'Central Bus Stand', dropLatitude: 12.95, dropLongitude: 77.58, status: 'VOLUNTEER_ASSIGNED' }),
    },
    volunteer: { update: vi.fn().mockResolvedValue({ id: 'vol-1' }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'log-1' }) },
    ...txMocks,
  }
  mockedPrisma.$transaction.mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx))
  return tx
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedNotify.mockResolvedValue(1)
})

describe('POST /volunteer/rescue-claim', () => {
  it('claims the rescue: creates assignment + delivery, RESERVEs the donation, cancels pending NGO requests', async () => {
    mockedPrisma.volunteer.findUnique.mockResolvedValue(volunteerRow)
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow())
    const tx = mockTransaction()

    const res = makeRes()
    await rescueClaim(makeReq({ donationId: 'don-1', distributionSpot: { name: 'Central Bus Stand', latitude: 12.95, longitude: 77.58 } }), res as never)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ assignment: expect.anything(), delivery: expect.anything() }))
    // Atomic claim guard — the donation is only touchable while AVAILABLE.
    expect(tx.donation.updateMany).toHaveBeenCalledWith({
      where: { id: 'don-1', status: 'AVAILABLE' },
      data: { status: 'RESERVED', rescueNotifiedAt: expect.any(Date) },
    })
    // Donor picked the volunteer route — pending NGO offers are cleared.
    expect(tx.ngoRequest.updateMany).toHaveBeenCalledWith({
      where: { donationId: 'don-1', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    })
    expect(tx.volunteerAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ volunteerId: 'vol-1', donationId: 'don-1', status: 'ACCEPTED', acceptedAt: expect.any(Date) }),
    })
    // The chosen distribution spot becomes the delivery drop pin + label.
    expect(tx.delivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dropLocation: 'Central Bus Stand',
        dropLatitude: 12.95,
        dropLongitude: 77.58,
        status: 'VOLUNTEER_ASSIGNED',
        pickupLocation: 'Church Street, Bengaluru',
      }),
    })
    expect(tx.volunteer.update).toHaveBeenCalledWith({ where: { id: 'vol-1' }, data: { availability: 'BUSY' } })
    // Donor + volunteer notified.
    expect(mockedNotify).toHaveBeenCalledTimes(2)
    expect(mockedNotify.mock.calls[0]![0]).toEqual(['donor-1'])
    expect(mockedNotify.mock.calls[1]![0]).toEqual(['vol-1'])
  })

  it('falls back to the pickup pin when no distribution spot is sent', async () => {
    mockedPrisma.volunteer.findUnique.mockResolvedValue(volunteerRow)
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow())
    const tx = mockTransaction()

    await rescueClaim(makeReq({ donationId: 'don-1' }), makeRes() as never)

    expect(tx.delivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dropLatitude: 12.95, dropLongitude: 77.58, dropLocation: 'Near Church Street, Bengaluru' }),
    })
  })

  it('rejects a missing donationId', async () => {
    await expect(rescueClaim(makeReq({}), makeRes() as never)).rejects.toMatchObject({ code: 'VALIDATION', status: 400 })
  })

  it('rejects a donation that is no longer AVAILABLE', async () => {
    mockedPrisma.volunteer.findUnique.mockResolvedValue(volunteerRow)
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow({ status: 'RESERVED' }))

    await expect(rescueClaim(makeReq({ donationId: 'don-1' }), makeRes() as never)).rejects.toMatchObject({
      code: 'NOT_AVAILABLE',
      status: 409,
    })
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects when the vehicle cannot carry the quantity', async () => {
    mockedPrisma.volunteer.findUnique.mockResolvedValue(volunteerRow)
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow({ quantity: 200 })) // car max 120 kg

    await expect(rescueClaim(makeReq({ donationId: 'don-1' }), makeRes() as never)).rejects.toMatchObject({
      code: 'VEHICLE_CAPACITY',
      status: 409,
    })
  })

  it('rejects a donation with no location pin', async () => {
    mockedPrisma.volunteer.findUnique.mockResolvedValue(volunteerRow)
    mockedPrisma.donation.findUnique.mockResolvedValue(
      donationRow({ latitude: null, longitude: null, donor: { userId: 'donor-1', organizationName: 'Spice House', latitude: null, longitude: null } }),
    )

    await expect(rescueClaim(makeReq({ donationId: 'don-1' }), makeRes() as never)).rejects.toMatchObject({
      code: 'NO_LOCATION',
      status: 409,
    })
  })

  it('guards against a double claim through the atomic updateMany returning 0', async () => {
    mockedPrisma.volunteer.findUnique.mockResolvedValue(volunteerRow)
    mockedPrisma.donation.findUnique.mockResolvedValue(donationRow())
    const tx = mockTransaction({
      // Another volunteer's updateMany already flipped the row — ours must fail.
      donation: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    })

    await expect(rescueClaim(makeReq({ donationId: 'don-1' }), makeRes() as never)).rejects.toMatchObject({
      code: 'NOT_AVAILABLE',
      status: 409,
    })
    expect(tx.volunteerAssignment.create).not.toHaveBeenCalled()
  })
})