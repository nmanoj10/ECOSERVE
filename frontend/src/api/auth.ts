import type { UserProfile } from '@/types/user'

import { api } from './client'

export interface RegisterPayload {
  fullName: string
  role: 'DONOR' | 'NGO' | 'VOLUNTEER'
  phone?: string
  donor?: {
    organizationName: string
    organizationType: string
    address: string
    city: string
    state: string
  }
  ngo?: {
    ngoName: string
    registrationNumber: string
    address: string
    city: string
    state: string
    description?: string
  }
  volunteer?: {
    vehicleType?: string
    vehicleNumber?: string
  }
}

export interface RegisterResponse {
  user: UserProfile
}

export interface SessionInfo {
  id: string
  createdAt: string
  expiresAt: string
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/** Creates/updates the platform user row (requires a valid Supabase session). */
export async function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  const { data } = await api.post<RegisterResponse>('/v1/auth/register', payload)
  return data
}

/**
 * Creates a Supabase auth user that is already email-confirmed via the backend
 * (`POST /v1/auth/signup` — no confirmation email is sent). Used when the
 * standard `signUp` doesn't hand back a session: the project still has
 * "Confirm email" enabled or the free-plan email quota is exhausted. The
 * caller signs in with the password right after, so signup is instant.
 */
export async function createConfirmedAuthUser(email: string, password: string): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>('/v1/auth/signup', { email, password })
  return data
}

/**
 * Saves the registration form server-side before email confirmation, so the
 * confirmation-link landing can complete the profile even when the link is
 * opened in a different browser or device (where localStorage is empty).
 * Best-effort: returns null when the backend is unreachable (the caller falls
 * back to the localStorage copy for the same-browser round trip).
 */
export async function savePendingRegistration(
  email: string,
  payload: RegisterPayload,
): Promise<{ id: string } | null> {
  try {
    const res = await api.post<{ registration: { id: string } }>('/v1/auth/pending-registrations', { email, payload })
    return res?.data?.registration ?? null
  } catch {
    return null
  }
}

/** Fetches the authenticated user's saved registration form (if any). */
export async function getPendingRegistration(): Promise<{ email: string; payload: RegisterPayload } | null> {
  try {
    const res = await api.get<{ registration: { email: string; payload: RegisterPayload } | null }>(
      '/v1/auth/pending-registrations/current',
    )
    return res?.data?.registration ?? null
  } catch {
    return null
  }
}

/** Fetches the authenticated user with their role profile. */
export async function fetchMe(): Promise<RegisterResponse> {
  const { data } = await api.get<RegisterResponse>('/v1/auth/me')
  return data
}

/**
 * Exchanges a refresh token for a fresh access/refresh pair via the backend
 * (`POST /v1/auth/refresh`). This wrapper documents the server-side flow and
 * serves non-browser clients. The axios request interceptor (client.ts) handles
 * token refresh automatically using the refresh token from localStorage, so
 * callers typically don't need to use this directly.
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse> {
  const { data } = await api.post<RefreshResponse>('/v1/auth/refresh', { refreshToken })
  return data
}

/** Records the current session server-side so its refresh token is revocable. */
export async function registerSession(refreshToken: string): Promise<{ session: SessionInfo }> {
  const { data } = await api.post<{ session: SessionInfo }>('/v1/auth/sessions', { refreshToken })
  return data
}

/** Lists the authenticated user's active sessions. */
export async function listSessions(): Promise<{ sessions: SessionInfo[] }> {
  const { data } = await api.get<{ sessions: SessionInfo[] }>('/v1/auth/sessions')
  return data
}

/** Revokes a single session (its refresh token can no longer be exchanged). */
export async function revokeSession(id: string): Promise<void> {
  await api.delete(`/v1/auth/sessions/${id}`)
}

/** Revokes the user's recorded sessions server-side (call alongside signOut). */
export async function logout(refreshToken: string): Promise<void> {
  await api.post('/v1/auth/logout', { refreshToken })
}
