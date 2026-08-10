import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Info,
  Leaf,
  Lightbulb,
  MapPin,
  MonitorSmartphone,
  PackageCheck,
  Recycle,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Users,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { fetchDonorAnalytics, type DonorAnalytics } from '@/api/analytics'
import { fetchMe, listSessions, revokeSession, type SessionInfo } from '@/api/auth'
import { fetchDonations, type DonationListItem } from '@/api/donations'
import { fetchActiveDeliveries, type ActiveDelivery } from '@/api/volunteer'
import DashboardShell from '@/components/layout/DashboardShell'
import { donorNav } from '@/pages/donor/nav'
import { CountUp } from '@/components/home/CountUp'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { LiveTrackingMap } from '@/components/maps/LiveTrackingMap'
import { useAuth } from '@/hooks/useAuth'
import type { UserProfile } from '@/types/user'

// ── Demo data (sections still awaiting their later phases) ──

const pickupSteps = [
  { label: 'Scheduled', done: true },
  { label: 'Picked up', done: false },
  { label: 'Delivered', done: false },
]

interface Insight {
  icon: LucideIcon
  title: string
  text: string
  tone: string
}

const insights: Insight[] = [
  {
    icon: Lightbulb,
    title: 'Best pickup time',
    text: 'Saturday evening pickups match 30% more NGOs in your area.',
    tone: 'bg-amber-50 text-amber-600',
  },
  {
    icon: TrendingUp,
    title: 'Surplus pattern',
    text: 'Your bakery surplus peaks on Fridays — schedule a standing pickup ahead.',
    tone: 'bg-brand-50 text-brand-600',
  },
  {
    icon: Zap,
    title: 'Impact tip',
    text: 'Splitting large donations across two NGOs raises acceptance by 22%.',
    tone: 'bg-emerald-50 text-emerald-600',
  },
]

interface NotificationItem {
  id: string
  kind: 'success' | 'info' | 'warning' | 'milestone'
  title: string
  message: string
  time: string
}

const initialNotifications: NotificationItem[] = [
  { id: 'n1', kind: 'success', title: 'Delivery confirmed', message: 'Hope Shelter received 24 meals from your Sunday donation.', time: '2m ago' },
  { id: 'n2', kind: 'info', title: 'New NGO match', message: 'Annapurna Trust can accept your surplus tomorrow morning.', time: '1h ago' },
  { id: 'n3', kind: 'warning', title: 'Freshness alert', message: 'Your Friday pickup needs a volunteer — can you extend the window?', time: '3h ago' },
  { id: 'n4', kind: 'milestone', title: 'Impact milestone', message: 'You hit 1,000 kg saved this quarter. Thank you!', time: '1d ago' },
]

const notificationStyle: Record<NotificationItem['kind'], { icon: LucideIcon; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'bg-emerald-50 text-emerald-600' },
  info: { icon: Info, classes: 'bg-brand-50 text-brand-600' },
  warning: { icon: AlertTriangle, classes: 'bg-amber-50 text-amber-600' },
  milestone: { icon: Sparkles, classes: 'bg-teal-50 text-teal-600' },
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

/** Palette for the food-categories donut. */
const CATEGORY_COLORS = ['#0d9488', '#16a34a', '#f59e0b', '#6366f1', '#ef4444', '#14b8a6', '#8b5cf6', '#f97316']

