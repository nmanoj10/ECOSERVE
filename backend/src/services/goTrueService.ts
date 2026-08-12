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

/**
 * Creates a Supabase auth user that is already email-confirmed via the Admin
 * API (`email_confirm: true` — no confirmation email is sent). Powers
 * `POST /auth/signup` so demo signups work instantly even while the project
 * still has "Confirm email" enabled (and sidesteps the free-plan email quota).
 *
 * If the email is already registered (e.g. an earlier signup left an
 * unconfirmed user), the existing account is confirmed instead of failing.
 */
export async function createOrConfirmAuthUser(email: string, password: string): Promise<void> {
  const headers = {
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json',
  }

  const createRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })

  if (createRes.ok) return

  const createData = (await createRes.json().catch(() => null)) as { error_code?: string; msg?: string } | null
  const alreadyRegistered =
    createRes.status === 409 ||
    createRes.status === 422 ||
    createData?.error_code === 'user_already_exists' ||
    (typeof createData?.msg === 'string' && createData.msg.toLowerCase().includes('already been registered'))

  if (alreadyRegistered) {
    // The account exists (possibly unconfirmed from a previous signup) — find
    // it and mark the email confirmed, so login works immediately.
    const listRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      headers,
    })
    const listData = (await listRes.json().catch(() => null)) as { users?: Array<{ id?: string }> } | null
    const userId = listData?.users?.[0]?.id
    if (userId) {
      const updateRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ email_confirm: true }),
      })
      if (updateRes.ok) return
    }
  }

  throw new HttpError(
    400,
    'SIGNUP_FAILED',
    typeof createData?.msg === 'string' ? createData.msg : 'Could not create account',
  )
}
