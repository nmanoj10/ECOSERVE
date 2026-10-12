import type { Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { createOrConfirmAuthUser, findAndVerifyUser, generateTokenPayload, hashPassword, refreshLocalToken } from '../services/goTrueService.js'
import {
  findSessionByHash,
  hashToken,
  isUniqueViolation,
  listSessions as listSessionsForUser,
  recordSession,
  revokeSession as revokeSessionRow,
  tokenExpiry,
} from '../services/sessionService.js'
import { consumePasswordResetOtp, issuePasswordResetOtp, OTP_TTL_MINUTES } from '../services/passwordResetService.js'
import { sendPasswordResetOtp } from '../services/emailService.js'
import { verifyGoogleIdToken } from '../services/firebaseService.js'
import { HttpError } from '../utils/HttpError.js'
import { env } from '../config/env.js'
import jwt from 'jsonwebtoken'
import type { ForgotPasswordBody, GoogleAuthBody, LogoutBody, RefreshBody, ResetPasswordBody } from '../validators/auth.js'
import type { LoginBody, PendingRegistrationBody, RegisterBody, SignupBody } from '../validators/register.js'

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
    // User exists — update profile and create role-specific profile if missing
    await prisma.$transaction(async (tx) => {
      // Update user profile
      await tx.user.update({
        where: { id: sub },
        data: {
          fullName: body.fullName,
          phone: body.phone ?? null,
          role: body.role,
        },
      })

      // Create role-specific profile if missing
      if (body.role === 'DONOR' && body.donor) {
        const existingDonor = await tx.donor.findUnique({ where: { userId: sub } })
        if (!existingDonor) {
          await tx.donor.create({ data: { userId: sub, ...body.donor } })
        } else {
          await tx.donor.update({ where: { userId: sub }, data: body.donor })
        }
      } else if (body.role === 'NGO' && body.ngo) {
        const existingNgo = await tx.ngo.findUnique({ where: { userId: sub } })
        if (!existingNgo) {
          await tx.ngo.create({ data: { userId: sub, ...body.ngo } })
        } else {
          await tx.ngo.update({ where: { userId: sub }, data: body.ngo })
        }
      } else if (body.role === 'VOLUNTEER' && body.volunteer) {
        const existingVolunteer = await tx.volunteer.findUnique({ where: { userId: sub } })
        if (!existingVolunteer) {
          await tx.volunteer.create({ data: { userId: sub, ...body.volunteer } })
        } else {
          await tx.volunteer.update({ where: { userId: sub }, data: body.volunteer })
        }
      }

      // Registration is complete — consume the saved form (if any) so it can't
      // be replayed on a later visit.
      await tx.pendingRegistration.deleteMany({ where: { email } })
    })

    const user = await prisma.user.findUnique({
      where: { id: sub },
      include: { donor: true, ngo: true, volunteer: true },
    })
    res.status(200).json({ user })
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
 * Forgot-password — issues a 6-digit OTP and emails it to the address.
 *
 * Always resolves with `{ ok: true }` (even for unknown / suspended / throttled
 * accounts) so the endpoint can't be used to probe which emails are registered.
 * The per-user hourly cap silently drops extra requests; SMTP-less dev runs log
 * the code to the server console instead of emailing it.
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ForgotPasswordBody

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true },
  })

  // Silent no-op for anything that isn't an active account (anti-enumeration).
  if (user && user.status === 'ACTIVE') {
    const code = await issuePasswordResetOtp(user.id)

    if (code) {
      try {
        await sendPasswordResetOtp(email, code, OTP_TTL_MINUTES)
      } catch (err) {
        // SMTP down or misconfigured — never leak the failure to the client
        // (anti-enumeration) and never lose the flow: fall back to the dev
        // console so the user still gets their code in development.
        console.warn(
          `[auth] SMTP send failed for ${email}: ${err instanceof Error ? err.message : String(err)} — falling back to console`,
        )
        console.log(`[dev] Password-reset OTP for ${email}: ${code} (valid for ${OTP_TTL_MINUTES} min)`)
      }
    } else {
      // Rolling rate cap hit — behave as if sent (attacker learns nothing),
      // keep the server-side signal for ops debugging.
      console.warn(`[auth] Password-reset OTP rate cap hit for ${email}`)
    }
  }

  res.json({ ok: true })
}

