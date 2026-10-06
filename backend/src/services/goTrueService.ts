import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/HttpError.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { hashToken } from './sessionService.js'

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/**
 * Generates a local JWT token payload.
 * The actual signing is done by the caller using jwt.sign(payload, env.JWT_SECRET).
 */
export function generateTokenPayload(sub: string, email: string, expiresIn: number): {
  sub: string
  email: string
  iat: number
  exp: number
} {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + expiresIn
  return { sub, email, iat, exp }
}

/** Hashes a plain password using bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

/** Verifies a plain password against a bcrypt hash. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Creates a local auth user in PostgreSQL (already confirmed).
 * Powers `POST /auth/signup` so signups work instantly.
 */
export async function createLocalAuthUser(email: string, password: string): Promise<void> {
  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    // If user exists, just ensure they're active
    if (existing.status !== 'ACTIVE') {
      await prisma.user.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE' },
      })
    }
    return
  }

  // Create new user with confirmed status
  const passwordHash = await hashPassword(password)
  await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email,
      passwordHash,
      fullName: '',
      phone: null,
      role: 'DONOR', // default role; will be updated during profile registration
      status: 'ACTIVE',
    },
  })
}

/**
 * Creates or confirms a local auth user in PostgreSQL.
 * If the email is already registered, the existing account's password is set
 * to the caller-chosen one and the account is (re)activated.
 * Powers `POST /auth/signup` so demo signups work instantly.
 *
 * ⚠️ DEMO-ONLY semantics: this endpoint lets anyone create a confirmed account
 * for ANY address with a caller-chosen password. Resetting the password on an
 * existing account is part of that contract — without it, a re-registration
 * (or a signup that collided with a seeded demo account) fails the follow-up
 * login with a confusing 401. Do NOT ship this behavior without email
 * verification.
 */
export async function createOrConfirmAuthUser(email: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password)

  // Check if user already exists by email
  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    // Account exists — adopt the caller-chosen password and ensure it's active.
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, status: 'ACTIVE' },
    })
    return
  }

  // Create new user with confirmed status
  await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email,
      passwordHash,
      fullName: '',
      phone: null,
      role: 'DONOR', // default role; will be updated during profile registration
      status: 'ACTIVE',
    },
  })
}

/**
 * Finds a user by email and verifies their password.
 * Returns the user if credentials are valid, null otherwise.
 */
export async function findAndVerifyUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.passwordHash) {
    return null
  }
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return null
  }
  return user
}

/**
 * Refreshes a local access token using a refresh token from the sessions table.
 * The refresh token is the credential: it must exist in the `sessions` table (as a hash),
 * which is what makes it revocable — a revoked token is rejected here before it ever reaches GoTrue.
 * On success the old session row is consumed and the rotated token is recorded.
 */
export async function refreshLocalToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const refreshTokenHash = hashToken(refreshToken)
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash },
  })

  if (!session) {
    throw new HttpError(401, 'REFRESH_TOKEN_REVOKED', 'Refresh token is unknown or revoked')
  }

  // Phase 35, Step 89 — defense in depth: never mint fresh tokens for a
  // suspended (or missing) account. Suspension normally deletes the session
  // rows, but this closes the race window between those two operations.
  const account = await prisma.user.findUnique({ where: { id: session.userId }, select: { status: true, email: true } })
  if (!account || account.status !== 'ACTIVE') {
    await prisma.session.delete({ where: { id: session.id } })
    throw new HttpError(403, 'ACCOUNT_SUSPENDED', 'This account is not active')
  }

  // Generate new token payload
  const payload = generateTokenPayload(session.userId, account.email || '', 3600)

  // Generate new refresh token (random UUID for demo)
  const newRefreshToken = crypto.randomUUID()
  const newRefreshTokenHash = hashToken(newRefreshToken)

  // Rotation: consume the old record, persist the new one.
  await prisma.session.delete({ where: { id: session.id } })
  try {
    await prisma.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    })
  } catch (err) {
    // A concurrent refresh already recorded this rotated token (GoTrue reuse
    // interval serves the same pair) — not an error.
    if (err instanceof Error && !err.message.includes('Unique constraint')) throw err
  }

  // Sign the access token exactly like login() does — the auth middleware
  // verifies it with HS256 + JWT_SECRET, so an unsigned blob would 401 on the
  // very next request after a refresh.
  return {
    accessToken: jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS256' }),
    refreshToken: newRefreshToken,
    expiresIn: 3600,
  }
}