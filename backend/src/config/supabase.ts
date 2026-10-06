import { jwtVerify } from 'jose'

import { env } from './env.js'

/** A verified local access-token payload. */
export interface VerifiedToken extends Record<string, unknown> {
  sub: string
  email?: string
  iat?: number
  exp?: number
}

/** Verifies a local JWT signed with JWT_SECRET. Throws on invalid/expired tokens. */
export async function verifyLocalToken(token: string): Promise<VerifiedToken> {
  const secret = new TextEncoder().encode(env.JWT_SECRET)
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
  })

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Token payload missing sub claim')
  }

  return payload as VerifiedToken
}
