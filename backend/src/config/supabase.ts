import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

import { env } from './env.js'

/** A verified Supabase access-token payload. */
export interface VerifiedToken extends JWTPayload {
  sub: string
  email?: string
}

const jwks = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL))

/** Verifies a Supabase-issued JWT against the project JWKS. Throws on invalid/expired tokens. */
export async function verifySupabaseToken(token: string): Promise<VerifiedToken> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `${env.SUPABASE_URL}/auth/v1`,
    audience: 'authenticated',
  })

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Token payload missing sub claim')
  }

  return payload as VerifiedToken
}
