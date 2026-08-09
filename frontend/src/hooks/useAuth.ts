import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

import { registerSession } from '@/api/auth'
import { supabase } from '@/services/supabase'

/** Subscribes to the Supabase auth state and exposes the current session. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setLoading(false)

      // Record the session server-side so refresh tokens are tracked + revocable.
      if (newSession?.refresh_token && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        registerSession(newSession.refresh_token).catch(() => {})
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return { session, user: session?.user ?? null, loading }
}
