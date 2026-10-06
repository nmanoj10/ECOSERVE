/**
 * Pending-registration tests.
 *
 * The registration form is saved server-side before email confirmation so the
 * confirmation-link landing can finish the profile from any browser/device.
 * Covers: save (upsert + expiry), fetch (match / missing / expired), and the
 * cleanup of the saved form once registration completes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getPendingRegistration,
  register,
  savePendingRegistration,
} from '../src/controllers/authController.js'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  pendingRegistration: { upsert: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

const mockedPrisma = prismaMock

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    auth: { sub: 'user-1', email: 'a@b.com' },
    user: { userId: 'user-1', role: 'DONOR', email: 'a@b.com' },
    body: {},
    ...overrides,
  }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

const payload = {
  fullName: 'Alice',
  role: 'DONOR',
  donor: { organizationName: 'Green Kitchen', organizationType: 'Restaurant', address: '1 Main Rd', city: 'Mumbai', state: 'Maharashtra' },
}

describe('savePendingRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('upserts the form with a future expiry and returns 201', async () => {
    mockedPrisma.pendingRegistration.upsert.mockResolvedValue({ id: 'pr-1' } as never)
    mockedPrisma.pendingRegistration.deleteMany.mockResolvedValue({ count: 0 } as never)

    const req = makeReq({ body: { email: 'a@b.com', payload } })
    const res = makeRes()

    await savePendingRegistration(req as never, res as never)

    // The opportunistic sweep bounds the table to unexpired rows.
    expect(mockedPrisma.pendingRegistration.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    })

    const upsertArgs = mockedPrisma.pendingRegistration.upsert.mock.calls[0]?.[0]
    expect(upsertArgs?.where).toEqual({ email: 'a@b.com' })
    expect(upsertArgs?.create?.email).toBe('a@b.com')
    expect(upsertArgs?.create?.payload).toEqual(payload)
    expect(upsertArgs?.create?.expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(upsertArgs?.update?.payload).toEqual(payload)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ registration: { email: 'a@b.com' } })
  })

  it('overwrites a stale form for the same email (upsert update path)', async () => {
    mockedPrisma.pendingRegistration.upsert.mockResolvedValue({ id: 'pr-1' } as never)

    await savePendingRegistration(makeReq({ body: { email: 'a@b.com', payload } }) as never, makeRes() as never)

    expect(mockedPrisma.pendingRegistration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'a@b.com' },
        create: expect.objectContaining({ email: 'a@b.com' }),
      }),
    )
  })
})

describe('getPendingRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the saved form for the authenticated user', async () => {
    mockedPrisma.pendingRegistration.findUnique.mockResolvedValue({
      email: 'a@b.com',
      payload,
      expiresAt: new Date(Date.now() + 60_000),
    } as never)

    const req = makeReq()
    const res = makeRes()

    await getPendingRegistration(req as never, res as never)

    expect(mockedPrisma.pendingRegistration.findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.com' } })
    expect(res.json).toHaveBeenCalledWith({ registration: { email: 'a@b.com', payload } })
  })

  it('returns null when no form was saved', async () => {
    mockedPrisma.pendingRegistration.findUnique.mockResolvedValue(null)

    const res = makeRes()
    await getPendingRegistration(makeReq() as never, res as never)

    expect(mockedPrisma.pendingRegistration.findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.com' } })
    expect(res.json).toHaveBeenCalledWith({ registration: null })
  })

  it('returns null when the saved form has expired', async () => {
    mockedPrisma.pendingRegistration.findUnique.mockResolvedValue({
      email: 'a@b.com',
      payload,
      expiresAt: new Date(Date.now() - 60_000),
    } as never)

    const res = makeRes()
    await getPendingRegistration(makeReq() as never, res as never)

    expect(res.json).toHaveBeenCalledWith({ registration: null })
  })
})

describe('register cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consumes the saved form once the platform user is created', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null)
    const tx = {
      user: { create: vi.fn().mockResolvedValue({ id: 'user-1', role: 'DONOR' } as never) },
      donor: { create: vi.fn() },
      ngo: { create: vi.fn() },
      volunteer: { create: vi.fn() },
      pendingRegistration: { deleteMany: vi.fn() },
    }
    mockedPrisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))

    const req = makeReq({
      body: { fullName: 'Alice', role: 'DONOR', donor: payload.donor },
    })
    const res = makeRes()

    await register(req as never, res as never)

    expect(tx.donor.create).toHaveBeenCalledTimes(1)
    expect(tx.pendingRegistration.deleteMany).toHaveBeenCalledWith({ where: { email: 'a@b.com' } })
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('updates the profile and consumes a stale saved form when the user already exists (idempotent path)', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'DONOR' } as never)
    const tx = {
      user: { update: vi.fn().mockResolvedValue({ id: 'user-1', role: 'DONOR' } as never) },
      donor: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      ngo: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      volunteer: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      pendingRegistration: { deleteMany: vi.fn() },
    }
    mockedPrisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))

    const res = makeRes()
    await register(makeReq({ body: { fullName: 'Alice', role: 'DONOR' } }) as never, res as never)

    // The profile is refreshed in place instead of failing with a duplicate.
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: expect.objectContaining({ fullName: 'Alice', role: 'DONOR' }) }),
    )
    expect(tx.pendingRegistration.deleteMany).toHaveBeenCalledWith({ where: { email: 'a@b.com' } })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: 'user-1' }) }))
  })
})
