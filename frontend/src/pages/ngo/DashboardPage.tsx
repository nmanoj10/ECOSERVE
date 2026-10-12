import { HandHeart, Loader2, MapPin, Soup, Truck, Users, UtensilsCrossed } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { fetchNgoAnalytics, type NgoAnalytics } from '@/api/analytics'
import { fetchMe } from '@/api/auth'
import { fetchActiveDeliveries, type ActiveDelivery } from '@/api/volunteer'
import {
  createNgoRequest,
  fetchNearbyDonations,
  fetchNgoDashboard,
  fetchNgoRequests,
  type InventoryItem,
  type NearbyDonation,
  type NgoDashboardStats,
  type NgoRequestItem,
} from '@/api/ngo'
import { CountUp } from '@/components/home/CountUp'
import DashboardShell from '@/components/layout/DashboardShell'
import NotificationsCard from '@/components/notifications/NotificationsCard'
import { LiveTrackingMap } from '@/components/maps/LiveTrackingMap'
import { NearbyMap, type NearbyMapDonation } from '@/components/maps/NearbyMap'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { ngoNav } from '@/pages/ngo/nav'
import type { UserProfile } from '@/types/user'

// ── helpers ────────────────────────────────────────────────────────────────

/** Hours until the given ISO timestamp, or null when unknown. */
function hoursUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000)
}

function urgency(priority: number | null): { label: string; variant: 'danger' | 'warning' | 'neutral' } {
  if (priority == null) return { label: 'Normal', variant: 'neutral' }
  if (priority >= 4) return { label: 'High urgency', variant: 'danger' }
  if (priority >= 3) return { label: 'Medium', variant: 'warning' }
  return { label: 'Normal', variant: 'neutral' }
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

/** "2026-02" → "Feb" for chart axes. */
function monthShort(isoMonth: string): string {
  const [year, month] = isoMonth.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en', { month: 'short' })
}

function requestStatus(status: NgoRequestItem['status']): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' } {
  switch (status) {
    case 'ACCEPTED':
      return { label: 'Accepted', variant: 'success' }
    case 'PENDING':
      return { label: 'Pending', variant: 'warning' }
    case 'REJECTED':
      return { label: 'Rejected', variant: 'danger' }
    case 'CANCELLED':
      return { label: 'Cancelled', variant: 'neutral' }
  }
}

function ExpiryChip({ expiryTime }: { expiryTime: string | null }) {
  const hours = hoursUntil(expiryTime)
  if (hours == null) return null

  const variant = hours < 0 ? 'danger' : hours < 4 ? 'danger' : hours < 12 ? 'warning' : hours < 48 ? 'brand' : 'neutral'
  const label = hours < 0 ? 'Expired' : hours < 24 ? `${hours}h shelf life` : `${Math.floor(hours / 24)}d shelf life`

  return <Badge variant={variant}>{label}</Badge>
}

function KpiCard({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
  decimals = 0,
}: {
  icon: LucideIcon
  label: string
  value: number
  suffix: string
  tone: string
  decimals?: number
}) {
  return (
    <Card className="transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="py-5">
        <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="size-5" />
        </span>
        <p className="mt-4">
          <CountUp target={value} suffix={suffix} decimals={decimals} className="text-3xl font-semibold tracking-tight text-neutral-900" />
        </p>
        <p className="mt-1 text-sm font-medium text-neutral-600">{label}</p>
      </CardContent>
    </Card>
  )
}

// ── page ───────────────────────────────────────────────────────────────────

