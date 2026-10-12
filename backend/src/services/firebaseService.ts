import { createRemoteJWKSet, jwtVerify } from 'jose'

import { env } from '../config/env.js'
import { HttpError } from '../utils/HttpError.js'

export interface GoogleIdentity {
  uid: string
  email: string
  name: string
  picture?: string
}

/**
 * Firebase ID tokens are signed with Google's shared securetoken key set
 * (RS256) — the same keys for every Firebase project. The issuer + audience
 * claims are what scope a token to THIS project, so both are enforced.
 */
const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

/** True when Google sign-in is usable (the Firebase project is configured). */
export function isFirebaseConfigured(): boolean {
  return Boolean(env.FIREBASE_PROJECT_ID)
}

function rejectInvalid(message: string): never {
  throw new HttpError(401, 'INVALID_ID_TOKEN', message)
}

/**
 * Verifies a Firebase Auth ID token produced by a Google sign-in and returns
 * the identity claims. Rejects tokens that aren't for this project, weren't
 * signed by Google, have expired, or whose email isn't verified.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  if (!env.FIREBASE_PROJECT_ID) {
    throw new HttpError(503, 'GOOGLE_AUTH_DISABLED', 'Google sign-in is not configured')
  }

  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL))
  }

  let payload: Record<string, unknown>
  try {
    const verified = await jwtVerify(idToken, jwks, { algorithms: ['RS256'] })
    payload = verified.payload as Record<string, unknown>
  } catch {
    rejectInvalid('Invalid or expired Google token')
  }

  const expectedIssuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`
  if (payload.iss !== expectedIssuer) {
    rejectInvalid('Token was not issued for this project')
  }
  // `aud` is the Firebase project NUMBER. Only enforced when configured (older
  // projects sometimes leave it unset); the issuer check already scopes tokens.
  if (env.FIREBASE_PROJECT_NUMBER && payload.aud !== env.FIREBASE_PROJECT_NUMBER) {
    rejectInvalid('Token audience does not match this project')
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    rejectInvalid('Token missing subject claim')
  }

  const email = typeof payload.email === 'string' ? payload.email : ''
  if (!email || payload.email_verified !== true) {
    rejectInvalid('Google account has no verified email')
  }

  return {
    uid: payload.sub,
    email,
    name: typeof payload.name === 'string' ? payload.name : '',
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  }
}