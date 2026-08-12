/**
 * Phase 38, Step 96 — Status-transition unit tests.
 *
 * Exhaustive coverage of the delivery state machine (canTransitionDelivery)
 * plus the controller-level enforcement in startDelivery / completeDelivery:
 * guards (ownership, precondition status), atomic race protection, and the
 * side effects that must land together (donation/assignment/volunteer/audit).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { canTransitionDelivery, type DeliveryStatus } from '../src/validators/statuses.js'
import { completeDelivery, startDelivery, submitLocation } from '../src/controllers/deliveryController.js'
import { notifyUsers } from '../src/services/notificationService.js'
import { emitToDeliveryRoom, emitToUser } from '../src/services/realtime.js'

const prismaMock = vi.hoisted(() => ({
  delivery: { findUnique: vi.fn(), updateMany: vi.fn() },
  deliveryLocation: { create: vi.fn() },
  donation: { update: vi.fn() },
  volunteerAssignment: { findUnique: vi.fn(), update: vi.fn() },
  volunteer: { update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

vi.mock('../src/services/notificationService.js', () => ({
  NOTIFICATION_TYPES: {
    PICKUP_STARTED: 'PICKUP',
    DELIVERY_STARTED: 'DELIVERY',
    DELIVERY_COMPLETED: 'COMPLETED',
  },
  notifyUsers: vi.fn(),
}))

vi.mock('../src/services/realtime.js', () => ({
  emitToUser: vi.fn(),
  emitToDeliveryRoom: vi.fn(),
}))

// The hoisted mock doubles as the assertion handle (keeps full vi.fn() types).
const mockedPrisma = prismaMock
const mockedNotify = vi.mocked(notifyUsers)
const mockedEmit = vi.mocked(emitToUser)
const mockedEmitRoom = vi.mocked(emitToDeliveryRoom)

describe('canTransitionDelivery — state machine matrix', () => {
  const FLOW: DeliveryStatus[] = ['PENDING', 'AVAILABLE', 'ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED']

  it('allows forward moves along the flow chain (single and multi-step)', () => {
    for (let from = 0; from < FLOW.length; from++) {
      for (let to = from + 1; to < FLOW.length; to++) {
        expect(canTransitionDelivery(FLOW[from]!, FLOW[to]!), `${FLOW[from]} → ${FLOW[to]}`).toBe(true)
      }
    }
  })

  it('rejects every backward move', () => {
    for (let from = 1; from < FLOW.length; from++) {
      for (let to = 0; to < from; to++) {
        expect(canTransitionDelivery(FLOW[from]!, FLOW[to]!), `${FLOW[from]} → ${FLOW[to]}`).toBe(false)
      }
    }
  })

  it('allows staying in the same state (idempotent)', () => {
    for (const state of FLOW) {
      expect(canTransitionDelivery(state, state), `${state} → ${state}`).toBe(true)
    }
  })

  it('allows CANCELLED from every non-terminal, non-cancelled state', () => {
    for (const state of ['PENDING', 'AVAILABLE', 'ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] as DeliveryStatus[]) {
      expect(canTransitionDelivery(state, 'CANCELLED'), `${state} → CANCELLED`).toBe(true)
    }
  })

  it('blocks CANCELLED once the run is DELIVERED', () => {
    expect(canTransitionDelivery('DELIVERED', 'CANCELLED')).toBe(false)
  })

  it('treats CANCELLED as terminal', () => {
    expect(canTransitionDelivery('CANCELLED', 'CANCELLED')).toBe(true)
    for (const to of FLOW) {
      expect(canTransitionDelivery('CANCELLED', to), `CANCELLED → ${to}`).toBe(false)
    }
  })

  it('rejects nonsense values', () => {
    expect(canTransitionDelivery('PENDING' as DeliveryStatus, 'FOO' as DeliveryStatus)).toBe(false)
    expect(canTransitionDelivery('FOO' as DeliveryStatus, 'PENDING' as DeliveryStatus)).toBe(false)
  })
})

describe('startDelivery', () => {
  const deliveryFixture = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    status: 'VOLUNTEER_ASSIGNED',
    assignmentId: 'a1',
    approachingNotifiedAt: null,
    assignment: {
      id: 'a1',
      volunteerId: 'vol-1',
      volunteer: { userId: 'v1', user: { id: 'v1', fullName: 'Ravi' } },
      donation: {
        id: 'don1',
        foodName: 'Biryani',
        donor: { userId: 'donor1', organizationName: 'Spice House' },
        requests: [{ ngo: { userId: 'ngo1', ngoName: 'Hope NGO' } }],
      },
    },
    ...over,
  })

  function makeReq() {
    return { params: { id: 'd1' }, user: { userId: 'v1', role: 'VOLUNTEER', email: 'v@x.com' } }
  }

  function makeRes() {
    return { json: vi.fn(), status: vi.fn().mockReturnThis() }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedNotify.mockResolvedValue(2)
    mockedPrisma.$transaction.mockImplementation((cb: (tx: never) => Promise<unknown>) => {
      const tx = {
        delivery: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        donation: { update: vi.fn().mockResolvedValue({}) },
        volunteerAssignment: { update: vi.fn().mockResolvedValue({}) },
        volunteer: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }
      return cb(tx as never)
    })
  })

  it('rejects with 404 when the delivery does not exist', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(null)

    await expect(startDelivery(makeReq() as never, makeRes() as never)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('rejects with 403 when a different volunteer tries to start it', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture() as never)
    const req = { params: { id: 'd1' }, user: { userId: 'intruder', role: 'VOLUNTEER', email: 'x@y.com' } }

    await expect(startDelivery(req as never, makeRes() as never)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })

  it('rejects with 409 unless the delivery is exactly VOLUNTEER_ASSIGNED', async () => {
    for (const status of ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED'] as DeliveryStatus[]) {
      mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture({ status }) as never)
      await expect(startDelivery(makeReq() as never, makeRes() as never)).rejects.toMatchObject({
        status: 409,
        code: 'INVALID_TRANSITION',
      })
    }
  })

  it('transitions delivery, donation, assignment, and audit log in one transaction', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture() as never)
    const res = makeRes()

    await startDelivery(makeReq() as never, res as never)

    expect(res.json).toHaveBeenCalledWith({
      delivery: { id: 'd1', status: 'IN_TRANSIT', startedAt: expect.any(Date) },
      donation: { id: 'don1', status: 'PICKED_UP' },
      assignment: { id: 'a1', status: 'IN_TRANSIT' },
    })

    const tx = (mockedPrisma.$transaction.mock.calls[0]![0] as (tx: never) => unknown)
    // Re-run the callback to inspect the writes it performs.
    const txMock = {
      delivery: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      donation: { update: vi.fn().mockResolvedValue({}) },
      volunteerAssignment: { update: vi.fn().mockResolvedValue({}) },
      volunteer: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    await (tx as (t: typeof txMock) => Promise<void>)(txMock)

    expect(txMock.delivery.updateMany).toHaveBeenCalledWith({
      where: { id: 'd1', status: 'VOLUNTEER_ASSIGNED' },
      data: { status: 'IN_TRANSIT', startedAt: expect.any(Date) },
    })
    expect(txMock.donation.update).toHaveBeenCalledWith({ where: { id: 'don1' }, data: { status: 'PICKED_UP' } })
    expect(txMock.volunteerAssignment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { status: 'IN_TRANSIT', pickupTime: expect.any(Date) },
    })
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'delivery.started' }) }),
    )
  })

  it('notifies the donor, NGO and volunteer about pickup and transit', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture() as never)

    await startDelivery(makeReq() as never, makeRes() as never)

    // donor+NGO pickup, donor+NGO transit, volunteer pickup, volunteer transit.
    expect(mockedNotify).toHaveBeenCalledTimes(4)
    expect(mockedNotify.mock.calls[0]![0]).toEqual(['donor1', 'ngo1'])
    expect(mockedNotify.mock.calls[1]![0]).toEqual(['donor1', 'ngo1'])
    expect(mockedNotify.mock.calls[2]![0]).toEqual(['v1'])
    expect(mockedNotify.mock.calls[3]![0]).toEqual(['v1'])
    expect(mockedNotify.mock.calls[0]![1].title).toContain('Pickup started')
    expect(mockedNotify.mock.calls[1]![1].title).toContain('In transit')
    expect(mockedNotify.mock.calls[2]![1].message).toContain('You picked up')
    expect(mockedNotify.mock.calls[3]![1].message).toContain('Drive safe')
  })

  it('broadcasts delivery:status IN_TRANSIT to the delivery room', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture() as never)

    await startDelivery(makeReq() as never, makeRes() as never)

    expect(mockedEmitRoom).toHaveBeenCalledWith('d1', 'delivery:status',
      expect.objectContaining({ deliveryId: 'd1', status: 'IN_TRANSIT', startedAt: expect.any(String) }),
    )
  })

  it('guards against a concurrent double-start (atomic updateMany count check)', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture() as never)
    mockedPrisma.$transaction.mockImplementation((cb: (tx: never) => Promise<unknown>) => {
      const tx = {
        delivery: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) }, // lost the race
        donation: { update: vi.fn() },
        volunteerAssignment: { update: vi.fn() },
        auditLog: { create: vi.fn() },
      }
      return cb(tx as never)
    })

    await expect(startDelivery(makeReq() as never, makeRes() as never)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_TRANSITION',
    })
    expect(mockedNotify).not.toHaveBeenCalled()
  })
})

describe('completeDelivery', () => {
  const deliveryFixture = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    status: 'IN_TRANSIT',
    assignmentId: 'a1',
    assignment: {
      id: 'a1',
      volunteerId: 'vol-1',
      volunteer: { userId: 'v1', user: { id: 'v1', fullName: 'Ravi' } },
      donation: {
        id: 'don1',
        foodName: 'Biryani',
        donor: { userId: 'donor1', organizationName: 'Spice House' },
        requests: [{ ngo: { userId: 'ngo1', ngoName: 'Hope NGO' } }],
      },
    },
    ...over,
  })

  function makeReq() {
    return { params: { id: 'd1' }, user: { userId: 'v1', role: 'VOLUNTEER', email: 'v@x.com' } }
  }

  function makeRes() {
    return { json: vi.fn(), status: vi.fn().mockReturnThis() }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedNotify.mockResolvedValue(2)
    // Default happy-path transaction so no test can inherit a stale impl from
    // the startDelivery describe (vi.clearAllMocks keeps implementations).
    mockedPrisma.$transaction.mockImplementation((cb: (t: never) => Promise<unknown>) =>
      cb({
        delivery: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        donation: { update: vi.fn() },
        volunteerAssignment: { update: vi.fn() },
        volunteer: { update: vi.fn() },
        auditLog: { create: vi.fn() },
      } as never),
    )
  })

  it('rejects with 404 for a missing delivery', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(null)
    await expect(completeDelivery(makeReq() as never, makeRes() as never)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('rejects with 403 for a non-assigned volunteer', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture() as never)
    const req = { params: { id: 'd1' }, user: { userId: 'someone-else', role: 'VOLUNTEER', email: 'x@y.com' } }

    await expect(completeDelivery(req as never, makeRes() as never)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })

  it('rejects with 409 unless the delivery is exactly IN_TRANSIT', async () => {
    for (const status of ['PENDING', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED'] as DeliveryStatus[]) {
      mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture({ status }) as never)
      await expect(completeDelivery(makeReq() as never, makeRes() as never)).rejects.toMatchObject({
        status: 409,
        code: 'INVALID_TRANSITION',
      })
    }
  })

  it('completes the run and frees the volunteer in one transaction', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture() as never)

    const tx = {
      delivery: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      donation: { update: vi.fn().mockResolvedValue({}) },
      volunteerAssignment: { update: vi.fn().mockResolvedValue({}) },
      volunteer: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    mockedPrisma.$transaction.mockImplementation((cb: (t: never) => Promise<unknown>) => cb(tx as never))
    const res = makeRes()

    await completeDelivery(makeReq() as never, res as never)

    expect(tx.delivery.updateMany).toHaveBeenCalledWith({
      where: { id: 'd1', status: 'IN_TRANSIT' },
      data: { status: 'DELIVERED', completedAt: expect.any(Date) },
    })
    expect(tx.donation.update).toHaveBeenCalledWith({ where: { id: 'don1' }, data: { status: 'DELIVERED' } })
    expect(tx.volunteerAssignment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { status: 'DELIVERED', deliveryTime: expect.any(Date) },
    })
    expect(tx.volunteer.update).toHaveBeenCalledWith({
      where: { id: 'vol-1' },
      data: { availability: 'AVAILABLE', totalDeliveries: { increment: 1 } },
    })
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ delivery: { id: 'd1', status: 'DELIVERED', completedAt: expect.any(Date) } }),
    )
  })

  it('guards against a concurrent double-complete', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture() as never)
    const tx = {
      delivery: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      donation: { update: vi.fn() },
      volunteerAssignment: { update: vi.fn() },
      volunteer: { update: vi.fn() },
      auditLog: { create: vi.fn() },
    }
    mockedPrisma.$transaction.mockImplementation((cb: (t: never) => Promise<unknown>) => cb(tx as never))

    await expect(completeDelivery(makeReq() as never, makeRes() as never)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_TRANSITION',
    })
    expect(mockedNotify).not.toHaveBeenCalled()
  })

  it('notifies donor, NGO and the volunteer that the delivery is complete', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture() as never)
    mockedPrisma.$transaction.mockImplementation((cb: (t: never) => Promise<unknown>) =>
      cb({
        delivery: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        donation: { update: vi.fn() },
        volunteerAssignment: { update: vi.fn() },
        volunteer: { update: vi.fn() },
        auditLog: { create: vi.fn() },
      } as never),
    )

    await completeDelivery(makeReq() as never, makeRes() as never)

    expect(mockedNotify).toHaveBeenCalledTimes(2)
    expect(mockedNotify.mock.calls[0]![0]).toEqual(['donor1', 'ngo1'])
    expect(mockedNotify.mock.calls[0]![1].title).toContain('Delivery completed')
    expect(mockedNotify.mock.calls[1]![0]).toEqual(['v1'])
    expect(mockedNotify.mock.calls[1]![1].message).toContain('You delivered')
  })

  it('broadcasts delivery:status DELIVERED to the delivery room', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture() as never)
    mockedPrisma.$transaction.mockImplementation((cb: (t: never) => Promise<unknown>) =>
      cb({
        delivery: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        donation: { update: vi.fn() },
        volunteerAssignment: { update: vi.fn() },
        volunteer: { update: vi.fn() },
        auditLog: { create: vi.fn() },
      } as never),
    )

    await completeDelivery(makeReq() as never, makeRes() as never)

    expect(mockedEmitRoom).toHaveBeenCalledWith('d1', 'delivery:status',
      expect.objectContaining({ deliveryId: 'd1', status: 'DELIVERED', completedAt: expect.any(String) }),
    )
  })
})

describe('submitLocation', () => {
  const deliveryFixture = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    status: 'IN_TRANSIT',
    assignmentId: 'a1',
    approachingNotifiedAt: null,
    assignment: { id: 'a1', volunteer: { userId: 'v1' } },
    ...over,
  })

  const assignmentFixture = (over: Record<string, unknown> = {}) => ({
    id: 'a1',
    volunteer: { user: { fullName: 'Ravi' } },
    donation: {
      id: 'don1',
      foodName: 'Biryani',
      donor: { userId: 'donor1' },
      requests: [{ ngo: { userId: 'ngo1', ngoName: 'Hope NGO', latitude: 12.971, longitude: 77.591 } }],
    },
    ...over,
  })

  function makeReq(body: Record<string, unknown> = {}) {
    return {
      params: { id: 'd1' },
      user: { userId: 'v1', role: 'VOLUNTEER', email: 'v@x.com' },
      body: { latitude: 12.97, longitude: 77.59, accuracy: 5, speed: 20, ...body },
    }
  }

  function makeRes() {
    return { json: vi.fn(), status: vi.fn().mockReturnThis() }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture() as never)
    mockedPrisma.deliveryLocation.create.mockResolvedValue({
      id: 'loc1',
      timestamp: new Date('2026-08-10T12:00:00Z'),
      deliveryId: 'd1',
      latitude: 12.97,
      longitude: 77.59,
    } as never)
    mockedPrisma.volunteerAssignment.findUnique.mockResolvedValue(assignmentFixture() as never)
    mockedPrisma.delivery.updateMany.mockResolvedValue({ count: 1 })
    mockedNotify.mockResolvedValue(1)
  })

  it('rejects with 404 for a missing delivery', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(null)
    await expect(submitLocation(makeReq() as never, makeRes() as never)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('rejects with 403 for a non-assigned volunteer', async () => {
    const req = {
      params: { id: 'd1' },
      user: { userId: 'intruder', role: 'VOLUNTEER', email: 'x@y.com' },
      body: { latitude: 12.97, longitude: 77.59 },
    }
    await expect(submitLocation(req as never, makeRes() as never)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })

  it('rejects with 409 unless the delivery is in transit', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(deliveryFixture({ status: 'DELIVERED' }) as never)
    await expect(submitLocation(makeReq() as never, makeRes() as never)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_TRANSITION',
    })
  })

  it('records the GPS sample and broadcasts it to the donor + NGO', async () => {
    const res = makeRes()
    await submitLocation(makeReq() as never, res as never)

    expect(mockedPrisma.deliveryLocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deliveryId: 'd1', latitude: 12.97, longitude: 77.59 }),
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(mockedEmit).toHaveBeenCalledWith('donor1', 'delivery:location', expect.objectContaining({ deliveryId: 'd1' }))
    expect(mockedEmit).toHaveBeenCalledWith('ngo1', 'delivery:location', expect.anything())
  })

  it('fires the approaching alert once when within 0.5 km of the drop point', async () => {
    await submitLocation(makeReq() as never, makeRes() as never)

    // ~0.14 km from the NGO → alert fired via the atomic guarded update.
    expect(mockedPrisma.delivery.updateMany).toHaveBeenCalledWith({
      where: { id: 'd1', approachingNotifiedAt: null },
      data: { approachingNotifiedAt: expect.any(Date) },
    })
    expect(mockedNotify).toHaveBeenCalledTimes(1)
    expect(mockedNotify.mock.calls[0]![0]).toEqual(['donor1', 'ngo1'])
    expect(mockedNotify.mock.calls[0]![1].title).toContain('almost there')
    expect(mockedEmitRoom).toHaveBeenCalledWith('d1', 'delivery:approaching',
      expect.objectContaining({ deliveryId: 'd1', ngoName: 'Hope NGO' }),
    )
  })

  it('does not alert while the volunteer is still far from the drop point', async () => {
    await submitLocation(makeReq({ latitude: 13.2, longitude: 77.9 }) as never, makeRes() as never)

    expect(mockedPrisma.delivery.updateMany).not.toHaveBeenCalled()
    expect(mockedNotify).not.toHaveBeenCalled()
    expect(mockedEmitRoom).not.toHaveBeenCalled()
  })

  it('does not re-alert when the delivery was already flagged (once-guarantee)', async () => {
    mockedPrisma.delivery.findUnique.mockResolvedValue(
      deliveryFixture({ approachingNotifiedAt: new Date('2026-08-10T11:00:00Z') }) as never,
    )

    await submitLocation(makeReq() as never, makeRes() as never)

    expect(mockedPrisma.delivery.updateMany).not.toHaveBeenCalled()
    expect(mockedNotify).not.toHaveBeenCalled()
  })

  it('skips the alert when another request claimed the flag first (atomic guard)', async () => {
    mockedPrisma.delivery.updateMany.mockResolvedValue({ count: 0 }) // lost the race

    await submitLocation(makeReq() as never, makeRes() as never)

    expect(mockedNotify).not.toHaveBeenCalled()
  })
})
