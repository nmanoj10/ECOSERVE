import type { LucideIcon } from 'lucide-react'
import { Bike, HandHeart, Leaf, MapPin, PackageCheck, Recycle, Users } from 'lucide-react'
import { DivIcon, latLngBounds } from 'leaflet'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { fetchAdminAnalytics, type AdminAnalytics } from '@/api/analytics'
import { fetchMe } from '@/api/auth'
import { CountUp } from '@/components/home/CountUp'
import DashboardShell from '@/components/layout/DashboardShell'
import { Map } from '@/components/maps/Map'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { adminNav } from '@/pages/admin/nav'
import type { UserProfile } from '@/types/user'

// ── helpers ────────────────────────────────────────────────────────────────

/** \"2026-02\" → \"Feb\" for chart axes. */
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
  suffix?: string
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
          <CountUp target={value} suffix={suffix ?? ''} decimals={decimals} className="text-3xl font-semibold tracking-tight text-neutral-900" />
        </p>
        <p className="mt-1 text-sm font-medium text-neutral-600">{label}</p>
      </CardContent>
    </Card>
  )
}

// ── page ───────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [me, data] = await Promise.all([fetchMe(), fetchAdminAnalytics()])
      setProfile(me.user)
      setAnalytics(data)
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Failed to load platform analytics',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const firstName = profile?.fullName?.split(' ')[0] ?? user?.fullName?.split(' ')[0] ?? 'admin'
  const growth = (analytics?.byMonth ?? []).map((point) => ({ month: monthShort(point.month), kg: point.foodSavedKg }))

  // Heatmap (Step 80): one scaled teal circle per ~0.1° cell of delivered pickups.
  const heatmap = analytics?.heatmap ?? []
  const maxCount = Math.max(...heatmap.map((cell) => cell.count), 1)
  const { markers, bounds, center } = useMemo(() => {
    const lat = heatmap.reduce((sum, cell) => sum + cell.lat, 0) / Math.max(heatmap.length, 1)
    const lng = heatmap.reduce((sum, cell) => sum + cell.lng, 0) / Math.max(heatmap.length, 1)
    const markers = heatmap.map((cell) => {
      const intensity = cell.count / maxCount
      const radius = 8 + intensity * 18
      const opacity = 0.3 + intensity * 0.6
      const icon = new DivIcon({
        className: '',
        html: `<svg width="${radius * 2}" height="${radius * 2}" viewBox="0 0 ${radius * 2} ${radius * 2}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="rgba(13,148,136,${opacity.toFixed(2)})" stroke="#0f766e" stroke-width="1.5"/></svg>`,
        iconSize: [radius * 2, radius * 2],
        iconAnchor: [radius, radius],
      })
      return {
        id: `${cell.lat},${cell.lng}`,
        position: { latitude: cell.lat, longitude: cell.lng },
        icon,
        popup: (
          <span className="text-sm">
            <span className="font-semibold">{cell.count} pickups</span>
            <span className="block text-xs text-neutral-500">{Math.round(cell.kg)} kg rescued</span>
          </span>
        ),
      }
    })
    return {
      markers,
      bounds: heatmap.length > 1 ? latLngBounds(heatmap.map((cell) => [cell.lat, cell.lng] as [number, number])) : null,
      center: heatmap.length > 0 ? { latitude: lat, longitude: lng } : null,
    }
  }, [heatmap, maxCount])

  const topNgos = analytics?.topNgos ?? []
  const maxNgoKg = topNgos[0]?.kg ?? 1

  const kpis = analytics
    ? [
        { icon: Users, label: 'Total users', value: analytics.summary.totalUsers, tone: 'text-brand-600 bg-brand-50' },
        { icon: PackageCheck, label: 'Donations', value: analytics.summary.totalDonations, tone: 'text-teal-600 bg-teal-50' },
        { icon: HandHeart, label: 'NGOs', value: analytics.summary.totalNgos, tone: 'text-violet-600 bg-violet-50' },
        { icon: Bike, label: 'Volunteers', value: analytics.summary.totalVolunteers, tone: 'text-amber-600 bg-amber-50' },
        { icon: Recycle, label: 'Food saved', value: analytics.summary.foodSavedKg, suffix: ' kg', decimals: 1, tone: 'text-emerald-600 bg-emerald-50' },
        { icon: Leaf, label: 'CO₂ reduced', value: analytics.summary.co2Kg, suffix: ' kg', decimals: 1, tone: 'text-lime-600 bg-lime-50' },
      ]
    : []

  return (
    <DashboardShell roleLabel="Admin" nav={adminNav} title="Admin console" subtitle="Platform-wide impact at a glance">
      {error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Platform overview, {firstName}.</h2>
            <p className="mt-1 text-sm text-neutral-500">Everything being rescued on Ecoserve right now.</p>
          </div>

          {/* Step 80 — KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading || !analytics
              ? Array.from({ length: 6 }).map((_, i) => (
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

          {/* Step 80 — Growth + Top NGOs */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Platform growth</CardTitle>
                  <CardDescription>Food saved per month, last 6 months</CardDescription>
                </div>
                <Badge variant="success" dot>
                  Live
                </Badge>
              </CardHeader>
              <CardContent>
                {loading || !analytics ? (
                  <Skeleton className="h-56 w-full rounded-xl" />
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={growth} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="adminKgFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#a3a3a3' }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip content={<ChartTooltip valueLabel={(value) => `${value} kg saved`} />} cursor={{ stroke: '#d4d4d8' }} />
                        <Area
                          type="monotone"
                          dataKey="kg"
                          stroke="#16a34a"
                          strokeWidth={2.5}
                          fill="url(#adminKgFill)"
                          dot={false}
                          activeDot={{ r: 4, fill: '#16a34a' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 80 — Top NGOs */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Top NGOs</CardTitle>
                  <CardDescription>Most food redistributed</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {loading || !analytics ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : topNgos.length === 0 ? (
                  <EmptyState
                    icon={HandHeart}
                    title="No redistributions yet"
                    description="NGOs appear here once they receive delivered food."
                  />
                ) : (
                  <ul className="space-y-4">
                    {topNgos.map((ngo, i) => (
                      <li key={ngo.name}>
                        <div className="flex items-center gap-3">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-neutral-900">{ngo.name}</p>
                            <p className="truncate text-xs text-neutral-500">{ngo.city ?? '—'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-neutral-900">{Math.round(ngo.kg)} kg</p>
                            <p className="text-xs text-neutral-400">~{ngo.meals} meals</p>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${(ngo.kg / maxNgoKg) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Step 80 — Delivery heatmap */}
          <Card className="mt-6">
            <CardHeader>
              <div>
                <CardTitle>Delivery heatmap</CardTitle>
                <CardDescription>Where rescued food is picked up — circle size = pickups per area</CardDescription>
              </div>
              <Badge variant="neutral">{heatmap.length} areas</Badge>
            </CardHeader>
            <CardContent>
              {loading || !analytics ? (
                <Skeleton className="h-72 w-full rounded-xl" />
              ) : heatmap.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="No delivery data yet"
                  description="Pickup locations appear here once donations reach DELIVERED."
                />
              ) : (
                <Map center={center ?? undefined} zoom={9} bounds={bounds ?? undefined} markers={markers} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </DashboardShell>
  )
}
