import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Moon,
  Navigation,
  PackageCheck,
  Soup,
  Star,
  Timer,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { fetchVolunteerAnalytics, type VolunteerAnalytics } from '@/api/analytics'
import { fetchMe } from '@/api/auth'
import { useDeliveryTracking } from '@/hooks/useDeliveryTracking'
import {
  completeDelivery,
  fetchRescueSpots,
  fetchVolunteerDashboard,
  startDelivery,
  updateVolunteerAvailability,
  type RescueSpotsResponse,
  type VolunteerAvailability,
  type VolunteerDashboard,
} from '@/api/volunteer'
import RescueSpotsPanel, { RescueSpotsPanelSkeleton } from '@/components/rescue/RescueSpotsPanel'
import { CountUp } from '@/components/home/CountUp'
import DashboardShell from '@/components/layout/DashboardShell'
import NotificationsCard from '@/components/notifications/NotificationsCard'
import { DeliveryMap } from '@/components/maps/DeliveryMap'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { volunteerNav } from '@/pages/volunteer/nav'
import type { UserProfile } from '@/types/user'

const availabilityOptions: Array<{
  value: VolunteerAvailability
  label: string
  icon: LucideIcon
  activeClass: string
}> = [
  { value: 'AVAILABLE', label: 'Available', icon: CheckCircle2, activeClass: 'bg-emerald-500 text-white shadow-sm' },
  { value: 'BUSY', label: 'Busy', icon: Timer, activeClass: 'bg-amber-500 text-white shadow-sm' },
  { value: 'OFFLINE', label: 'Offline', icon: Moon, activeClass: 'bg-neutral-500 text-white shadow-sm' },
]

const availabilityBadge: Record<VolunteerAvailability, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  AVAILABLE: { label: 'Available', variant: 'success' },
  BUSY: { label: 'Busy', variant: 'warning' },
  OFFLINE: { label: 'Offline', variant: 'neutral' },
}

const timelineSteps = [
  { type: 'assigned', label: 'Assigned' },
  { type: 'accepted', label: 'Accepted' },
  { type: 'in_transit', label: 'In transit' },
  { type: 'completed', label: 'Delivered' },
] as const

function KpiCard({ icon: Icon, label, value, suffix, decimals = 0, tone }: { icon: LucideIcon; label: string; value: number; suffix?: string; decimals?: number; tone: string }) {
  return (
    <Card className="transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="py-5">
        <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="size-5" />
        </span>
        <p className="mt-4">
          <CountUp target={value} suffix={suffix ?? ''} decimals={decimals} className="text-3xl font-semibold tracking-tight text-neutral-900" />
        </p>
        <p className="mt-1 text-sm font-medium text-neutral-600">{label}</p>
      </CardContent>
    </Card>
  )
}

/** "2026-02" → "Feb" for chart axes. */
function monthShort(isoMonth: string): string {
  const [year, month] = isoMonth.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en', { month: 'short' })
}

function ChartTooltip({
  active,
  payload,
  label,
  valueLabel = (value: number) => String(value),
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  valueLabel?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 shadow-lg">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-sm font-semibold text-neutral-900">{valueLabel(Number(payload[0].value))}</p>
    </div>
  )
}

