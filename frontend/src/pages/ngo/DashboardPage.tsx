import { HandHeart, LayoutDashboard } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { fetchMe } from '@/api/auth'
import DashboardShell from '@/components/layout/DashboardShell'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import type { UserProfile } from '@/types/user'

const nav = [{ label: 'Overview', to: '/ngo', icon: LayoutDashboard, end: true }]

export default function NgoDashboardPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { user: me } = await fetchMe()
      setProfile(me)
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Failed to load your dashboard',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <DashboardShell roleLabel="NGO" nav={nav} title="NGO dashboard" subtitle="Your profile is live — NGO features arrive in the next phases">
      {error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Name</dt>
                    <dd className="font-medium">{profile?.fullName ?? user?.user_metadata?.full_name ?? '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Email</dt>
                    <dd className="font-medium">{profile?.email ?? user?.email ?? '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Status</dt>
                    <dd>
                      <Badge variant={profile?.status === 'ACTIVE' ? 'success' : 'neutral'} dot>
                        {profile?.status ?? '—'}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HandHeart className="size-4 text-brand-600" />
                <CardTitle>Organization</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : profile?.ngo ? (
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Name</dt>
                    <dd className="font-medium">{profile.ngo.ngoName}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Registration</dt>
                    <dd className="font-medium">{profile.ngo.registrationNumber}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Location</dt>
                    <dd className="font-medium">
                      {profile.ngo.city}, {profile.ngo.state}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Verification</dt>
                    <dd>
                      <Badge variant="brand">{profile.ngo.verificationStatus}</Badge>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-neutral-500">No NGO profile found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  )
}
