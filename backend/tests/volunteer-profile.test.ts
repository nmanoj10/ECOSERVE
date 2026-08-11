/**
 * Volunteer profile update tests.
 *
 * Covers the new PATCH /api/v1/volunteer/profile endpoint: vehicle details,
 * the live location pin used by rescue matching, clearing fields with null,
 * and the audit-log entry.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { updateProfile } from '../src/controllers/volunteerController.js'

const prismaMock = vi.hoisted(() => ({
  volunteer: { findUnique: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

const mockedPrisma = prismaMock

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { userId: 'vol-1', role: 'VOLUNTEER', email: 'vol@example.com' },
    body: {},
    ...overrides,
  }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

describe('volunteer updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates vehicle + location, writes an audit log, and returns the profile', async () => {
    mockedPrisma.volunteer.findUnique.mockResolvedValue({ id: 'vol-1', userId: 'vol-1' } as never)
    const updated = {
      id: 'vol-1',
      vehicleType: 'Bike',
      vehicleNumber: 'KA 01 AB 1234',
      currentLatitude: 12.98,
      currentLongitude: 77.58,
    }
    mockedPrisma.volunteer.update.mockResolvedValue(updated as never)

    const req = makeReq({
      body: { vehicleType: 'Bike', vehicleNumber: 'KA 01 AB 1234', currentLatitude: 12.98, currentLongitude: 77.58 },
    })
    const res = makeRes()

    await updateProfile(req as never, res as never)

    expect(mockedPrisma.volunteer.findUnique).toHaveBeenCalledWith({ where: { userId: 'vol-1' } })
    expect(mockedPrisma.volunteer.update).toHaveBeenCalledWith({
      where: { id: 'vol-1' },
      data: {
        vehicleType: 'Bike',
        vehicleNumber: 'KA 01 AB 1234',
        currentLatitude: 12.98,
        currentLongitude: 77.58,
      },
    })
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith({
      data: { userId: 'vol-1', action: 'volunteer.profile.updated', entity: 'volunteer', entityId: 'vol-1' },
    })
    expect(res.json).toHaveBeenCalledWith({ volunteer: updated })
  })

  it('clears the pin when null is sent', async () => {
    mockedPrisma.volunteer.findUnique.mockResolvedValue({ id: 'vol-1' } as never)
    mockedPrisma.volunteer.update.mockResolvedValue({
      id: 'vol-1',
      currentLatitude: null,
      currentLongitude: null,
    } as never)

    const req = makeReq({ body: { currentLatitude: null, currentLongitude: null } })
    const res = makeRes()

    await updateProfile(req as never, res as never)

    expect(mockedPrisma.volunteer.update).toHaveBeenCalledWith({
      where: { id: 'vol-1' },
      data: { currentLatitude: null, currentLongitude: null },
    })
  })

  it('throws 404 when the volunteer profile does not exist', async () => {
    mockedPrisma.volunteer.findUnique.mockResolvedValue(null)

    const req = makeReq({ body: { vehicleType: 'Bike' } })
    await expect(updateProfile(req as never, makeRes() as never)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
    expect(mockedPrisma.volunteer.update).not.toHaveBeenCalled()
  })
})
