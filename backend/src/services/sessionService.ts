import { createHash } from 'node:crypto'

import { decodeJwt } from 'jose'

import { prisma } from '../config/prisma.js'

const DEFAULT_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days (Supabase default)

/** SHA-256 hex digest — refresh tokens are stored only as hashes, never raw. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** True when the error is a Prisma unique-constraint violation (P2002). */
export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'P2002'
}

/**
 * Reads the `exp` claim (unverified — we only need the expiry for bookkeeping)
 * and falls back to the 30-day Supabase default when the claim is unavailable.
 */
export function tokenExpiry(token: string): Date {
  try {
    const { exp } = decodeJwt(token)
    if (typeof exp === 'number' && Number.isFinite(exp)) {
      return new Date(exp * 1000)
    }
  } catch {
    // fall through to the default
  }
  return new Date(Date.now() + DEFAULT_REFRESH_TTL_MS)
}

/** Records a session for a user, pruning any expired rows they have first. */
export async function recordSession(userId: string, refreshToken: string): Promise<{ id: string; createdAt: Date; expiresAt: Date }> {
  const now = new Date()

  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: now } } })

  const hash = hashToken(refreshToken)
  const select = { id: true, createdAt: true, expiresAt: true }

  try {
    return await prisma.session.create({
      data: { userId, refreshTokenHash: hash, expiresAt: tokenExpiry(refreshToken) },
      select,
    })
  } catch (err) {
    // Same token already recorded (duplicate event / concurrent call) — return
    // the existing row instead of failing on the unique constraint.
    if (isUniqueViolation(err)) {
      const existing = await prisma.session.findUnique({ where: { refreshTokenHash: hash }, select })
      if (existing) return existing
    }
    throw err
  }
}

/** Looks up a session by its raw refresh token (hashed before querying). */
export async function findSessionByHash(refreshToken: string) {
  return prisma.session.findUnique({ where: { refreshTokenHash: hashToken(refreshToken) } })
}

/** Lists a user's active sessions, pruning expired rows along the way. */
export async function listSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })

  return prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, expiresAt: true },
  })
}

/** Revokes a single session, but only if it belongs to the given user. */
export async function revokeSession(id: string, userId: string): Promise<boolean> {
  const { count } = await prisma.session.deleteMany({ where: { id, userId } })
  return count > 0
}
