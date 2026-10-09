import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'

// Back-off schedule for non-2xx retries: 250ms, then 500ms.
const RETRY_DELAY_MS = [250, 500]

/**
 * Convert an AxiosError into an Error suitable for the retry loop.
 * The loop needs an `error` object that exposes `response.status` and
 * `config`. Axios errors already satisfy both, but a plain string/unknown
 * rejection does not, so normalize only when it matters.
 */
function toRetryError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(String(error))
}

/**
 * A shape that carries an HTTP status through the retry loop so the
 * exponential-back-off and rate-limit branches can read it without narrowing
 * the type through the recursive call.
 */
interface RetryError extends Error {
  response?: {
    status?: number
    headers?: Record<string, string>
  }
}

/**
 * Applies one unit of the shared retry policy:
 * - awaits a small promise so a useEffect-driven retry can re-render a busy
 *   button (e.g. "Retrying…", spinner),
 * - waits exponentially longer between attempts,
 * - aborts if the response is a rate-limit (403/429) that asks us to wait,
 *   in which case it only retries once (never loops).
 */
async function retryOneAttempt(
  error: RetryError,
  original: InternalAxiosRequestConfig & { _retry?: boolean },
  attempt: number,
): Promise<AxiosError> {
  // Let a caller-driven retry reflect the busy state.
  await new Promise<void>((resolve) => setTimeout(resolve, 0))

  if (attempt >= RETRY_DELAY_MS.length) {
    return Promise.reject(error)
  }

  const status = error.response?.status
  // Rate-limited (403/429): wait as long as the server asks, then retry once.
  // No loop — the next request clears the token refresh path and the caller
  // can retry the whole flow after fixing credentials / quota.
  if (status === 403 || status === 429) {
    const retryAfter = error.response?.headers?.['retry-after'] ?? '0'
    const waitMs = Number(retryAfter) * 1000
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs))
    return api(original)
  }

  const next = error
  return retryOneAttempt(toRetryError(next), original, attempt + 1)
}

/**
 * Returns true when the error is a transient network/5xx fault worth retrying.
 */
function isRetryable(error: AxiosError): boolean {
  return error.response?.status !== undefined && error.response.status >= 500
}

/**
 * Creates an Axios instance that talks to the Ecoserve backend API.
 * Authentication: reads the access token from localStorage and attaches it
 * as a Bearer token on every request. On 401, attempts to refresh the token
 * using the refresh token stored in localStorage.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Get the current access token from localStorage (set by local-auth.ts auth flow)
function getAccessToken(): string | null {
  try {
    return localStorage.getItem('accessToken')
  } catch {
    return null
  }
}

// Attach the local JWT access token to every request.
api.interceptors.request.use(async (config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, attempt to refresh the token using the refresh token from localStorage.
// If refresh succeeds, update the Authorization header and retry the request.
// Falls through to the caller if the refresh token is revoked or expired.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true

      // Try to refresh using the refresh token stored in localStorage
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const response = await api.post('/v1/auth/refresh', { refreshToken })
          const { accessToken, expiresIn } = response.data
          // Store new tokens
          localStorage.setItem('accessToken', accessToken)
          // Recalculate expiry and store
          const expTime = Date.now() + (typeof expiresIn === 'number' ? expiresIn * 1000 : 3600 * 1000)
          localStorage.setItem('tokenExpiry', expTime.toString())
          // Retry original request with new token
          original.headers.Authorization = `Bearer ${accessToken}`
          return api(original)
        } catch (refreshError) {
          // Refresh failed (e.g., revoked token) — clear auth state and give up
          // on the original request. The caller (usually ErrorState) shows a
          // retry button, but this path is terminal: vanilla localStorage tokens
          // cannot be renewed, so looping here would only re-fire 401 forever.
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('tokenExpiry')
          return Promise.reject(toRetryError(refreshError))
        }
      }
    }

    // Transient server/network faults *and* rate-limited (403/429) responses
    // are worth one retry with an exponential back-off. All other 4xx (e.g.
    // 400 validation) fail fast to avoid hiding client-side mistakes.
    if (error.response?.status === 403 || error.response?.status === 429) {
      return retryOneAttempt(toRetryError(error), original, 0)
    }
    if (isRetryable(error)) {
      return retryOneAttempt(toRetryError(error), original, 0)
    }

    return Promise.reject(error)
  },
)