export default function VolunteerDashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [dashboard, setDashboard] = useState<VolunteerDashboard | null>(null)
  const [availability, setAvailability] = useState<VolunteerAvailability>('OFFLINE')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [analytics, setAnalytics] = useState<VolunteerAnalytics | null>(null)
  // Phase 45 — rescue & handout spots for an accepted rescue alert (?rescue=<donationId>)
  // or the current assignment's pickup.
  const [rescue, setRescue] = useState<RescueSpotsResponse | null>(null)
  const [rescueLoading, setRescueLoading] = useState(false)
  const [rescueError, setRescueError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const rescueDonationId = searchParams.get('rescue')

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [me, stats, analyticsData] = await Promise.all([
        fetchMe(),
        fetchVolunteerDashboard(),
        fetchVolunteerAnalytics().catch(() => null),
      ])
      setProfile(me.user)
      setDashboard(stats)
      setAvailability(stats.availability)
      setAnalytics(analyticsData)
    } catch (err) {
      // Silent refreshes keep the current view — the caller already handled the
      // failure (optimistic revert + toast) and shouldn't get a full-page error.
      if (opts?.silent) return
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

  // Realtime: refresh dashboard data every minute so statuses/KPIs stay current.
  useEffect(() => {
    const id = setInterval(() => void load({ silent: true }), 60_000)
    return () => clearInterval(id)
  }, [load])

  /** Step 58 — toggle availability, optimistically. */
  const handleAvailability = async (value: VolunteerAvailability) => {
    if (value === availability || saving) return
    const previous = availability
    setAvailability(value)
    setSaving(true)
    try {
      await updateVolunteerAvailability(value)
      toast({
        variant: 'success',
        title: 'Availability updated',
        description: `You're now ${value === 'AVAILABLE' ? 'available for rescue deliveries' : value.toLowerCase()}.`,
      })
      load({ silent: true })
    } catch (err) {
      setAvailability(previous)
      toast({
        variant: 'error',
        title: 'Update failed',
        description:
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Something went wrong — try again',
      })
    } finally {
      setSaving(false)
    }
  }

  /** Phase 22, Step 61 — pick up the food and begin transit + live tracking. */
  const handleStartPickup = async () => {
    const deliveryId = assignment?.delivery?.id
    if (!deliveryId || starting) return
    setStarting(true)
    try {
      await startDelivery(deliveryId)
      toast({
        variant: 'success',
        title: 'Pickup started',
        description: 'You picked up the food — your live location is now shared with the donor and NGO.',
      })
      load({ silent: true })
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not start pickup',
        description:
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Something went wrong — try again',
      })
    } finally {
      setStarting(false)
    }
  }

  /** Phase 29, Step 75 — finish the active delivery, then refresh the dashboard. */
  const handleComplete = async () => {
    const deliveryId = assignment?.delivery?.id
    if (!deliveryId || completing) return
    setCompleting(true)
    try {
      await completeDelivery(deliveryId)
      toast({
        variant: 'success',
        title: 'Delivery completed',
        description: 'The donor and NGO have been notified — thanks for saving food!',
      })
      load({ silent: true })
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not complete delivery',
        description:
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Something went wrong — try again',
      })
    } finally {
      setCompleting(false)
    }
  }

  const firstName = profile?.fullName?.split(' ')[0] ?? user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'
  const assignment = dashboard?.currentAssignment ?? null
  const badge = availabilityBadge[availability]
  const timelineTypes = new Set(assignment?.timeline.map((entry) => entry.type) ?? [])
  const etaLabel = assignment?.delivery?.eta
    ? new Date(assignment.delivery.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  // Phase 45 — rescue map: an accepted rescue alert (?rescue=<donationId>)
  // takes priority; otherwise fall back to the current assignment's pickup.
  useEffect(() => {
    let active = true

    const fetchSpots = async (donationId?: string) => {
      setRescueLoading(true)
      setRescueError(null)
      try {
        const data = await fetchRescueSpots(donationId)
        if (active) setRescue(data)
      } catch (err) {
        // The donation may have been claimed while the alert sat in the inbox.
        if (active) {
          setRescue(null)
          setRescueError(
            (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
              'Could not load the rescue map',
          )
        }
      } finally {
        if (active) setRescueLoading(false)
      }
    }

    if (rescueDonationId) {
      void fetchSpots(rescueDonationId)
      return () => {
        active = false
      }
    }

    if (!assignment?.donation.id || !assignment.pickup) {
      setRescue(null)
      setRescueError(null)
      return
    }
    void fetchSpots()

    return () => {
      active = false
    }
  }, [rescueDonationId, assignment?.donation.id, assignment?.pickup?.latitude, assignment?.pickup?.longitude])

  // Phase 25, Step 66 — GPS tracking while in transit.
  const isTransit = assignment?.status === 'IN_TRANSIT'
  const { isTracking, position, error: trackingError } = useDeliveryTracking(assignment?.delivery?.id, isTransit)

  // Phase 45 — the volunteer's saved location pin, used as the route origin so
  // the map shows the full journey: you → donor (pickup) → NGO (drop-off).
  // Only used before the pickup: once in transit the live GPS marker takes over.
  const volunteerPin =
    !isTransit && profile?.volunteer?.currentLatitude != null && profile?.volunteer?.currentLongitude != null
      ? { latitude: profile.volunteer.currentLatitude, longitude: profile.volunteer.currentLongitude }
      : null

  // Step 79 — completed runs per month for the impact chart.
  const monthlyDeliveries = (analytics?.byMonth ?? []).map((point) => ({
    month: monthShort(point.month),
    deliveries: point.deliveries,
  }))

  return (
    <DashboardShell roleLabel="Volunteer" nav={volunteerNav} title="Volunteer dashboard" subtitle="Deliver surplus food, rescue what's left">
      {error ? (
        <ErrorState description={error} onRetry={() => load()} />
      ) : (
        <>
          {/* Header + Step 58 availability switcher */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Welcome back, {firstName}.</h2>
              <p className="mt-1 text-sm text-neutral-500">Your routes, rescue alerts and impact at a glance.</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={badge.variant} dot>
                {badge.label}
              </Badge>
              <div className="flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
                {availabilityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={saving}
                    onClick={() => handleAvailability(option.value)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      availability === option.value ? option.activeClass : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    {saving && availability === option.value ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <option.icon className="size-3.5" />
                    )}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 57 — KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loading || !dashboard
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="py-5">
                      <Skeleton className="size-10 rounded-xl" />
                      <Skeleton className="mt-4 h-8 w-20" />
                      <Skeleton className="mt-2 h-4 w-24" />
                    </CardContent>
                  </Card>
                ))
              : [
                  { icon: Truck, label: "Today's deliveries", value: dashboard.todayDeliveries, tone: 'text-brand-600 bg-brand-50' },
                  { icon: Navigation, label: 'Distance', value: dashboard.distanceKm, suffix: ' km', tone: 'text-emerald-600 bg-emerald-50' },
                  { icon: Soup, label: 'Meals delivered', value: dashboard.mealsDelivered, tone: 'text-teal-600 bg-teal-50' },
                  { icon: Star, label: 'Rating', value: dashboard.rating, decimals: 1, suffix: ' / 5', tone: 'text-amber-600 bg-amber-50' },
                ].map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
          </div>

          {/* Current assignment + map */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Current assignment</CardTitle>
                  <CardDescription>Your active delivery run</CardDescription>
                </div>
                {assignment && (
                  <Badge variant={assignment.status === 'IN_TRANSIT' ? 'brand' : assignment.status === 'PENDING' ? 'warning' : 'neutral'} dot>
                    {assignment.status === 'IN_TRANSIT' ? 'In transit' : assignment.status === 'PENDING' ? 'Pending' : 'Accepted'}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {loading || !dashboard ? (
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : !assignment ? (
                  rescueDonationId ? (
                    <EmptyState
                      icon={Truck}
                      title="Rescue mission accepted"
                      description="The donor pickup and handout spots are below — take the food and hand it out at the nearest railway station, bus stand or shelter."
                    />
                  ) : (
                    <EmptyState
                      icon={Truck}
                      title="No active delivery"
                      description="Set yourself as Available and you'll be matched with the next pickup — including rescue alerts for food about to expire."
                    />
                  )
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-neutral-900">{assignment.donation.foodName}</p>
                        <p className="text-sm text-neutral-500">
                          {assignment.donation.quantity} {assignment.donation.unit} · {assignment.donation.category}
                        </p>
                      </div>
                      {etaLabel && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                          <Clock className="size-3.5" /> ETA {etaLabel}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5 text-sm">
                      <p className="flex items-start gap-2.5 text-neutral-700">
                        <Bike className="mt-0.5 size-4 shrink-0 text-brand-600" />
                        <span>
                          <span className="font-medium text-neutral-900">{assignment.donation.donorOrganization}</span>
                          <span className="block text-xs text-neutral-500">{assignment.donation.pickupAddress}</span>
                        </span>
                      </p>
                      <p className="flex items-start gap-2.5 text-neutral-700">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-amber-500" />
                        <span>
                          <span className="font-medium text-neutral-900">Drop-off</span>
                          <span className="block text-xs text-neutral-500">{assignment.delivery?.dropLocation ?? 'To be confirmed'}</span>
                        </span>
                      </p>
                    </div>

                    {/* Delivery timeline */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {timelineSteps.map((step, i) => {
                        const done = timelineTypes.has(step.type)
                        return (
                          <div key={step.type} className="flex flex-1 flex-col items-center gap-1.5">
                            <span
                              className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                                done ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-400'
                              }`}
                            >
                              {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
                            </span>
                            <span className={`text-[11px] ${done ? 'text-brand-700' : 'text-neutral-400'}`}>{step.label}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Phase 22, Step 61 — pick up the food; live GPS sharing starts here. */}
                    {assignment?.delivery?.status === 'VOLUNTEER_ASSIGNED' && (
                      <Button onClick={handleStartPickup} disabled={starting} className="w-full">
                        {starting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <PackageCheck className="size-4" />
                        )}
                        {starting ? 'Starting…' : 'Start pickup · begin live tracking'}
                      </Button>
                    )}

                    {/* Phase 29, Step 75 — finish the run once the food is handed over. */}
                    {isTransit && assignment?.delivery && (
                      <Button onClick={handleComplete} disabled={completing} className="w-full">
                        {completing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        {completing ? 'Completing…' : 'Mark as delivered'}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 57 — Map (Phase 45: full journey you → donor → NGO) */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Route</CardTitle>
                  <CardDescription>
                    {volunteerPin ? 'You → donor pickup → NGO drop-off' : 'Pickup to drop-off'}
                  </CardDescription>
                </div>
                {isTracking && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 ring-1 ring-blue-200/50">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-2 animate-ping rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
                    </span>
                    Live tracking
                  </span>
                )}
                {trackingError && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 ring-1 ring-red-200/50">
                    <AlertTriangle className="size-3.5" />
                    Location unavailable: {trackingError}
                  </span>
                )}
              </CardHeader>
              <CardContent>
                {assignment?.pickup && assignment.drop ? (
                  <DeliveryMap
                    pickup={assignment.pickup}
                    drop={assignment.drop}
                    pickupLabel={assignment.donation.donorOrganization}
                    dropLabel={assignment.delivery?.dropLocation ?? 'Drop-off'}
                    currentLocation={position}
                    origin={volunteerPin}
                    originLabel="Your location"
                  />
                ) : (
                  <EmptyState
                    icon={MapPin}
                    title="No route to show"
                    description="The route map appears when a delivery has pickup and drop-off coordinates."
                    className="py-10"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Phase 45 — rescue & handout spots: donor location + nearby stations/bus stands/shelters */}
          {rescueLoading ? (
            <RescueSpotsPanelSkeleton />
          ) : rescue ? (
            <RescueSpotsPanel data={rescue} />
          ) : rescueError ? (
            <Card className="mt-6">
              <CardContent className="py-6 text-center">
                <AlertTriangle className="mx-auto size-8 text-amber-500" />
                <p className="mt-2 text-sm font-medium text-neutral-900">Rescue not available</p>
                <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500">{rescueError}</p>
              </CardContent>
            </Card>
          ) : null}

          {/* Recent deliveries */}
          <Card className="mt-6">
            <CardHeader>
              <div>
                <CardTitle>Recent deliveries</CardTitle>
                <CardDescription>Your completed delivery history</CardDescription>
              </div>
              <Badge variant="neutral">{dashboard?.totalDeliveries ?? 0} all time</Badge>
            </CardHeader>
            <CardContent>
              {loading || !dashboard ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : dashboard.recentDeliveries.length === 0 ? (
                <EmptyState
                  icon={Truck}
                  title="No deliveries yet"
                  description="Once you complete a delivery it will show up here with the route and distance."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Food</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Distance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.recentDeliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell className="font-medium text-neutral-900">{delivery.foodName}</TableCell>
                        <TableCell>
                          {delivery.donorOrganization}
                          {delivery.ngoName ? ` → ${delivery.ngoName}` : ''}
                        </TableCell>
                        <TableCell>{delivery.distance != null ? `${delivery.distance} km` : '—'}</TableCell>
                        <TableCell>
                          <Badge variant={delivery.status === 'DELIVERED' ? 'success' : 'neutral'} dot>
                            {delivery.status === 'DELIVERED' ? 'Delivered' : delivery.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-neutral-500">
                          {delivery.completedAt ? new Date(delivery.completedAt).toLocaleDateString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Step 79 — Volunteer analytics */}
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div>
                    <CardTitle>Deliveries by month</CardTitle>
                    <CardDescription>Completed runs per month, last 6 months</CardDescription>
                  </div>
                  <Badge variant="success" dot>
                    Live
                  </Badge>
                </CardHeader>
                <CardContent>
                  {loading || !analytics ? (
                    <Skeleton className="h-56 w-full rounded-xl" />
                  ) : monthlyDeliveries.every((point) => point.deliveries === 0) ? (
                    <p className="py-10 text-center text-sm text-neutral-500">
                      No completed deliveries yet — your monthly stats will appear here.
                    </p>
                  ) : (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyDeliveries} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 12, fill: '#a3a3a3' }}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                          />
                          <Tooltip
                            content={<ChartTooltip valueLabel={(value) => `${value} deliveries`} />}
                            cursor={{ fill: '#fafafa' }}
                          />
                          <Bar dataKey="deliveries" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <NotificationsCard role="VOLUNTEER" />
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  )
}
