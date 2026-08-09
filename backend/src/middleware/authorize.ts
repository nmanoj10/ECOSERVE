import type { NextFunction, Request, Response } from 'express'

import type { Role } from '../generated/prisma/client.js'
import { HttpError } from '../utils/HttpError.js'
import { loadAuthUser } from './auth.js'

/**
 * Role-based authorization (Phase 10, Step 35).
 *
 *   router.get('/admin/overview', authorize('ADMIN'), handler)
 *
 * Works standalone — it verifies the token and loads the platform user if
 * `authRequired` hasn't already attached `req.user` (no double lookup). The
 * user's role must be one of the allowed roles, otherwise 403 FORBIDDEN.
 */
export function authorize(...roles: Role[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      await loadAuthUser(req)
    }

    if (!roles.includes(req.user!.role)) {
      throw new HttpError(403, 'FORBIDDEN', `Requires role: ${roles.join(' or ')}`)
    }

    next()
  }
}
