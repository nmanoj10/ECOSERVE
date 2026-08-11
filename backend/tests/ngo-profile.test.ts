/**
 * Phase 39 — NGO profile update tests.
 *
 * Covers the new PATCH /api/v1/ngo/profile endpoint: partial updates, the
 * location pin that powers the nearby-donations search, clearing fields with
 * null, and the unique registration-number conflict.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { updateProfile } from '../src/controllers/ngoController.js'
import { HttpError } from '../src/utils/HttpError.js'

const prismaMock = vi.hoisted(() => ({
  ngo: { findUnique: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

const mockedPrisma = prismaMock

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { userId: 'ngo-1', role: 'NGO', email: 'ngo@example.com' },
    body: {},
    ...overrides,
  }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

describe('updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates only the fields sent and returns the refreshed profile', async () => {
    mockedPrisma.ngo.findUnique.mockResolvedValue({ id: 'ngo-1', userId: 'ngo-1' } as never)
    const updated = {
      id: 'ngo-1',
      ngoName: 'Hope NGO',
      latitude: 12.9716,
      longitude: 77.5946,
    }
    mockedPrisma.ngo.update.mockResolvedValue(updated as never)

    const req = makeReq({ body: { latitude: 12.9716, longitude: 77.5946 } })
    const res = makeRes()

    await updateProfile(req as never, res as never)

    expect(mockedPrisma.ngo.findUnique).toHaveBeenCalledWith({ where: { userId: 'ngo-1' } })
    expect(mockedPrisma.ngo.update).toHaveBeenCalledWith({
      where: { id: 'ngo-1' },
      data: { latitude: 12.9716, longitude: 77.5946 },
    })
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith({
      data: { userId: 'ngo-1', action: 'ngo.profile.updated', entity: 'ngo', entityId: 'ngo-1' },
    })
    expect(res.json).toHaveBeenCalledWith({ ngo: updated })
  })

  it('clears the pin when null is sent', async () => {
    mockedPrisma.ngo.findUnique.mockResolvedValue({ id: 'ngo-1' } as never)
    mockedPrisma.ngo.update.mockResolvedValue({ id: 'ngo-1', latitude: null, longitude: null } as never)

    const req = makeReq({ body: { latitude: null, longitude: null } })
    const res = makeRes()

    await updateProfile(req as never, res as never)

    expect(mockedPrisma.ngo.update).toHaveBeenCalledWith({
      where: { id: 'ngo-1' },
      data: { latitude: null, longitude: null },
    })
  })

  it('throws 404 when the NGO profile does not exist', async () => {
    mockedPrisma.ngo.findUnique.mockResolvedValue(null)

    const req = makeReq({ body: { latitude: 12 } })
    await expect(updateProfile(req as never, makeRes() as never)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
    expect(mockedPrisma.ngo.update).not.toHaveBeenCalled()
  })

  it('maps a unique violation on registrationNumber to 409 DUPLICATE_REGISTRATION', async () => {
    mockedPrisma.ngo.findUnique.mockResolvedValue({ id: 'ngo-1' } as never)
    mockedPrisma.ngo.update.mockRejectedValue({ code: 'P2002' })

    const req = makeReq({ body: { registrationNumber: 'NG-TAKEN' } })
    await expect(updateProfile(req as never, makeRes() as never)).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE_REGISTRATION',
    })
  })

  it('rethrows unexpected database errors', async () => {
    mockedPrisma.ngo.findUnique.mockResolvedValue({ id: 'ngo-1' } as never)
    mockedPrisma.ngo.update.mockRejectedValue(new Error('db down'))

    const req = makeReq({ body: { city: 'Chennai' } })
    await expect(updateProfile(req as never, makeRes() as never)).rejects.toThrow('db down')
  })

  it('is an HttpError subclass so callers can distinguish it', async () => {
    mockedPrisma.ngo.findUnique.mockResolvedValue(null)

    const req = makeReq({ body: { city: 'X' } })
    try {
      await updateProfile(req as never, makeRes() as never)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
    }
  })
})
