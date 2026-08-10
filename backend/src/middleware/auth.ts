import type { NextFunction, Request, Response } from 'express'

import { prisma } from '../config/prisma.js'
import { verifySupabaseToken } from '../config/supabase.js'
import { HttpError } from '../utils/HttpError.js'

/** Reads + verifies the Bearer token. Throws HttpError on any failure. */
async function extractClaims(req: Request): Promise<{ sub: string; email?: string }> {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization header')
  }

  try {
    const payload = await verifySupabaseToken(header.slice('Bearer '.length))
    return { sub: payload.sub, email: payload.email }
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired token')
  }
}

/**
 * Verifies the Supabase JWT and attaches its claims to `req.auth`.
 * Does NOT require the user to exist in the database (used by registration).
 * Note: relies on Express 5 forwarding rejected promises to the error handler.
 */
export async function verifyToken(req: Request, _res: Response, next: NextFunction): Promise<void> {
  req.auth = await extractClaims(req)
  next()
}

/**
 * Verifies the token and loads the platform user, attaching them to
 * `req.auth` (claims) and `req.user` (user row). Throws 401 when the token is
 * invalid or the user is not registered. Shared by `authRequired` and the
 * `authorize()` role middleware.
 */
export async function loadAuthUser(req: Request): Promise<void> {
  const claims = await extractClaims(req)
  req.auth = claims

  const user = await prisma.user.findUnique({ where: { id: claims.sub } })
  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'User not registered')
  }

  // Phase 32, Step 82 — suspended accounts are blocked platform-wide. The
  // access token may still be valid, but every protected call goes through
  // here, so a suspended user is locked out immediately.
  if (user.status === 'SUSPENDED') {
    throw new HttpError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended. Contact an administrator.')
  }

  req.user = { userId: user.id, role: user.role, email: user.email }
}

/**
 * Full authentication: verifies the Supabase JWT AND requires the user to
 * exist in the `users` table, then attaches the platform user to `req.user`.
 */
export async function authRequired(req: Request, _res: Response, next: NextFunction): Promise<void> {
  await loadAuthUser(req)
  next()
}