export default function NgoDashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [nearby, setNearby] = useState<NearbyDonation[]>([])
  const [requests, setRequests] = useState<NgoRequestItem[]>([])
  const [stats, setStats] = useState<NgoDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[]>([])
  const [analytics, setAnalytics] = useState<NgoAnalytics | null>(null)

  // Partial claim modal state
  const [claimModal, setClaimModal] = useState<{
    open: boolean
    donation: NearbyDonation | null
    quantity: string
    unit: string
    error: string | null
  }>({ open: false, donation: null, quantity: '', unit: '', error: null })

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    // Silent refreshes (after an accept or the periodic sweep) skip the
    // skeleton flash and never blank out a real error state.
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const { user: me } = await fetchMe()
      setProfile(me)

      // The nearby API needs an origin point — fall back to an empty list when
      // the NGO hasn't set coordinates yet (map shows a hint instead).
      const ngo = me.ngo
      const coords =
        ngo?.latitude != null && ngo?.longitude != null
          ? { latitude: ngo.latitude, longitude: ngo.longitude }
          : null

      const [nearbyResult, requestsResult, statsResult, analyticsResult, { deliveries }] = await Promise.all([
        coords
          ? fetchNearbyDonations({ lat: coords.latitude, lng: coords.longitude, distance: 25 })
          : Promise.resolve({ donations: [] }),
        // Phase 36, Step 91 — the endpoint is paginated; the dashboard shows a
        // generous window so the requests table keeps its full overview.
        fetchNgoRequests({ limit: 100 }),
        fetchNgoDashboard(),
        fetchNgoAnalytics().catch(() => null),
        fetchActiveDeliveries().catch(() => ({ deliveries: [] })),
      ])
      setNearby(nearbyResult.donations)
      setRequests(requestsResult.requests)
      setStats(statsResult)
      setAnalytics(analyticsResult)
      setActiveDeliveries(deliveries)
    } catch (err) {
      // Silent refreshes keep the current view — the caller already handled the
      // failure (toast) and shouldn't get a full-page error.
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

  /** Step 55 — open partial claim modal. */
  const handleClaim = (donation: NearbyDonation) => {
    setClaimModal({
      open: true,
      donation,
      quantity: '',
      unit: donation.unit,
      error: null,
    })
  }

  /** Handle claim from modal (full or partial). */
  const handleClaimConfirm = async () => {
    const { donation, quantity, unit } = claimModal
    if (!donation) return

    const qty = quantity ? Number(quantity) : null
    // Validate
    if (qty != null) {
      if (qty <= 0) {
        setClaimModal((prev) => ({ ...prev, error: 'Quantity must be greater than 0' }))
        return
      }
      if (qty > donation.quantity) {
        setClaimModal((prev) => ({ ...prev, error: `Cannot exceed available ${donation.quantity} ${donation.unit}` }))
        return
      }
      if (unit !== donation.unit) {
        setClaimModal((prev) => ({ ...prev, error: `Unit must match donation unit (${donation.unit})` }))
        return
      }
    }

    setClaimingId(donation.id)
    setClaimModal((prev) => ({ ...prev, error: null }))
    try {
      await createNgoRequest(donation.id, qty ?? undefined, qty != null ? unit : undefined)
      const isPartial = qty != null && qty < donation.quantity
      toast({
        variant: 'success',
        title: isPartial ? 'Partial claim accepted' : 'Donation accepted',
        description: isPartial
          ? `${qty} ${unit} of ${donation.foodName} claimed. ${donation.quantity - qty} ${donation.unit} remain available.`
          : `${donation.foodName} is now reserved for your NGO and moved to your inventory.`,
      })
      setClaimModal((prev) => ({ ...prev, open: false }))
      load({ silent: true })
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string; code?: string } } } }).response?.data?.error?.message ??
        'Something went wrong — try again'
      setClaimModal((prev) => ({ ...prev, error: msg }))
    } finally {
      setClaimingId(null)
    }
  }

  // Modal footer (extracted to avoid JSX parsing issues)
  const claimModalFooter = (
    <div className="w-full flex justify-end gap-2">
      <Button
        variant="secondary"
        onClick={() => setClaimModal((prev) => ({ ...prev, open: false, error: null }))}
        disabled={claimingId === claimModal.donation?.id}
      >
        Cancel
      </Button>
      <Button
        onClick={handleClaimConfirm}
        disabled={claimingId === claimModal.donation?.id}
      >
        {claimingId === claimModal.donation?.id ? (
          <>
            <svg className="mr-2 size-3.5 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Claiming...
          </>
        ) : (
          'Confirm claim'
        )}
      </Button>
    </div>
  )

  const firstName = profile?.fullName?.split(' ')[0] ?? user?.fullName?.split(' ')[0] ?? 'there'
  const ngo = profile?.ngo
  const coords =
    ngo?.latitude != null && ngo?.longitude != null
      ? { latitude: ngo.latitude, longitude: ngo.longitude }
      : null

  const mapDonations: NearbyMapDonation[] = nearby
    .filter((d): d is NearbyDonation & { latitude: number; longitude: number } => d.latitude != null && d.longitude != null)
    .map((d) => ({
      id: d.id,
      latitude: d.latitude,
      longitude: d.longitude,
      foodName: d.foodName,
      donorOrganization: d.donorOrganization,
      distanceKm: d.distanceKm,
    }))

  const kpis = stats
    ? [
        { icon: HandHeart, label: 'Accepted food', value: stats.acceptedCount, suffix: '', tone: 'text-brand-600 bg-brand-50' },
        { icon: Soup, label: 'Meals distributed', value: stats.mealsDistributed, suffix: '', tone: 'text-emerald-600 bg-emerald-50' },
        { icon: Users, label: 'People served', value: stats.peopleServed, suffix: '', tone: 'text-teal-600 bg-teal-50' },
        { icon: Truck, label: "Today's deliveries", value: stats.todayDeliveries, suffix: '', tone: 'text-amber-600 bg-amber-50' },
      ]
    : []

  // Phase 30, Step 78 — monthly growth series for the analytics chart.
  const monthlyGrowth = (analytics?.byMonth ?? []).map((point) => ({
    month: monthShort(point.month),
    receivedKg: Math.round(point.receivedKg * 10) / 10,
    distributedKg: Math.round(point.distributedKg * 10) / 10,
  }))

  return (
    <DashboardShell roleLabel="NGO" nav={ngoNav} title="NGO dashboard" subtitle="Find, accept, and redistribute surplus food">
      {error ? (
        <ErrorState description={error} error={error} onRetry={load} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Welcome back, {firstName}.</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {ngo?.ngoName ? `${ngo.ngoName} — ` : ''}here&apos;s what needs rescuing near you.
              </p>
            </div>
            {ngo?.verificationStatus && (
              <Badge variant={ngo.verificationStatus === 'VERIFIED' ? 'success' : 'warning'} dot>
                {ngo.verificationStatus === 'VERIFIED' ? 'Verified NGO' : 'Verification pending'}
              </Badge>
            )}
          </div>

          {/* Step 53 — KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loading || !stats
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="py-5">
                      <Skeleton className="size-10 rounded-xl" />
                      <Skeleton className="mt-4 h-8 w-20" />
                      <Skeleton className="mt-2 h-4 w-24" />
                    </CardContent>
                  </Card>
                ))
              : kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
          </div>

          {/* Phase 30, Step 78 — Impact analytics */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Monthly growth</CardTitle>
                  <CardDescription>Food received vs distributed, last 6 months</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {loading || !analytics ? (
                  <Skeleton className="h-56 w-full rounded-xl" />
                ) : (
                  <>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyGrowth} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                          <defs>
                            <linearGradient id="receivedFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="distributedFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 12, fill: '#a3a3a3' }} axisLine={false} tickLine={false} width={40} />
                          <Tooltip content={<ChartTooltip valueLabel={(value) => `${value} kg`} />} cursor={{ stroke: '#d4d4d8' }} />
                          <Area
                            type="monotone"
                            dataKey="receivedKg"
                            name="Received"
                            stroke="#0d9488"
                            strokeWidth={2.5}
                            fill="url(#receivedFill)"
                            dot={false}
                            activeDot={{ r: 4, fill: '#0d9488' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="distributedKg"
                            name="Distributed"
                            stroke="#16a34a"
                            strokeWidth={2.5}
                            fill="url(#distributedFill)"
                            dot={false}
                            activeDot={{ r: 4, fill: '#16a34a' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-teal-600" />
                        Received
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-emerald-600" />
                        Distributed
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Delivery success */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Delivery success</CardTitle>
                  <CardDescription>Accepted food that reached your NGO</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {loading || !analytics ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-24" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ) : (
                  <div>
                    <p className="text-5xl font-semibold tracking-tight text-neutral-900">
                      {analytics.summary.deliverySuccessRate}
                      <span className="text-2xl text-neutral-400">%</span>
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${analytics.summary.deliverySuccessRate}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                      {analytics.summary.deliverySuccessRate}% of the food you accepted has been delivered and
                      redistributed.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Phase 30, Step 78 — KPI tiles */}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {loading || !analytics
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="py-5">
                      <Skeleton className="size-10 rounded-xl" />
                      <Skeleton className="mt-4 h-8 w-20" />
                      <Skeleton className="mt-2 h-4 w-24" />
                    </CardContent>
                  </Card>
                ))
              : [
                  {
                    icon: HandHeart,
                    label: 'Food received',
                    value: analytics.summary.foodReceivedKg,
                    suffix: ' kg',
                    decimals: 1,
                    tone: 'text-brand-600 bg-brand-50',
                  },
                  {
                    icon: Soup,
                    label: 'Food distributed',
                    value: analytics.summary.foodDistributedKg,
                    suffix: ' kg',
                    decimals: 1,
                    tone: 'text-emerald-600 bg-emerald-50',
                  },
                  {
                    icon: Users,
                    label: 'People served',
                    value: analytics.summary.peopleServed,
                    suffix: '',
                    decimals: 0,
                    tone: 'text-teal-600 bg-teal-50',
                  },
                ].map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
          </div>

          {/* Step 53 — Nearby donations + map */}
          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3" id="nearby">
              <CardHeader>
                <div>
                  <CardTitle>Nearby donations</CardTitle>
                  <CardDescription>Urgent listings first — shortest shelf life at the top</CardDescription>
                </div>
                <Badge variant="brand">{nearby.length} available</Badge>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                  </div>
                ) : nearby.length === 0 ? (
                  <EmptyState
                    icon={Soup}
                    title={coords ? 'No nearby food right now' : 'Add your location to see nearby food'}
                    description={
                      coords
                        ? 'New listings within 25 km will appear here automatically, sorted by urgency.'
                        : 'Set your location on your NGO profile so we can find donations around you.'
                    }
                    action={
                      !coords ? (
                        <Button to="/ngo/profile" size="sm" variant="secondary">
                          <MapPin className="size-3.5" />
                          Set my location
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <ul className="space-y-3">
                    {nearby.map((donation) => {
                      const urgencyBadge = urgency(donation.priority)
                      return (
                        <li
                          key={donation.id}
                          className="rounded-xl border border-neutral-100 p-4 transition duration-300 hover:border-brand-200 hover:shadow-sm"
                        >
                          <div className="flex gap-3">
                            {donation.imageUrl ? (
                              <img
                                src={donation.imageUrl}
                                alt=""
                                className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-neutral-200"
                              />
                            ) : (
                              <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
                                <UtensilsCrossed className="size-6" />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-neutral-900">{donation.foodName}</p>
                                  <p className="truncate text-xs text-neutral-500">
                                    {donation.donorOrganization}
                                    {donation.donorCity ? ` · ${donation.donorCity}` : ''}
                                  </p>
                                </div>
                                <Badge variant={urgencyBadge.variant} dot>
                                  {urgencyBadge.label}
                                </Badge>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                                <span className="font-medium text-neutral-700">
                                  {donation.quantity} {donation.unit}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="size-3.5" />
                                  {donation.distanceKm} km
                                </span>
                                <ExpiryChip expiryTime={donation.expiryTime} />
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
                                  {donation.category}
                                </span>
                              </div>
                              <div className="mt-3 flex justify-end">
                                <Button size="sm" onClick={() => handleClaim(donation)} disabled={claimingId === donation.id}>
                                  {claimingId === donation.id ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <HandHeart className="size-3.5" />
                                  )}
                                  Accept food
                                </Button>
                              </div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Step 53 — Map */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Surplus map</CardTitle>
                  <CardDescription>Donations near your organization</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {coords ? (
                  <NearbyMap center={coords} ngoName={ngo?.ngoName ?? 'Your NGO'} donations={mapDonations} />
                ) : (
                  <EmptyState
                    icon={MapPin}
                    title="Location not set"
                    description="Add your location to your NGO profile to see nearby donations on the map."
                    action={
                      <Button to="/ngo/profile" size="sm" variant="secondary">
                        <MapPin className="size-3.5" />
                        Set my location
                      </Button>
                    }
                    className="py-10"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Step 53 — Requests + Notifications */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Requests</CardTitle>
                  <CardDescription>Food you&apos;ve claimed and its current status</CardDescription>
                </div>
                <Badge variant="brand">{requests.length}</Badge>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : requests.length === 0 ? (
                  <EmptyState
                    icon={HandHeart}
                    title="No requests yet"
                    description="Accept a nearby donation and it will show up here with its pickup details."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Food</TableHead>
                        <TableHead>Donor</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Requested</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => {
                        const statusBadge = requestStatus(request.status)
                        return (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium text-neutral-900">{request.donation.foodName}</TableCell>
                            <TableCell>{request.donation.donor.organizationName}</TableCell>
                            <TableCell>{request.donation.category.name}</TableCell>
                            <TableCell>
                              {request.donation.quantity} {request.donation.unit}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusBadge.variant} dot>
                                {statusBadge.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-neutral-500">
                              {new Date(request.requestedAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <NotificationsCard />
          </div>

          {/* Phase 28, Step 74 — Live tracking */}
          {activeDeliveries.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <div>
                  <CardTitle>Live tracking</CardTitle>
                  <CardDescription>Deliveries in transit to your organization</CardDescription>
                </div>
                <Badge variant="brand" dot>
                  {activeDeliveries.length} active
                </Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                {activeDeliveries.map((delivery) => (
                  <div key={delivery.id}>
                    <p className="mb-2 text-sm font-semibold text-neutral-900">
                      {delivery.donation.foodName}
                      {delivery.volunteerName ? <span className="font-normal text-neutral-500"> — {delivery.volunteerName}</span> : ''}
                    </p>
                    {delivery.pickup && delivery.drop && (
                      <LiveTrackingMap
                        deliveryId={delivery.id}
                        pickup={delivery.pickup}
                        drop={delivery.drop}
                        pickupLabel={delivery.donation.donorOrganization}
                        dropLabel={delivery.donation.ngoName ?? 'NGO'}
                        volunteerName={delivery.volunteerName}
                        eta={delivery.eta}
                        distance={delivery.distance}
                        status={delivery.status}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Step 53 — Inventory */}
          <Card className="mt-6">
            <CardHeader>
              <div>
                <CardTitle>Inventory</CardTitle>
                <CardDescription>Accepted food awaiting pickup or delivery</CardDescription>
              </div>
              <Badge variant="neutral">{stats?.inventory.length ?? 0} items</Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !stats || stats.inventory.length === 0 ? (
                <EmptyState
                  icon={UtensilsCrossed}
                  title="Nothing in inventory"
                  description="Food you accept is stored here until a volunteer delivers it."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Food</TableHead>
                      <TableHead>Donor</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Shelf life</TableHead>
                      <TableHead className="text-right">Freshness</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.inventory.map((item: InventoryItem) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-neutral-900">{item.foodName}</TableCell>
                        <TableCell>{item.donorOrganization}</TableCell>
                        <TableCell>
                          {item.quantity} {item.unit}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'RESERVED' ? 'brand' : 'warning'} dot>
                            {item.status === 'RESERVED' ? 'Reserved' : 'Picked up'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ExpiryChip expiryTime={item.expiryTime} />
                        </TableCell>
                        <TableCell className="text-right">
                          {item.freshnessScore != null ? `${Math.round(item.freshnessScore)}/100` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {/* Partial claim modal */}
          <Modal
            open={claimModal.open}
            onClose={() => setClaimModal((prev) => ({ ...prev, open: false, error: null }))}
            title="Claim donation"
            description={claimModal.donation
              ? `Available: ${claimModal.donation.quantity} ${claimModal.donation.unit} of ${claimModal.donation.foodName}`
              : ''}
            size="md"
            footer={claimModalFooter}
          >
            {claimModal.donation && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{claimModal.donation.foodName}</p>
                  <p className="text-xs text-neutral-500">
                    From {claimModal.donation.donorOrganization} · {claimModal.donation.distanceKm} km away
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Quantity"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max={claimModal.donation.quantity}
                    value={claimModal.quantity}
                    onChange={(e) => setClaimModal((prev) => ({ ...prev, quantity: e.target.value, error: null }))}
                    placeholder={String(claimModal.donation.quantity)}
                    hint={`Max: ${claimModal.donation.quantity} ${claimModal.donation.unit}`}
                  />
                  <Input
                    label="Unit"
                    value={claimModal.unit}
                    onChange={(e) => setClaimModal((prev) => ({ ...prev, unit: e.target.value, error: null }))}
                    placeholder={claimModal.donation.unit}
                    hint="Must match donation unit"
                  />
                </div>

                {claimModal.error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                    {claimModal.error}
                  </div>
                )}

                <div className="text-xs text-neutral-500">
                  Leave quantity empty to claim the full donation (marks it reserved).
                </div>
              </div>
            )}
          </Modal>
        </>
      )}
    </DashboardShell>
  )
}
