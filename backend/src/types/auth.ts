import type { Role } from '../generated/prisma/client.js'

/** Claims extracted from a verified Supabase access token. */
export interface AuthClaims {
  sub: string
  email?: string
}

/** Authenticated platform user attached to the request by `authRequired`. */
export interface AuthUser {
  userId: string
  role: Role
  email: string
}
