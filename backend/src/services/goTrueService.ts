import { env } from '../config/env.js'
import { HttpError } from '../utils/HttpError.js'

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/**
 * Exchanges a refresh token for a fresh token pair via the GoTrue token
 * endpoint. GoTrue rotates the refresh token on every successful exchange.
 */
export async function refreshWithGoTrue(refreshToken: string): Promise<TokenPair> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  const data = (await res.json().catch(() => null)) as
    | { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; error_description?: unknown }
    | null

  if (!res.ok) {
    if (res.status === 401 || res.status === 400) {
      throw new HttpError(
        401,
        'INVALID_REFRESH_TOKEN',
        typeof data?.error_description === 'string'
          ? data.error_description
          : 'The refresh token was rejected',
      )
    }
    if (res.status === 429) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many refresh attempts, please try again later')
    }
    throw new HttpError(502, 'UPSTREAM_ERROR', `GoTrue refresh failed (HTTP ${res.status})`)
  }

  if (typeof data?.access_token !== 'string' || typeof data?.refresh_token !== 'string') {
    throw new HttpError(502, 'UPSTREAM_ERROR', 'GoTrue returned an unexpected token response')
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 3600,
  }
}