/**
 * Reset-password — verifies the emailed OTP and sets a new password.
 *
 * On success the user's new password is stored (bcrypt) and every session is
 * revoked, so a stolen/lost code can't be combined with a still-valid session.
 * Wrong guesses are bounded per code (see consumePasswordResetOtp); the shared
 * auth limiter bounds requests per client IP.
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { email, code, newPassword } = req.body as ResetPasswordBody

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) {
    throw new HttpError(400, 'INVALID_RESET_CODE', 'Invalid or expired reset code')
  }

  const valid = await consumePasswordResetOtp(user.id, code)
  if (!valid) {
    throw new HttpError(400, 'INVALID_RESET_CODE', 'Invalid or expired reset code')
  }

  const passwordHash = await hashPassword(newPassword)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

  // Password change invalidates every outstanding session.
  await prisma.session.deleteMany({ where: { userId: user.id } })

  res.json({ ok: true })
}

/**
 * Authenticates a user with email/password and returns JWT tokens.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginBody

  const user = await findAndVerifyUser(email, password)
  if (!user) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
  }

  if (user.status !== 'ACTIVE') {
    throw new HttpError(403, 'ACCOUNT_SUSPENDED', 'This account is not active')
  }

  // Generate access token
  const accessTokenPayload = generateTokenPayload(user.id, user.email, env.JWT_EXPIRES_IN)
  const accessToken = jwt.sign(accessTokenPayload, env.JWT_SECRET, { algorithm: 'HS256' })

  // Generate refresh token (random UUID)
  const refreshToken = crypto.randomUUID()

  // Store refresh token hash in sessions table
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  })

  // Return user profile and tokens
  const userProfile = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    status: user.status,
    // Role-specific profiles will be loaded by the frontend via /me if needed
  }

  res.json({
    user: userProfile,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
    },
  })
}

/**
 * Google sign-in — verifies the Firebase ID token from the browser and either
 * finds the platform user by email or creates a fresh one, then returns local
 * JWT tokens (same contract as login).
 *
 * `needsProfile: true` means the user has no role profile yet — a brand-new
 * Google account. The frontend sends them to /register to pick a role and
 * (now compulsory) phone number before their dashboard.
 */
export async function googleLogin(req: Request, res: Response): Promise<void> {
  const { idToken } = req.body as GoogleAuthBody

  const identity = await verifyGoogleIdToken(idToken)

  const existing = await prisma.user.findUnique({
    where: { email: identity.email },
    include: { donor: true, ngo: true, volunteer: true },
  })

  let user: {
    id: string
    email: string
    fullName: string
    role: string
    status: string
    donor: unknown
    ngo: unknown
    volunteer: unknown
  }
  if (existing) {
    if (existing.status !== 'ACTIVE') {
      throw new HttpError(403, 'ACCOUNT_SUSPENDED', 'This account is not active')
    }
    user = existing
  } else {
    // First time this Google account signs in — create the platform user with
    // no password (password auth stays separate). Profile completion (role +
    // phone) happens through POST /auth/register.
    user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: identity.email,
        fullName: identity.name || '',
        passwordHash: null,
        phone: null,
        role: 'DONOR', // provisional; updated during profile registration
        status: 'ACTIVE',
      },
      include: { donor: true, ngo: true, volunteer: true },
    })
  }

  // Local token pair, exactly like password login.
  const accessTokenPayload = generateTokenPayload(user.id, user.email, env.JWT_EXPIRES_IN)
  const accessToken = jwt.sign(accessTokenPayload, env.JWT_SECRET, { algorithm: 'HS256' })
  const refreshToken = crypto.randomUUID()
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  })

  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: null,
      status: user.status,
    },
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
    },
    needsProfile: !user.donor && !user.ngo && !user.volunteer,
  })
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
    tokens = await refreshLocalToken(refreshToken)
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
