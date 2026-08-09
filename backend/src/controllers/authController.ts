import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { refreshWithGoTrue } from '../services/goTrueService.js'
import {
  findSessionByHash,
  hashToken,
  isUniqueViolation,
  listSessions as listSessionsForUser,
  recordSession,
  revokeSession as revokeSessionRow,
  tokenExpiry,
} from '../services/sessionService.js'
import { HttpError } from '../utils/HttpError.js'
import type { LogoutBody, RefreshBody } from '../validators/auth.js'
import type { RegisterBody } from '../validators/register.js'

/**
 * Creates the platform `users` row (id = Supabase auth user id) plus the
 * role-specific profile, in a transaction. Idempotent: returns the existing
 * user if they are already registered.
 */
export async function register(req: Request, res: Response): Promise<void> {
  const sub = req.auth?.sub
  const email = req.auth?.email

  if (!sub) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid token payload')
  }
  if (!email) {
    throw new HttpError(400, 'EMAIL_REQUIRED', 'Email claim missing from token')
  }

  const body = req.body as RegisterBody

  const existing = await prisma.user.findUnique({ where: { id: sub } })
  if (existing) {
    res.status(200).json({ user: existing })
    return
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        id: sub,
        email,
        fullName: body.fullName,
        phone: body.phone ?? null,
        role: body.role,
        status: 'ACTIVE',
      },
    })

    if (body.role === 'DONOR' && body.donor) {
      await tx.donor.create({ data: { userId: sub, ...body.donor } })
    } else if (body.role === 'NGO' && body.ngo) {
      await tx.ngo.create({ data: { userId: sub, ...body.ngo } })
    } else if (body.role === 'VOLUNTEER' && body.volunteer) {
      await tx.volunteer.create({ data: { userId: sub, ...body.volunteer } })
    }

    return created
  })

  res.status(201).json({ user })
}

/** Returns the authenticated user with their role profile. */
export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user?.userId },
    include: { donor: true, ngo: true, volunteer: true },
  })

  if (!user) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found')
  }

  res.json({ user })
}

/**
 * Refreshes the token pair. The refresh token is the credential: it must exist
 * in the `sessions` table (as a hash), which is what makes it revocable — a
 * revoked token is rejected here before it ever reaches GoTrue. On success the
 * old session row is consumed and the rotated token is recorded.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as RefreshBody

  const session = await findSessionByHash(refreshToken)
  if (!session) {
    throw new HttpError(401, 'REFRESH_TOKEN_REVOKED', 'Refresh token is unknown or revoked')
  }

  let tokens
  try {
    tokens = await refreshWithGoTrue(refreshToken)
  } catch (err) {
    // The token is no longer valid upstream — revoke our record too.
    await revokeSessionRow(session.id, session.userId)
    throw err
  }

  // Rotation: consume the old record, persist the new one.
  await prisma.session.deleteMany({ where: { id: session.id } })
  try {
    await prisma.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: hashToken(tokens.refreshToken),
        expiresAt: tokenExpiry(tokens.refreshToken),
      },
    })
  } catch (err) {
    // A concurrent refresh already recorded this rotated token (GoTrue reuse
    // interval serves the same pair) — not an error.
    if (!isUniqueViolation(err)) throw err
  }

  res.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  })
}

/** Records the caller's current refresh token (as a hash) in the sessions table. */
export async function registerSession(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as RefreshBody

  const session = await recordSession(req.user!.userId, refreshToken)
  res.status(201).json({ session })
}

/** Lists the authenticated user's active sessions. */
export async function listSessions(req: Request, res: Response): Promise<void> {
  const sessions = await listSessionsForUser(req.user!.userId)
  res.json({ sessions })
}

/** Revokes one of the authenticated user's sessions. */
export async function revokeSession(req: Request, res: Response): Promise<void> {
  const sessionId = req.params.id
  if (typeof sessionId !== 'string') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid session id')
  }

  const removed = await revokeSessionRow(sessionId, req.user!.userId)
  if (!removed) {
    throw new HttpError(404, 'NOT_FOUND', 'Session not found')
  }
  res.status(204).end()
}

/**
 * Signs out this device: the refresh token is the credential, so this works
 * even when the access token has already expired. Only the matching session
 * row is revoked — other devices stay signed in (revoke those individually
 * from the sessions list).
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as LogoutBody

  const session = await findSessionByHash(refreshToken)
  if (session) {
    await revokeSessionRow(session.id, session.userId)
  }

  res.status(204).end()
}
