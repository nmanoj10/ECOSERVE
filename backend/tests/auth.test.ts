/**
 * Authentication unit tests (local JWT auth).
 *
 * Covers the JWT middleware chain (verifyToken / localVerifyToken /
 * authRequired / authorize), session token helpers, and the local
 * refresh-token service (sessions-table backed, revocable).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignJWT } from 'jose'

import { verifyLocalToken } from '../src/config/supabase.js'
import { authRequired, verifyToken } from '../src/middleware/auth.js'
import { authorize } from '../src/middleware/authorize.js'
import {
  findSessionByHash,
  hashToken,
  isUniqueViolation,
  listSessions,
  recordSession,
  revokeSession,
  tokenExpiry,
} from '../src/services/sessionService.js'
import { refreshLocalToken } from '../src/services/goTrueService.js'
import { env } from '../src/config/env.js'
import { HttpError } from '../src/utils/HttpError.js'
import jwt from 'jsonwebtoken'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  session: { delete: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

vi.mock('../src/config/supabase.js', () => ({
  verifyLocalToken: vi.fn(),
}))

// The hoisted mock doubles as the assertion handle (keeps full vi.fn() types).
const mockedPrisma = prismaMock
const mockedVerify = vi.mocked(verifyLocalToken)

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    auth: undefined,
    user: undefined as { userId: string; role: string; email: string } | undefined,
    ...overrides,
  }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

const next = vi.fn()

describe('verifyToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects with 401 when the Authorization header is missing', async () => {
    await expect(verifyToken(makeReq() as never, makeRes() as never, next)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects with 401 when the header is not a Bearer token', async () => {
    const req = makeReq({ headers: { authorization: 'Basic abc123' } })
    await expect(verifyToken(req as never, makeRes() as never, next)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    })
  })

  it('rejects with 401 when the token cannot be verified', async () => {
    mockedVerify.mockRejectedValue(new Error('jwt expired'))
    const req = makeReq({ headers: { authorization: 'Bearer bad.token.here' } })
    await expect(verifyToken(req as never, makeRes() as never, next)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    })
  })

  it('attaches the verified claims to req.auth and calls next', async () => {
    mockedVerify.mockResolvedValue({ sub: 'user-1', email: 'a@b.com' } as never)
    const req = makeReq({ headers: { authorization: 'Bearer good.token' } })

    await verifyToken(req as never, makeRes() as never, next)

    expect(req.auth).toEqual({ sub: 'user-1', email: 'a@b.com' })
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe('authRequired', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects with 401 when the token is valid but the user is not registered', async () => {
    mockedVerify.mockResolvedValue({ sub: 'ghost', email: 'g@b.com' } as never)
    mockedPrisma.user.findUnique.mockResolvedValue(null)

    const req = makeReq({ headers: { authorization: 'Bearer t' } })
    await expect(authRequired(req as never, makeRes() as never, next)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    })
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'ghost' } })
  })

  it('rejects with 403 ACCOUNT_SUSPENDED for a suspended account', async () => {
    mockedVerify.mockResolvedValue({ sub: 'u1' } as never)
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      role: 'DONOR',
      email: 'a@b.com',
      status: 'SUSPENDED',
    } as never)

    const req = makeReq({ headers: { authorization: 'Bearer t' } })
    await expect(authRequired(req as never, makeRes() as never, next)).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_SUSPENDED',
    })
  })

  it('attaches the platform user and calls next for an active account', async () => {
    mockedVerify.mockResolvedValue({ sub: 'u1', email: 'a@b.com' } as never)
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      role: 'NGO',
      email: 'a@b.com',
      status: 'ACTIVE',
    } as never)

    const req = makeReq({ headers: { authorization: 'Bearer t' } })
    await authRequired(req as never, makeRes() as never, next)

    expect(req.user).toEqual({ userId: 'u1', role: 'NGO', email: 'a@b.com' })
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe('authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets an allowed role through (fresh token + lookup)', async () => {
    mockedVerify.mockResolvedValue({ sub: 'u1' } as never)
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      role: 'ADMIN',
      email: 'a@b.com',
      status: 'ACTIVE',
    } as never)

    const req = makeReq({ headers: { authorization: 'Bearer t' } })
    await authorize('ADMIN')(req as never, makeRes() as never, next)

    expect(req.user?.role).toBe('ADMIN')
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('rejects with 403 FORBIDDEN for a disallowed role', async () => {
    mockedVerify.mockResolvedValue({ sub: 'u1' } as never)
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      role: 'VOLUNTEER',
      email: 'a@b.com',
      status: 'ACTIVE',
    } as never)

    const req = makeReq({ headers: { authorization: 'Bearer t' } })
    await expect(authorize('ADMIN')(req as never, makeRes() as never, next)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })

  it('reuses an already-loaded req.user without a second DB lookup', async () => {
    const req = makeReq({ user: { userId: 'u1', role: 'DONOR', email: 'a@b.com' } })
    await authorize('DONOR')(req as never, makeRes() as never, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled()
  })
})

describe('sessionService token helpers', () => {
  it('hashToken produces a stable 64-char sha256 hex digest', () => {
    const a = hashToken('refresh-token-abc')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken('refresh-token-abc')).toBe(a) // deterministic
    expect(hashToken('refresh-token-xyz')).not.toBe(a) // distinct inputs
  })

  it('isUniqueViolation only matches the Prisma P2002 code', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true)
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation(new Error('boom'))).toBe(false)
  })

  it('tokenExpiry reads the exp claim from a JWT', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(exp)
      .sign(new TextEncoder().encode('test-secret'))

    expect(tokenExpiry(token).getTime()).toBe(exp * 1000)
  })

  it('tokenExpiry falls back to the 30-day default for unreadable tokens', () => {
    const expiry = tokenExpiry('not-a-jwt')
    const expected = Date.now() + 30 * 24 * 60 * 60 * 1000
    expect(Math.abs(expiry.getTime() - expected)).toBeLessThan(5_000)
  })
})

describe('recordSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prunes expired sessions, stores only the token hash, and returns the row', async () => {
    const now = new Date()
    mockedPrisma.session.deleteMany.mockResolvedValue({ count: 2 } as never)
    mockedPrisma.session.create.mockResolvedValue({
      id: 's1',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    } as never)

    const result = await recordSession('u1', 'a-very-long-refresh-token')

    expect(mockedPrisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', expiresAt: { lt: expect.any(Date) } },
    })
    const createArgs = mockedPrisma.session.create.mock.calls[0]?.[0]
    expect(createArgs?.data?.userId).toBe('u1')
    expect(createArgs?.data?.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result.id).toBe('s1')
  })

  it('returns the existing row when the same token races in (unique violation)', async () => {
    mockedPrisma.session.deleteMany.mockResolvedValue({ count: 0 } as never)
    mockedPrisma.session.create.mockRejectedValue({ code: 'P2002' })
    mockedPrisma.session.findUnique.mockResolvedValue({ id: 'existing' } as never)

    const result = await recordSession('u1', 'a-very-long-refresh-token')

    expect(result).toEqual({ id: 'existing' })
    expect(mockedPrisma.session.findUnique).toHaveBeenCalledTimes(1)
  })

  it('rethrows non-unique errors', async () => {
    mockedPrisma.session.deleteMany.mockResolvedValue({ count: 0 } as never)
    mockedPrisma.session.create.mockRejectedValue(new Error('db down'))

    await expect(recordSession('u1', 'a-very-long-refresh-token')).rejects.toThrow('db down')
  })
})

describe('session lookup & listing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('findSessionByHash queries by the hashed token', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue({ id: 's1' } as never)

    await findSessionByHash('raw-refresh-token')

    expect(mockedPrisma.session.findUnique).toHaveBeenCalledWith({
      where: { refreshTokenHash: hashToken('raw-refresh-token') },
    })
  })

  it('listSessions prunes expired rows, then returns the active ones', async () => {
    mockedPrisma.session.deleteMany.mockResolvedValue({ count: 1 } as never)
    mockedPrisma.session.findMany.mockResolvedValue([{ id: 's1' }] as never)

    const result = await listSessions('u1')

    expect(mockedPrisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', expiresAt: { lt: expect.any(Date) } },
    })
    expect(mockedPrisma.session.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true },
    })
    expect(result).toEqual([{ id: 's1' }])
  })
})

describe('revokeSession', () => {
  it('returns true when a session row was deleted', async () => {
    mockedPrisma.session.deleteMany.mockResolvedValue({ count: 1 } as never)
    await expect(revokeSession('s1', 'u1')).resolves.toBe(true)
  })

  it('returns false when nothing matched (scoped to the owner)', async () => {
    mockedPrisma.session.deleteMany.mockResolvedValue({ count: 0 } as never)
    await expect(revokeSession('s1', 'u1')).resolves.toBe(false)
  })
})

describe('refreshLocalToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects with 401 REFRESH_TOKEN_REVOKED when the token has no session row', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue(null)

    await expect(refreshLocalToken('unknown-token')).rejects.toMatchObject({
      status: 401,
      code: 'REFRESH_TOKEN_REVOKED',
    })
  })

  it('rejects with 403 ACCOUNT_SUSPENDED and revokes the session for a suspended account', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue({ id: 's1', userId: 'u1' } as never)
    mockedPrisma.user.findUnique.mockResolvedValue({ status: 'SUSPENDED' } as never)

    await expect(refreshLocalToken('t')).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_SUSPENDED',
    })
    expect(mockedPrisma.session.delete).toHaveBeenCalledWith({ where: { id: 's1' } })
  })

  it('rotates the session and returns a signed HS256 access token on success', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue({ id: 's1', userId: 'u1' } as never)
    mockedPrisma.user.findUnique.mockResolvedValue({ status: 'ACTIVE', email: 'a@b.com' } as never)
    mockedPrisma.session.delete.mockResolvedValue({} as never)
    mockedPrisma.session.create.mockResolvedValue({ id: 's2' } as never)

    const pair = await refreshLocalToken('old-refresh-token')

    // Rotation: old row consumed, new hash stored.
    expect(mockedPrisma.session.delete).toHaveBeenCalledWith({ where: { id: 's1' } })
    const createArgs = mockedPrisma.session.create.mock.calls[0]?.[0]
    expect(createArgs?.data?.userId).toBe('u1')
    expect(createArgs?.data?.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/)

    // The access token must be a real signed JWT the auth middleware accepts.
    const claims = jwt.verify(pair.accessToken, env.JWT_SECRET, { algorithms: ['HS256'] }) as {
      sub: string
      email: string
    }
    expect(claims.sub).toBe('u1')
    expect(claims.email).toBe('a@b.com')
    expect(pair.refreshToken).toMatch(/^[0-9a-f-]{36}$/)
    expect(pair.expiresIn).toBe(3600)
  })

  it('tolerates a concurrent refresh that already recorded the rotated token', async () => {
    mockedPrisma.session.findUnique.mockResolvedValue({ id: 's1', userId: 'u1' } as never)
    mockedPrisma.user.findUnique.mockResolvedValue({ status: 'ACTIVE', email: 'a@b.com' } as never)
    mockedPrisma.session.delete.mockResolvedValue({} as never)
    mockedPrisma.session.create.mockRejectedValue(new Error('Unique constraint failed on the fields: (`refreshTokenHash`)'))

    await expect(refreshLocalToken('old-refresh-token')).resolves.toMatchObject({ expiresIn: 3600 })
  })

  it('maps unexpected errors through HttpError (subclasses catchable by callers)', async () => {
    mockedPrisma.session.findUnique.mockRejectedValue(new HttpError(502, 'UPSTREAM_ERROR', 'boom'))

    try {
      await refreshLocalToken('old')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
    }
  })
})
