import { Bike, LayoutDashboard } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { fetchMe } from '@/api/auth'
import DashboardShell from '@/components/layout/DashboardShell'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import type { UserProfile } from '@/types/user'

const nav = [{ label: 'Overview', to: '/volunteer', icon: LayoutDashboard, end: true }]

export default function VolunteerDashboardPage() {
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
    <DashboardShell
      roleLabel="Volunteer"
      nav={nav}
      title="Volunteer dashboard"
      subtitle="Your profile is live — delivery features arrive in the next phases"
    >
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
                    <dt className="text-neutral-500">Phone</dt>
                    <dd className="font-medium">{profile?.phone ?? '—'}</dd>
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
                <Bike className="size-4 text-brand-600" />
                <CardTitle>Delivery profile</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : profile?.volunteer ? (
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Vehicle</dt>
                    <dd className="font-medium">{profile.volunteer.vehicleType ?? '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Vehicle number</dt>
                    <dd className="font-medium">{profile.volunteer.vehicleNumber ?? '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Availability</dt>
                    <dd className="font-medium">{profile.volunteer.availability}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Rating</dt>
                    <dd className="font-medium">{profile.volunteer.rating} / 5</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500">Deliveries</dt>
                    <dd className="font-medium">{profile.volunteer.totalDeliveries}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-neutral-500">No volunteer profile found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  )
}
