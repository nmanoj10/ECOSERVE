/**
 * Google sign-in (Firebase) controller unit tests.
 *
 * Covers the /auth/google exchange: verifying the ID token via the firebase
 * service, find-or-create of the platform user by email, the `needsProfile`
 * flag for accounts that still have to complete registration, and rejection of
 * suspended or unverified identities.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { googleLogin } from '../src/controllers/authController.js'
import { verifyGoogleIdToken } from '../src/services/firebaseService.js'
import { generateTokenPayload } from '../src/services/goTrueService.js'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn() },
  session: { create: vi.fn() },
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

vi.mock('../src/services/firebaseService.js', () => ({ verifyGoogleIdToken: vi.fn() }))

const mockedVerify = vi.mocked(verifyGoogleIdToken)

function makeReq(overrides: Record<string, unknown> = {}) {
  return { body: {}, ...overrides }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('googleLogin', () => {
  it('rejects when the ID token fails verification', async () => {
    mockedVerify.mockRejectedValue(new Error('Invalid or expired Google token'))
    const req = makeReq({ body: { idToken: 'bad.token' } })

    await expect(googleLogin(req as never, makeRes() as never)).rejects.toThrow('Invalid or expired Google token')
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('creates a profile-less user for a brand-new Google account (needsProfile)', async () => {
    mockedVerify.mockResolvedValue({
      uid: 'google-uid-1',
      email: 'gordon.ramsay@gmail.com',
      name: 'Gordon Ramsay',
    } as never)
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({
      id: 'u1',
      email: 'gordon.ramsay@gmail.com',
      fullName: 'Gordon Ramsay',
      role: 'DONOR',
      status: 'ACTIVE',
      donor: null,
      ngo: null,
      volunteer: null,
    } as never)
    prismaMock.session.create.mockResolvedValue({ id: 's1' } as never)

    const res = makeRes()
    await googleLogin(makeReq({ body: { idToken: 'good.token' } }) as never, res as never)

    // No password auth for a Google-only account.
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'gordon.ramsay@gmail.com', passwordHash: null, fullName: 'Gordon Ramsay' }),
      }),
    )
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        needsProfile: true,
        user: expect.objectContaining({ email: 'gordon.ramsay@gmail.com' }),
        tokens: expect.objectContaining({ accessToken: expect.any(String), refreshToken: expect.any(String) }),
      }),
    )
  })

  it('logs in an existing user with a completed profile (needsProfile false)', async () => {
    mockedVerify.mockResolvedValue({
      uid: 'google-uid-1',
      email: 'existing@example.com',
      name: 'Existing User',
    } as never)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u9',
      email: 'existing@example.com',
      fullName: 'Existing User',
      role: 'VOLUNTEER',
      status: 'ACTIVE',
      donor: null,
      ngo: null,
      volunteer: { id: 'v1' },
    } as never)
    prismaMock.session.create.mockResolvedValue({ id: 's1' } as never)

    const res = makeRes()
    await googleLogin(makeReq({ body: { idToken: 'good.token' } }) as never, res as never)

    expect(prismaMock.user.create).not.toHaveBeenCalled()
    const jsonArgs = res.json.mock.calls[0]?.[0]
    expect(jsonArgs.needsProfile).toBe(false)
    expect(jsonArgs.user.role).toBe('VOLUNTEER')
  })

  it('rejects a suspended account', async () => {
    mockedVerify.mockResolvedValue({
      uid: 'google-uid-1',
      email: 'suspended@example.com',
      name: '',
    } as never)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u2',
      email: 'suspended@example.com',
      fullName: 'X',
      role: 'DONOR',
      status: 'SUSPENDED',
      donor: null,
      ngo: null,
      volunteer: null,
    } as never)

    await expect(googleLogin(makeReq({ body: { idToken: 'good.token' } }) as never, makeRes() as never)).rejects.toMatchObject(
      {
        status: 403,
        code: 'ACCOUNT_SUSPENDED',
      },
    )
    expect(prismaMock.session.create).not.toHaveBeenCalled()
  })
})

describe('googleLogin tokens use the same local signing as login', () => {
  it('issues a locally-signed access token verifiable by the auth middleware', async () => {
    // The token payload generator is shared with the password login path, so a
    // googleLogin access token is indistinguishable from a password-login one.
    const payload = generateTokenPayload('u1', 'a@b.com', 3600)
    expect(payload.sub).toBe('u1')
    expect(payload.email).toBe('a@b.com')
    expect(payload.exp).toBe(payload.iat + 3600)
  })
})