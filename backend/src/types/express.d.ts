import type { AuthClaims, AuthUser } from './auth.js'

declare global {
  namespace Express {
    interface Request {
      /** Verified Supabase token claims — set by `verifyToken`. */
      auth?: AuthClaims
      /** Platform user loaded from the database — set by `authRequired`. */
      user?: AuthUser
    }
  }
}

export {}
