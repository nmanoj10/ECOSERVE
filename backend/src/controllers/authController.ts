import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { createOrConfirmAuthUser, refreshWithGoTrue } from '../services/goTrueService.js'
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
import type { PendingRegistrationBody, RegisterBody, SignupBody } from '../validators/register.js'

/** How long a saved registration form stays valid (covers the signup link window). */
const PENDING_REGISTRATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

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
    // Already registered — consume any stale saved form for this email so the
    // invariant "registered ⇒ no pending row" holds.
    await prisma.pendingRegistration.deleteMany({ where: { email } })
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

    // Registration is complete — consume the saved form (if any) so it can't
    // be replayed on a later visit.
    await tx.pendingRegistration.deleteMany({ where: { email } })

    return created
  })

  res.status(201).json({ user })
}

/**
 * Creates a Supabase auth user that is already email-confirmed (no email is
 * sent). Lets demo signups land directly in the app even while the project
 * still has "Confirm email" enabled or the free-plan email quota is
 * exhausted. The client signs in with the password immediately after.
 */
export async function createInstantSignup(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as SignupBody
  await createOrConfirmAuthUser(email, password)
  res.status(201).json({ ok: true })
}

/**
 * Saves the registration form before email confirmation. The confirmation link
 * lands the user back in the app, where `getPendingRegistration` picks the form
 * up and completes the profile — even when the link is opened on a different
 * browser or device. Upserts per email, so re-signups overwrite stale forms.
 */
export async function savePendingRegistration(req: Request, res: Response): Promise<void> {
  const { email, payload } = req.body as PendingRegistrationBody
  const expiresAt = new Date(Date.now() + PENDING_REGISTRATION_TTL_MS)

  // Opportunistic sweep so abandoned signups don't accumulate forever.
  await prisma.pendingRegistration.deleteMany({ where: { expiresAt: { lt: new Date() } } })

  // NOTE: this endpoint is public (no session yet at signup) but sits behind
  // the auth rate limiter. Overwriting someone else's pending form is only a
  // mild nuisance — a corrupted form fails validation on completion and the
  // user just re-fills it — never a way to take over their account.
  await prisma.pendingRegistration.upsert({
    where: { email },
    update: { payload, expiresAt },
    create: { email, payload, expiresAt },
  })

  res.status(201).json({ registration: { email } })
}

/** Returns the authenticated user's saved registration form, if still valid. */
export async function getPendingRegistration(req: Request, res: Response): Promise<void> {
  const email = req.user!.email
  const registration = await prisma.pendingRegistration.findUnique({ where: { email } })

  if (!registration || registration.expiresAt.getTime() < Date.now()) {
    res.json({ registration: null })
    return
  }

  res.json({ registration: { email: registration.email, payload: registration.payload } })
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

  // Phase 35, Step 89 — defense in depth: never mint fresh tokens for a
  // suspended (or missing) account. Suspension normally deletes the session
  // rows, but this closes the race window between those two operations.
  const account = await prisma.user.findUnique({ where: { id: session.userId }, select: { status: true } })
  if (!account || account.status !== 'ACTIVE') {
    await revokeSessionRow(session.id, session.userId)
    throw new HttpError(403, 'ACCOUNT_SUSPENDED', 'This account is not active')
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
