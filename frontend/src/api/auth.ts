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

/** Fetches the authenticated user with their role profile. */
export async function fetchMe(): Promise<RegisterResponse> {
  const { data } = await api.get<RegisterResponse>('/v1/auth/me')
  return data
}

/**
 * Exchanges a refresh token for a fresh access/refresh pair via the backend
 * (`POST /auth/refresh`). The axios interceptor deliberately uses supabase-js
 * `refreshSession()` instead, so the client session stays in sync; this wrapper
 * documents the server-side flow and serves non-browser clients.
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
