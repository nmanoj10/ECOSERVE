/**
 * Local authentication service — replaces Supabase client with backend JWT auth.
 * 
 * The backend (ecoserve-backend) now handles auth locally using PostgreSQL
 * and JWT tokens signed with JWT_SECRET. This service calls the backend's
 * local auth endpoints (/api/v1/auth/*) via the Vite dev proxy.
 * In production, the frontend and API share the same origin.
 */

export interface User {
  id: string
  email: string
  fullName?: string
  role: 'DONOR' | 'NGO' | 'VOLUNTEER'
  phone?: string
  status: 'ACTIVE' | 'SUSPENDED'
  // Role-specific profiles
  donor?: {
    organizationName?: string
    organizationType?: string
    address?: string
    city?: string
    state?: string
    latitude?: number
    longitude?: number
  }
  ngo?: {
    ngoName?: string
    registrationNumber?: string
    address?: string
    city?: string
    state?: string
    latitude?: number
    longitude?: number
  }
  volunteer?: {
    vehicleType?: string
    availability?: string
    latitude?: number
    longitude?: number
  }
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/** Sign up a new user (creates confirmed account in local PostgreSQL) */
export async function signup(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
  const res = await fetch('/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    throw toServerError(await readJson(res), 'Signup failed')
  }

  // The signup endpoint only returns { ok: true }, we need to call login to get tokens
  return login(email, password)
}

/** Log in with email/password - gets JWT tokens from backend */
export async function login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    throw toServerError(await readJson(res), 'Login failed')
  }

  const data = await res.json() // { user, tokens }
  return data
}

/**
 * Requests a password-reset OTP for the given email. The backend always
 * responds 200 (anti-enumeration), so this resolves even for unregistered
 * addresses — the UI shows the same "code sent" message either way.
 */
/**
 * Google sign-in — exchanges a Firebase ID token (obtained client-side from
 * `firebase`'s Google popup) for local JWT tokens via the backend. The backend
 * verifies the token against Google's public keys before minting anything.
 * `needsProfile` is true for brand-new Google accounts that still have to pick
 * a role and phone number.
 */
export async function googleLogin(
  idToken: string,
): Promise<{ user: User; tokens: AuthTokens; needsProfile: boolean }> {
  const res = await fetch('/api/v1/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })

  if (!res.ok) {
    throw toServerError(await readJson(res), 'Google login failed')
  }

  return res.json() // { user, tokens, needsProfile }
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await fetch('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!res.ok) {
    throw toServerError(await readJson(res), 'Could not send reset code')
  }
}

/**
 * Verifies the emailed OTP and sets a new password. On success the backend
 * revokes every existing session, so the user signs in again afterwards.
 */
export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const res = await fetch('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  })

  if (!res.ok) {
    throw toServerError(await readJson(res), 'Could not reset password')
  }
}

/** Reads the (optional) error body so non-2xx responses surface a real message. */
async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

/**
 * The backend error contract is `{ error: { code, message } }` — unwrap it (and
 * tolerate a plain `{ message }` / non-JSON body) instead of throwing a generic
 * "Login failed" / "Signup failed" that errors guessing.
 */
function toServerError(body: unknown, fallback: string): Error {
  const unwrapped = (body as { error?: { message?: string } } | null)?.error?.message
  const plain = (body as { message?: string } | null)?.message
  return new Error(unwrapped ?? plain ?? fallback)
}

/** Get current user profile (refreshes from backend) */
export async function getCurrentUser(): Promise<User | null> {
  const res = await fetch('/api/v1/auth/me', {
    headers: {
      Authorization: `Bearer ${(await localStorage.getItem('accessToken')) || ''}`,
    },
  })

  if (!res.ok) return null
  return res.json()
}

/** Log out - clears tokens */
export function logout(): void {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
}

/** Accept token from login/signup flow and store it */
export function setTokens(tokens: AuthTokens): void {
  localStorage.setItem('accessToken', tokens.accessToken)
  localStorage.setItem('refreshToken', tokens.refreshToken)
}

/** Get access token for API calls */
export function getAccessToken(): string | null {
  return localStorage.getItem('accessToken')
}