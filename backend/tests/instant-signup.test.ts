/**
 * Instant-signup tests.
 *
 * `POST /auth/signup` creates a local auth user that is already active —
 * no confirmation email is sent — so demo signups work immediately and the
 * client signs in with the password right after. If the email already exists,
 * the existing account's password is set to the caller-chosen one and the
 * account is (re)activated (⚠️ demo-only semantics, see goTrueService).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createInstantSignup } from '../src/controllers/authController.js'
import bcrypt from 'bcrypt'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

const mockedPrisma = prismaMock

function makeReq(overrides: Record<string, unknown> = {}) {
  return { body: {}, ...overrides }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

describe('createInstantSignup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new active local user and returns 201', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null)
    mockedPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com' } as never)

    const res = makeRes()
    await createInstantSignup(
      makeReq({ body: { email: 'a@b.com', password: 'password123' } }) as never,
      res as never,
    )

    const createArgs = mockedPrisma.user.create.mock.calls[0]?.[0]
    expect(createArgs?.data?.email).toBe('a@b.com')
    expect(createArgs?.data?.status).toBe('ACTIVE')
    // The password must be stored hashed, never in plaintext.
    expect(createArgs?.data?.passwordHash).toBeDefined()
    expect(createArgs?.data?.passwordHash).not.toBe('password123')
    expect(await bcrypt.compare('password123', createArgs?.data?.passwordHash)).toBe(true)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('adopts the caller-chosen password on an existing account (demo re-registration path)', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-1',
      email: 'a@b.com',
      status: 'ACTIVE',
    } as never)
    mockedPrisma.user.update.mockResolvedValue({ id: 'existing-1' } as never)

    const res = makeRes()
    await createInstantSignup(
      makeReq({ body: { email: 'a@b.com', password: 'password123' } }) as never,
      res as never,
    )

    expect(mockedPrisma.user.create).not.toHaveBeenCalled()
    const updateArgs = mockedPrisma.user.update.mock.calls[0]?.[0]
    expect(updateArgs?.where).toEqual({ id: 'existing-1' })
    expect(updateArgs?.data?.status).toBe('ACTIVE')
    expect(await bcrypt.compare('password123', updateArgs?.data?.passwordHash)).toBe(true)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('reactivates a suspended existing account', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'suspended-1',
      email: 'a@b.com',
      status: 'SUSPENDED',
    } as never)
    mockedPrisma.user.update.mockResolvedValue({ id: 'suspended-1' } as never)

    const res = makeRes()
    await createInstantSignup(
      makeReq({ body: { email: 'a@b.com', password: 'password123' } }) as never,
      res as never,
    )

    const updateArgs = mockedPrisma.user.update.mock.calls[0]?.[0]
    expect(updateArgs?.data?.status).toBe('ACTIVE')
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('surfaces a database failure instead of swallowing it', async () => {
    mockedPrisma.user.findUnique.mockRejectedValue(new Error('db down'))

    await expect(
      createInstantSignup(makeReq({ body: { email: 'a@b.com', password: 'password123' } }) as never, makeRes() as never),
    ).rejects.toThrow('db down')
  })
})
