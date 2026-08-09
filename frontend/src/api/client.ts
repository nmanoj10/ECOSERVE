import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'

import { supabase } from '@/services/supabase'

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach the Supabase access token to every request.
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, refresh the session once via supabase-js (keeps the client session in
// sync) and retry the original request. Falls through to the caller if refresh
// fails (e.g. the refresh token was revoked).
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true

      const { data, error: refreshError } = await supabase.auth.refreshSession()
      if (!refreshError && data.session) {
        original.headers.Authorization = `Bearer ${data.session.access_token}`
        return api(original)
      }
    }

    return Promise.reject(error)
  },
)
