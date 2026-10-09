import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  CalendarRange,
  Car,
  HandHeart,
  Leaf,
  PackageCheck,
  Recycle,
  Soup,
  Timer,
  TreePine,
  Truck,
  Users,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { fetchAdminReports, type AdminReport, type AdminDonationStatus, type ReportRange } from '@/api/admin'
import { CountUp } from '@/components/home/CountUp'
import DashboardShell from '@/components/layout/DashboardShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { adminNav } from '@/pages/admin/nav'

// ── helpers ────────────────────────────────────────────────────────────────

const RANGE_OPTIONS: Array<{ key: ReportRange; label: string }> = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'custom', label: 'Custom' },
]

const DONATION_LABEL: Record<AdminDonationStatus, string> = {
  AVAILABLE: 'Active',
  RESERVED: 'Accepted',
  PICKED_UP: 'In transit',
  DELIVERED: 'Delivered',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
}

const DONATION_COLORS = ['#0d9488', '#f59e0b', '#38bdf8', '#16a34a', '#a3a3a3', '#ef4444']

function shortDateKey(key: string): string {
  // "2026-08-10" → "Aug 10" · "2026-08" → "Aug"
  const [year, month, day] = key.split('-').map(Number)
  if (!day) return new Date(year, month - 1, 1).toLocaleString('en', { month: 'short' })
  return new Date(year, month - 1, day).toLocaleString('en', { month: 'short', day: 'numeric' })
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 shadow-lg">
      <p className="text-xs text-neutral-500">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-semibold text-neutral-900">
          <span className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {Math.round(entry.value)}
        </p>
      ))}
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  suffix = '',
  decimals = 0,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: number
  suffix?: string
  decimals?: number
  tone: string
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

