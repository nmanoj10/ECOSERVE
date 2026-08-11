/**
 * Donor profile update tests.
 *
 * Covers the new PATCH /api/v1/donor/profile endpoint: partial updates, the
 * location pin that backs the nearby-donations search, clearing fields with
 * null, and the audit-log entry.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { updateProfile } from '../src/controllers/donorController.js'

const prismaMock = vi.hoisted(() => ({
  donor: { findUnique: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

const mockedPrisma = prismaMock

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { userId: 'donor-1', role: 'DONOR', email: 'donor@example.com' },
    body: {},
    ...overrides,
  }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

describe('donor updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates only the fields sent, writes an audit log, and returns the profile', async () => {
    mockedPrisma.donor.findUnique.mockResolvedValue({ id: 'donor-1', userId: 'donor-1' } as never)
    const updated = { id: 'donor-1', organizationName: 'Spice House', latitude: 12.9716, longitude: 77.5946 }
    mockedPrisma.donor.update.mockResolvedValue(updated as never)

    const req = makeReq({ body: { latitude: 12.9716, longitude: 77.5946 } })
    const res = makeRes()

    await updateProfile(req as never, res as never)

    expect(mockedPrisma.donor.findUnique).toHaveBeenCalledWith({ where: { userId: 'donor-1' } })
    expect(mockedPrisma.donor.update).toHaveBeenCalledWith({
      where: { id: 'donor-1' },
      data: { latitude: 12.9716, longitude: 77.5946 },
    })
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith({
      data: { userId: 'donor-1', action: 'donor.profile.updated', entity: 'donor', entityId: 'donor-1' },
    })
    expect(res.json).toHaveBeenCalledWith({ donor: updated })
  })

  it('clears the pin when null is sent', async () => {
    mockedPrisma.donor.findUnique.mockResolvedValue({ id: 'donor-1' } as never)
    mockedPrisma.donor.update.mockResolvedValue({ id: 'donor-1', latitude: null, longitude: null } as never)

    const req = makeReq({ body: { latitude: null, longitude: null } })
    const res = makeRes()

    await updateProfile(req as never, res as never)

    expect(mockedPrisma.donor.update).toHaveBeenCalledWith({
      where: { id: 'donor-1' },
      data: { latitude: null, longitude: null },
    })
  })

  it('throws 404 when the donor profile does not exist', async () => {
    mockedPrisma.donor.findUnique.mockResolvedValue(null)

    const req = makeReq({ body: { city: 'Chennai' } })
    await expect(updateProfile(req as never, makeRes() as never)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
    expect(mockedPrisma.donor.update).not.toHaveBeenCalled()
  })

  it('rethrows unexpected database errors', async () => {
    mockedPrisma.donor.findUnique.mockResolvedValue({ id: 'donor-1' } as never)
    mockedPrisma.donor.update.mockRejectedValue(new Error('db down'))

    const req = makeReq({ body: { city: 'Chennai' } })
    await expect(updateProfile(req as never, makeRes() as never)).rejects.toThrow('db down')
  })
})