/** Human label + badge tone for a DonationStatus from the live API. */
const DONATION_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  AVAILABLE: { label: 'Available', variant: 'brand' },
  RESERVED: { label: 'Reserved', variant: 'warning' },
  PICKED_UP: { label: 'Picked up', variant: 'brand' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  EXPIRED: { label: 'Expired', variant: 'neutral' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
}

/** "Jul 14" for the recent-donations table. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export default function DonorDashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<SessionInfo | null>(null)
  const [read, setRead] = useState<Set<string>>(new Set())
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[]>([])
  const [analytics, setAnalytics] = useState<DonorAnalytics | null>(null)
  const [recentDonations, setRecentDonations] = useState<DonationListItem[]>([])
  const [donationsLoaded, setDonationsLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ user: me }, { sessions: s }, { deliveries }, analytics, donationsPage] = await Promise.all([
        fetchMe(),
        listSessions(),
        fetchActiveDeliveries().catch(() => ({ deliveries: [] })),
        fetchDonorAnalytics().catch(() => null),
        fetchDonations({ limit: 5 }).catch(() => null),
      ])
      setProfile(me)
      setSessions(s)
      setActiveDeliveries(deliveries)
      setAnalytics(analytics)
      setRecentDonations(donationsPage?.donations ?? [])
      setDonationsLoaded(donationsPage !== null)
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

  const handleRevoke = async () => {
    if (!revoking) return
    await revokeSession(revoking.id)
    setSessions((prev) => prev.filter((s) => s.id !== revoking.id))
    toast({ variant: 'success', title: 'Session revoked', description: 'That device is signed out on its next request.' })
  }

  const markRead = (id: string) => {
    setRead((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const markAllRead = () => {
    setRead(new Set(initialNotifications.map((n) => n.id)))
    toast({ variant: 'info', title: 'All caught up', description: 'Notifications marked as read.' })
  }

  // Phase 30, Step 77 — live analytics (falls back to empty series).
  const monthlyKg = (analytics?.byMonth ?? []).map((point) => ({ month: monthShort(point.month), kg: point.kg }))
  const monthlyDonations = (analytics?.byMonth ?? []).map((point) => ({
    month: monthShort(point.month),
    donations: point.donations,
  }))
  const categories = analytics?.byCategory ?? []
  const categoriesTotalKg = categories.reduce((sum, category) => sum + category.kg, 0)

  const kpis = analytics
    ? [
        {
          icon: PackageCheck,
          label: 'Total donations',
          target: analytics.summary.totalDonations,
          suffix: '',
          decimals: 0,
          trend: 'all time',
          tone: 'text-brand-600 bg-brand-50',
        },
        {
          icon: Recycle,
          label: 'Food saved',
          target: analytics.summary.foodSavedKg,
          suffix: ' kg',
          decimals: 1,
          trend: 'delivered to NGOs',
          tone: 'text-emerald-600 bg-emerald-50',
        },
        {
          icon: Users,
          label: 'People served',
          target: analytics.summary.peopleServed,
          suffix: '',
          decimals: 0,
          trend: 'estimated meals',
          tone: 'text-teal-600 bg-teal-50',
        },
        {
          icon: Leaf,
          label: 'CO₂ reduced',
          target: analytics.summary.co2Kg,
          suffix: ' kg',
          decimals: 1,
          trend: 'avoided emissions',
          tone: 'text-lime-600 bg-lime-50',
        },
      ]
    : []

  const firstName = profile?.fullName?.split(' ')[0] ?? user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'

  return (
    <DashboardShell roleLabel="Donor" nav={donorNav} title="Donor dashboard" subtitle="Your food rescue at a glance">
      {error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Welcome back, {firstName}.</h2>
              <p className="mt-1 text-sm text-neutral-500">Here&apos;s what your donations achieved this month.</p>
            </div>
            <Button size="sm" onClick={() => navigate('/donor/new')}>
              <UtensilsCrossed className="size-4" />
              New donation
            </Button>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="account">Account &amp; security</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              {/* KPI row */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {loading || !analytics
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <Card key={i}>
                        <CardContent className="py-5">
                          <Skeleton className="size-10 rounded-xl" />
                          <Skeleton className="mt-4 h-8 w-20" />
                          <Skeleton className="mt-2 h-4 w-24" />
                        </CardContent>
                      </Card>
                    ))
                  : kpis.map((kpi) => (
                      <Card key={kpi.label} className="transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
                        <CardContent className="py-5">
                          <div className="flex items-center justify-between">
                            <span className={`flex size-10 items-center justify-center rounded-xl ${kpi.tone}`}>
                              <kpi.icon className="size-5" />
                            </span>
                            <TrendingUp className="size-4 text-emerald-600" />
                          </div>
                          <p className="mt-4">
                            <CountUp
                              target={kpi.target}
                              suffix={kpi.suffix}
                              decimals={kpi.decimals}
                              className="text-3xl font-semibold tracking-tight text-neutral-900"
                            />
                          </p>
                          <p className="mt-1 text-sm font-medium text-neutral-600">{kpi.label}</p>
                          <p className="mt-0.5 text-xs text-emerald-600">{kpi.trend}</p>
                        </CardContent>
                      </Card>
                    ))}
              </div>

              {/* Analytics + Upcoming pickup */}
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div>
                      <CardTitle>Food saved</CardTitle>
                      <CardDescription>Kilograms rescued per month, last 6 months</CardDescription>
                    </div>
                    <Badge variant="success" dot>
                      Live
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {loading || !analytics ? (
                      <Skeleton className="h-64 w-full rounded-xl" />
                    ) : (
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={monthlyKg} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                            <defs>
                              <linearGradient id="kgFill" x1="0" y1="0" x2="0" y2="1">
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
                              fill="url(#kgFill)"
                              dot={false}
                              activeDot={{ r: 4, fill: '#16a34a' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Upcoming pickup */}
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Upcoming pickup</CardTitle>
                      <CardDescription>Your next scheduled handoff</CardDescription>
                    </div>
                    <Badge variant="neutral">Preview data</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <CalendarClock className="size-4 text-brand-600" />
                      Tomorrow, 18:00 – 19:30
                    </div>
                    <div className="mt-4 space-y-3 text-sm">
                      <p className="flex items-start gap-2.5 text-neutral-700">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                        <span>
                          <span className="font-medium text-neutral-900">Green Bites Kitchen</span>
                          <span className="block text-xs text-neutral-500">Pickup address on file</span>
                        </span>
                      </p>
                      <p className="flex items-start gap-2.5 text-neutral-700">
                        <Truck className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                        <span>
                          <span className="font-medium text-neutral-900">Hope Shelter</span>
                          <span className="block text-xs text-neutral-500">40 kg bakery · ~160 meals</span>
                        </span>
                      </p>
                    </div>

                    {/* Steps */}
                    <div className="mt-5 flex items-center gap-1.5">
                      {pickupSteps.map((step, i) => (
                        <div key={step.label} className="flex flex-1 flex-col items-center gap-1.5">
                          <span
                            className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                              step.done ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-400'
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className={`text-[11px] ${step.done ? 'text-brand-700' : 'text-neutral-400'}`}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-500">
                      <Clock className="size-3.5" />
                      Volunteer Rohan assigned
                    </p>

                    <div className="mt-4 flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => toast({ variant: 'info', title: 'Demo data', description: 'Live route view arrives with the tracking phase.' })}>
                        View route
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1" onClick={() => toast({ variant: 'info', title: 'Demo data', description: 'Rescheduling arrives with the donation module.' })}>
                        Reschedule
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Phase 30, Step 77 — Donations by month + Food categories */}
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div>
                      <CardTitle>Donations by month</CardTitle>
                      <CardDescription>Listings created per month, last 6 months</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading || !analytics ? (
                      <Skeleton className="h-56 w-full rounded-xl" />
                    ) : (
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyDonations} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
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
                              content={<ChartTooltip valueLabel={(value) => `${value} donations`} />}
                              cursor={{ fill: '#fafafa' }}
                            />
                            <Bar dataKey="donations" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Food categories</CardTitle>
                      <CardDescription>Saved food by category</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading || !analytics ? (
                      <Skeleton className="h-44 w-full rounded-xl" />
                    ) : (
                      <>
                        {categories.length === 0 ? (
                          <p className="py-10 text-center text-sm text-neutral-500">
                            No saved food yet — once a delivery reaches an NGO, your impact shows up here.
                          </p>
                        ) : (
                          <div className="relative h-44">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={categories}
                                  dataKey="kg"
                                  nameKey="category"
                                  innerRadius={50}
                                  outerRadius={70}
                                  paddingAngle={2}
                                  strokeWidth={0}
                                >
                                  {categories.map((entry, i) => (
                                    <Cell key={entry.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip content={<ChartTooltip valueLabel={(value) => `${value} kg saved`} />} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                              <p className="text-2xl font-semibold tracking-tight text-neutral-900">
                                {Math.round(categoriesTotalKg)}
                              </p>
                              <p className="text-xs text-neutral-500">kg saved</p>
                            </div>
                          </div>
                        )}
                        {categories.length > 0 && (
                          <ul className="mt-3 space-y-1.5">
                            {categories.slice(0, 6).map((entry, i) => (
                              <li key={entry.category} className="flex items-center gap-2 text-xs text-neutral-600">
                                <span
                                  className="size-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                                />
                                <span className="min-w-0 flex-1 truncate">{entry.category}</span>
                                <span className="font-medium text-neutral-900">{Math.round(entry.kg)} kg</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent donations + Notifications */}
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div>
                      <CardTitle>Recent donations</CardTitle>
                      <CardDescription>Your latest surplus listings</CardDescription>
                    </div>
                    <Badge variant="success" dot>
                      Live
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : !donationsLoaded ? (
                      <p className="py-10 text-center text-sm text-neutral-500">
                        Couldn&apos;t load your donations — refresh to try again.
                      </p>
                    ) : recentDonations.length === 0 ? (
                      <EmptyState
                        icon={UtensilsCrossed}
                        title="No donations yet"
                        description="List your first surplus donation — NGOs near you can claim it within minutes."
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Donation</TableHead>
                            <TableHead>Food</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentDonations.map((donation) => {
                            const status = DONATION_STATUS[donation.status] ?? {
                              label: donation.status,
                              variant: 'neutral' as BadgeVariant,
                            }
                            return (
                              <TableRow key={donation.id}>
                                <TableCell className="font-medium text-neutral-900">
                                  #{donation.id.slice(-4).toUpperCase()}
                                </TableCell>
                                <TableCell>
                                  <span className="block max-w-56 truncate">{donation.foodName}</span>
                                  <span className="block text-xs text-neutral-400">{donation.category.name}</span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={status.variant} dot>
                                    {status.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {donation.quantity} {donation.unit}
                                </TableCell>
                                <TableCell className="text-right text-neutral-500">{shortDate(donation.createdAt)}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Notifications */}
                <Card>
                  <CardHeader>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle>Notifications</CardTitle>
                        <Badge variant="neutral">Preview data</Badge>
                      </div>
                      <CardDescription>Sample activity — live notifications arrive in a later phase</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={markAllRead}>
                      Mark all read
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {initialNotifications.map((notification) => {
                        const isRead = read.has(notification.id)
                        const { icon: Icon, classes } = notificationStyle[notification.kind]
                        return (
                          <li key={notification.id}>
                            <button
                              type="button"
                              onClick={() => markRead(notification.id)}
                              aria-label={`${notification.title}${isRead ? '' : ' — unread'}`}
                              className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-neutral-50"
                            >
                              <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${classes}`}>
                                <Icon className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span
                                    className={`truncate text-sm font-medium ${isRead ? 'text-neutral-500' : 'text-neutral-900'}`}
                                  >
                                    {notification.title}
                                  </span>
                                  {!isRead && <span className="size-1.5 shrink-0 rounded-full bg-brand-500" />}
                                </span>
                                <span
                                  className={`mt-0.5 block text-xs leading-relaxed ${isRead ? 'text-neutral-400' : 'text-neutral-500'}`}
                                >
                                  {notification.message}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-neutral-400">{notification.time}</span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Phase 28, Step 73 — Live tracking */}
              {activeDeliveries.length > 0 && (
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Live deliveries</CardTitle>
                      <CardDescription>Your donations currently in transit</CardDescription>
                    </div>
                    <Badge variant="brand" dot>
                      {activeDeliveries.length} active
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {activeDeliveries.map((delivery) => (
                      <div key={delivery.id}>
                        <p className="mb-2 text-sm font-semibold text-neutral-900">{delivery.donation.foodName}</p>
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

              {/* AI insights */}
              <Card>
                <CardHeader>
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-brand-600" />
                      <CardTitle>AI insights</CardTitle>
                    </div>
                    <CardDescription>Personalized suggestions from Ecoserve AI</CardDescription>
                  </div>
                  <Badge variant="brand">Powered by AI</Badge>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {insights.map((insight) => (
                      <div
                        key={insight.title}
                        className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-sm"
                      >
                        <span className={`flex size-9 items-center justify-center rounded-lg ${insight.tone}`}>
                          <insight.icon className="size-4.5" />
                        </span>
                        <p className="mt-3 text-sm font-semibold text-neutral-900">{insight.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-neutral-600">{insight.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </TabsContent>

            {/* Account & security */}
            <TabsContent value="account" className="space-y-4">
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
                        <Skeleton className="h-4 w-1/2" />
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
                      <Store className="size-4 text-brand-600" />
                      <CardTitle>Organization</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    ) : profile?.donor ? (
                      <dl className="space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-neutral-500">Name</dt>
                          <dd className="font-medium">{profile.donor.organizationName}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-neutral-500">Type</dt>
                          <dd className="font-medium">{profile.donor.organizationType}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-neutral-500">Location</dt>
                          <dd className="font-medium">
                            {profile.donor.city}, {profile.donor.state}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-sm text-neutral-500">No donor profile found.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div>
                    <div className="flex items-center gap-2">
                      <MonitorSmartphone className="size-4 text-brand-600" />
                      <CardTitle>Active sessions</CardTitle>
                    </div>
                    <CardDescription>
                      Revoking a session invalidates its refresh token — that device is signed out on its next request.
                    </CardDescription>
                  </div>
                  <Badge variant="brand">{sessions.length}</Badge>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <p className="text-sm text-neutral-500">No active sessions recorded yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Device</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessions.map((session, i) => (
                          <TableRow key={session.id}>
                            <TableCell className="font-medium text-neutral-900">Session {i + 1}</TableCell>
                            <TableCell>{new Date(session.createdAt).toLocaleString()}</TableCell>
                            <TableCell>{new Date(session.expiresAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => setRevoking(session)}>
                                Revoke
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Revoke this session?"
        description="The device will be signed out the next time it tries to refresh its token. You can sign in again anytime."
        confirmLabel="Revoke session"
        onConfirm={handleRevoke}
      />
    </DashboardShell>
  )
}
