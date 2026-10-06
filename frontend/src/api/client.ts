import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'

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
          // Refresh failed (e.g., revoked token) — clear auth state
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('tokenExpiry')
        }
      }
    }

    return Promise.reject(error)
  },
)