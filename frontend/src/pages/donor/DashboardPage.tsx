import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ArrowUpRight,
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
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { fetchMe, listSessions, revokeSession, type SessionInfo } from '@/api/auth'
import DashboardShell from '@/components/layout/DashboardShell'
import { donorNav } from '@/pages/donor/nav'
import { CountUp } from '@/components/home/CountUp'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import type { UserProfile } from '@/types/user'

// ── Demo data (donation APIs land in a later phase; these keep the UI real) ──

const kpis = [
  { icon: PackageCheck, label: 'Total donations', target: 128, suffix: '', trend: '+12% vs last month', tone: 'text-brand-600 bg-brand-50' },
  { icon: Recycle, label: 'Food saved', target: 3420, suffix: ' kg', trend: '+8% vs last month', tone: 'text-emerald-600 bg-emerald-50' },
  { icon: Users, label: 'People served', target: 8560, suffix: '', trend: '+15% vs last month', tone: 'text-teal-600 bg-teal-50' },
  { icon: Leaf, label: 'CO₂ reduced', target: 1284, suffix: ' kg', trend: '+8% vs last month', tone: 'text-lime-600 bg-lime-50' },
] as const

const monthlyKg = [
  { month: 'Feb', kg: 412 },
  { month: 'Mar', kg: 468 },
  { month: 'Apr', kg: 521 },
  { month: 'May', kg: 608 },
  { month: 'Jun', kg: 584 },
  { month: 'Jul', kg: 647 },
]

const recentDonations = [
  { id: '#4821', route: 'Green Bites → Hope Shelter', status: 'Delivered', meals: 24, date: 'Jul 14' },
  { id: '#4820', route: 'Daily Mart → Annapurna Trust', status: 'In transit', meals: 18, date: 'Jul 13' },
  { id: '#4819', route: 'Sunrise Bakery → City Mission', status: 'Delivered', meals: 40, date: 'Jul 12' },
  { id: '#4818', route: 'Green Bites → Snehalaya', status: 'Scheduled', meals: 12, date: 'Jul 11' },
] as const

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

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 shadow-lg">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-sm font-semibold text-neutral-900">{payload[0].value} kg saved</p>
    </div>
  )
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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ user: me }, { sessions: s }] = await Promise.all([fetchMe(), listSessions()])
      setProfile(me)
      setSessions(s)
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
                {kpis.map((kpi) => (
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
                      On track
                    </Badge>
                  </CardHeader>
                  <CardContent>
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
                          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#d4d4d8' }} />
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
                  </CardContent>
                </Card>

                {/* Upcoming pickup */}
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Upcoming pickup</CardTitle>
                      <CardDescription>Your next scheduled handoff</CardDescription>
                    </div>
                    <Badge variant="warning" dot>
                      Scheduled
                    </Badge>
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

              {/* Recent donations + Notifications */}
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div>
                      <CardTitle>Recent donations</CardTitle>
                      <CardDescription>Your latest surplus listings</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toast({ variant: 'info', title: 'Demo data', description: 'Full donation history arrives with the donor module.' })}
                    >
                      View all
                      <ArrowUpRight className="size-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Donation</TableHead>
                          <TableHead>Route</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Meals</TableHead>
                          <TableHead className="text-right">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentDonations.map((donation) => (
                          <TableRow key={donation.id}>
                            <TableCell className="font-medium text-neutral-900">{donation.id}</TableCell>
                            <TableCell>{donation.route}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  donation.status === 'Delivered'
                                    ? 'success'
                                    : donation.status === 'In transit'
                                      ? 'brand'
                                      : 'warning'
                                }
                                dot
                              >
                                {donation.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{donation.meals}</TableCell>
                            <TableCell className="text-right text-neutral-500">{donation.date}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Notifications */}
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Notifications</CardTitle>
                      <CardDescription>Recent activity on your donations</CardDescription>
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

              <p className="text-center text-xs text-neutral-400">
                Sample data for design preview — live donation &amp; analytics APIs arrive in a later phase.
              </p>
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
