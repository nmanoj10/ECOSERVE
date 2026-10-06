import { useEffect, useState } from 'react'

import type { User } from '@/services/local-auth'
import { getAccessToken, getCurrentUser } from '@/services/local-auth'
import { registerSession } from '@/api/auth'

/** State for the local auth hook. */
export interface AuthState {
  user: User | null
  loading: boolean
}

/** Subscribes to the local auth state and exposes the current user. */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // On mount, try to restore session from stored access token
    const token = getAccessToken()
    if (token) {
      getCurrentUser().then((currentUser) => {
        if (currentUser) {
          setUser(currentUser)
          // Register the refresh token server-side so it's tracked + revocable
          const storedRefresh = localStorage.getItem('refreshToken')
          if (storedRefresh) {
            registerSession(storedRefresh).catch(() => {})
          }
        }
        setLoading(false)
      })
    } else {
      setLoading(false)
    }

    // Note: With local JWTs, auth state changes are handled explicitly
    // (e.g., on login/logout) rather than via a Supabase auth listener.
    // You can add websocket-based notifications later if needed.

    return () => {}
  }, [])

  return { user, loading }
}