function RankedList<T>({
  items,
  getKey,
  primary,
  secondary,
  barValue,
  barColor,
  emptyTitle,
  emptyDescription,
}: {
  items: T[]
  getKey: (item: T) => string
  primary: (item: T) => string
  secondary: (item: T) => string
  barValue: (item: T) => number
  barColor: string
  emptyTitle: string
  emptyDescription: string
}) {
  const max = Math.max(...items.map(barValue), 1)
  return (
    <CardContent>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} className="py-10" />
      ) : (
        <ul className="space-y-4">
          {items.map((item, i) => (
            <li key={getKey(item)}>
              <div className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{primary(item)}</p>
                  <p className="truncate text-xs text-neutral-500">{secondary(item)}</p>
                </div>
                <p className="text-right text-sm font-semibold text-neutral-900">{barValue(item)}</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(barValue(item) / max) * 100}%`, backgroundColor: barColor }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  )
}

// ── page ───────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const [range, setRange] = useState<ReportRange>('monthly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [report, setReport] = useState<AdminReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize custom fields to the last 30 days on first open.
  useEffect(() => {
    if (customFrom || customTo) return
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 29)
    setCustomFrom(`${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`)
    setCustomTo(`${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`)
  }, [customFrom, customTo])

  const load = useCallback(async (nextRange: ReportRange, from?: string, to?: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminReports({
        range: nextRange,
        from: nextRange === 'custom' && from ? from : undefined,
        to: nextRange === 'custom' && to ? to : undefined,
      })
      setReport(data)
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Failed to load the report',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  // Non-custom ranges fetch automatically; Custom waits for Apply (it needs
  // from/to, which the backend requires — fetching without them would 400).
  useEffect(() => {
    if (range === 'custom') return
    void load(range)
  }, [load, range])

  const handleRangeChange = (value: string) => {
    setRange(value as ReportRange)
  }

  const handleCustomApply = () => {
    if (!customFrom || !customTo) return
    void load('custom', customFrom, customTo)
  }

  const kpis = report
    ? [
        { icon: Recycle, label: 'Food saved', value: report.summary.foodSavedKg, suffix: ' kg', decimals: 1, tone: 'text-emerald-600 bg-emerald-50' },
        { icon: Soup, label: 'Meals served', value: report.summary.mealsServed, tone: 'text-teal-600 bg-teal-50' },
        { icon: PackageCheck, label: 'Donations listed', value: report.summary.donationsListed, tone: 'text-brand-600 bg-brand-50' },
        { icon: Truck, label: 'Deliveries completed', value: report.summary.deliveriesCompleted, tone: 'text-amber-600 bg-amber-50' },
        { icon: Leaf, label: 'CO₂ reduced', value: report.summary.co2Kg, suffix: ' kg', decimals: 1, tone: 'text-lime-600 bg-lime-50' },
        { icon: Users, label: 'Users joined', value: report.summary.usersJoined, tone: 'text-violet-600 bg-violet-50' },
      ]
    : []

  const seriesPoints = (report?.series.points ?? []).map((point) => ({
    ...point,
    key: shortDateKey(point.key),
  }))

  const donationRows = Object.entries(report?.donationByStatus ?? {}) as Array<[AdminDonationStatus, number]>
  const donutData = donationRows.map(([status, count]) => ({
    name: DONATION_LABEL[status] ?? status,
    value: count,
    color: DONATION_COLORS[['AVAILABLE', 'RESERVED', 'PICKED_UP', 'DELIVERED', 'EXPIRED', 'CANCELLED'].indexOf(status) % DONATION_COLORS.length],
  }))

  return (
    <DashboardShell roleLabel="Admin" nav={adminNav} title="Reports" subtitle="Platform performance over any window you choose">
      {error ? (
        <ErrorState description={error} error={error} onRetry={() => load(range, customFrom, customTo)} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Platform report</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {report?.range.label ?? 'Loading…'}
                {report ? ` · ${new Date(report.range.from).toLocaleDateString()} – ${new Date(report.range.to).toLocaleDateString()}` : ''}
              </p>
            </div>
            <Badge variant="brand" dot>
              Live
            </Badge>
          </div>

          {/* Step 86 — Range filter */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <Tabs value={range} onValueChange={handleRangeChange}>
                <TabsList>
                  {RANGE_OPTIONS.map((option) => (
                    <TabsTrigger key={option.key} value={option.key}>
                      {option.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {range === 'custom' && (
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    type="date"
                    label="From"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    aria-label="Report start date"
                    className="w-40"
                  />
                  <Input
                    type="date"
                    label="To"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    aria-label="Report end date"
                    className="w-40"
                  />
                  <Button size="sm" onClick={handleCustomApply} disabled={!customFrom || !customTo}>
                    <CalendarRange className="size-3.5" />
                    Apply
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 86 — KPI row */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading || !report
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

          {/* Step 86 — Platform snapshot */}
          <Card className="mt-6">
            <CardHeader>
              <div>
                <CardTitle>Platform snapshot</CardTitle>
                <CardDescription>Headline context for this window</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loading || !report ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl bg-neutral-50 p-4">
                    <Users className="size-4 text-brand-600" />
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{report.summary.volunteersActive}</p>
                    <p className="text-xs text-neutral-500">Volunteers available</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-4">
                    <BadgeCheck className="size-4 text-emerald-600" />
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{report.summary.ngosVerified}</p>
                    <p className="text-xs text-neutral-500">Verified NGOs</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-4">
                    <PackageCheck className="size-4 text-teal-600" />
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{report.summary.donationsDelivered}</p>
                    <p className="text-xs text-neutral-500">Donations delivered</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-4">
                    <XCircle className="size-4 text-red-500" />
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{report.summary.donationsCancelled}</p>
                    <p className="text-xs text-neutral-500">Donations cancelled</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-4">
                    <Timer className="size-4 text-amber-600" />
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{report.summary.donationsExpired}</p>
                    <p className="text-xs text-neutral-500">Donations expired</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 86 — Series charts */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Food saved &amp; donations</CardTitle>
                  <CardDescription>
                    Per {report?.series.bucket === 'month' ? 'month' : 'day'} — kg rescued vs listings posted
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {loading || !report ? (
                  <Skeleton className="h-56 w-full rounded-xl" />
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={seriesPoints} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="reportKg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="key" tick={{ fontSize: 12, fill: '#a3a3a3' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 12, fill: '#a3a3a3' }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#d4d4d8' }} />
                        <Area
                          type="monotone"
                          dataKey="foodSavedKg"
                          name="Food saved (kg)"
                          stroke="#16a34a"
                          strokeWidth={2.5}
                          fill="url(#reportKg)"
                          dot={false}
                          activeDot={{ r: 4, fill: '#16a34a' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Donation status breakdown */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Donation status</CardTitle>
                  <CardDescription>Current state of listings posted in the window</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {loading || !report ? (
                  <Skeleton className="h-56 w-full rounded-xl" />
                ) : donutData.length === 0 ? (
                  <EmptyState icon={PackageCheck} title="No donations" description="Nothing was listed in this window." className="py-10" />
                ) : (
                  <>
                    <div className="relative h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={64} paddingAngle={2} strokeWidth={0}>
                            {donutData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-xl font-semibold tracking-tight text-neutral-900">{report.summary.donationsListed}</p>
                        <p className="text-[11px] text-neutral-500">listed</p>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {donutData.map((entry) => (
                        <li key={entry.name} className="flex items-center gap-2 text-xs text-neutral-600">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                          <span className="font-medium text-neutral-900">{entry.value}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Step 86 — NGO + Volunteer performance */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <HandHeart className="size-4 text-brand-600" />
                  <CardTitle>NGO performance</CardTitle>
                </div>
                <CardDescription>Most food redistributed in this window</CardDescription>
              </CardHeader>
              {loading || !report ? (
                <CardContent>
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              ) : (
                <RankedList
                  items={report.topNgos}
                  getKey={(ngo) => ngo.name}
                  primary={(ngo) => ngo.name}
                  secondary={(ngo) => `${ngo.deliveries} deliveries · ~${ngo.meals} meals${ngo.city ? ` · ${ngo.city}` : ''}`}
                  barValue={(ngo) => ngo.kg}
                  barColor="#0d9488"
                  emptyTitle="No NGO activity"
                  emptyDescription="NGOs appear here once they receive delivered food in this window."
                />
              )}
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Truck className="size-4 text-brand-600" />
                  <CardTitle>Volunteer performance</CardTitle>
                </div>
                <CardDescription>Most deliveries completed in this window</CardDescription>
              </CardHeader>
              {loading || !report ? (
                <CardContent>
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              ) : (
                <RankedList
                  items={report.topVolunteers}
                  getKey={(volunteer) => volunteer.name}
                  primary={(volunteer) => volunteer.name}
                  secondary={(volunteer) => `${volunteer.distanceKm.toFixed(1)} km · ~${volunteer.meals} meals`}
                  barValue={(volunteer) => volunteer.deliveries}
                  barColor="#f59e0b"
                  emptyTitle="No volunteer activity"
                  emptyDescription="Volunteers appear here once they complete a delivery in this window."
                />
              )}
            </Card>
          </div>

          {/* Step 86 — Deliveries + environment */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Timer className="size-4 text-brand-600" />
                  <CardTitle>Delivery efficiency</CardTitle>
                </div>
                <CardDescription>Runs started in this window</CardDescription>
              </CardHeader>
              <CardContent>
                {loading || !report ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-4xl font-semibold tracking-tight text-neutral-900">
                        {report.summary.deliveriesTotal}
                        <span className="text-base font-normal text-neutral-400"> total</span>
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {report.summary.deliveriesCompleted} completed · {report.summary.deliveriesCancelled} cancelled
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{
                          width: `${report.summary.deliveriesTotal > 0 ? (report.summary.deliveriesCompleted / report.summary.deliveriesTotal) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3.5 py-3">
                      <Timer className="size-4 shrink-0 text-brand-600" />
                      <p className="text-sm text-neutral-600">
                        Average delivery time: <span className="font-semibold text-neutral-900">{report.summary.avgDeliveryTimeHours.toFixed(1)} h</span>
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Leaf className="size-4 text-lime-600" />
                  <CardTitle>Environmental impact</CardTitle>
                </div>
                <CardDescription>CO₂e avoided by saving this food instead of letting it rot</CardDescription>
              </CardHeader>
              <CardContent>
                {loading || !report ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-lime-50 p-4">
                      <Leaf className="size-5 text-lime-600" />
                      <p className="mt-3">
                        <CountUp target={report.environment.co2Kg} suffix=" kg" decimals={1} className="text-2xl font-semibold tracking-tight text-neutral-900" />
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">CO₂e avoided</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-4">
                      <TreePine className="size-5 text-emerald-600" />
                      <p className="mt-3">
                        <CountUp target={report.environment.treesEquivalent} className="text-2xl font-semibold tracking-tight text-neutral-900" />
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">tree-years of CO₂ absorption</p>
                    </div>
                    <div className="rounded-xl bg-teal-50 p-4">
                      <Car className="size-5 text-teal-600" />
                      <p className="mt-3">
                        <CountUp target={report.environment.carKmAvoided} suffix=" km" className="text-2xl font-semibold tracking-tight text-neutral-900" />
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">equivalent car travel avoided</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </DashboardShell>
  )
}
