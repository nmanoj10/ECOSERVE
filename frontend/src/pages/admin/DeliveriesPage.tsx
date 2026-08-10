import type { ReactNode } from 'react'
import { DivIcon, latLngBounds } from 'leaflet'
import { Clock, MapPin, Truck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchAdminDeliveries,
  type AdminDeliveryListItem,
  type AdminDeliveryStatus,
} from '@/api/admin'
import DashboardShell from '@/components/layout/DashboardShell'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Map } from '@/components/maps/Map'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { adminNav } from '@/pages/admin/nav'

// ── helpers ────────────────────────────────────────────────────────────────

const STATUS_META: Record<AdminDeliveryStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pending', variant: 'neutral' },
  AVAILABLE: { label: 'Available', variant: 'neutral' },
  ACCEPTED: { label: 'Accepted', variant: 'brand' },
  VOLUNTEER_ASSIGNED: { label: 'Assigned', variant: 'brand' },
  PICKED_UP: { label: 'Picked up', variant: 'warning' },
  IN_TRANSIT: { label: 'In transit', variant: 'brand' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
}

type TabKey = 'ALL' | 'ACTIVE' | 'DELIVERED' | 'CANCELLED'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
]

function shortDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** Circle marker used for the live map (pickup = green, drop = red, volunteer = blue). */
function circleMarker(color: string, label: string): DivIcon {
  const size = 22
  return new DivIcon({
    className: '',
    html: `<span class="flex size-full items-center justify-center rounded-full ring-2 ring-white shadow" style="background:${color}" title="${label}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// ── page ───────────────────────────────────────────────────────────────────

export default function AdminDeliveriesPage() {
  const [tab, setTab] = useState<TabKey>('ALL')
  const [deliveries, setDeliveries] = useState<AdminDeliveryListItem[]>([])
  const [counts, setCounts] = useState<Partial<Record<AdminDeliveryStatus, number>>>({})
  const [activeCount, setActiveCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAdminDeliveries({
        page,
        limit: 10,
        search: search || undefined,
        status: tab === 'ALL' || tab === 'ACTIVE' ? undefined : (tab as AdminDeliveryStatus),
        active: tab === 'ACTIVE' ? true : undefined,
      })
      setDeliveries(result.deliveries)
      setCounts(result.counts)
      setActiveCount(result.activeCount)
      setTotal(result.pagination.total)
      setTotalPages(result.pagination.totalPages)
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Failed to load deliveries',
      )
    } finally {
      setLoading(false)
    }
  }, [page, search, tab])

  useEffect(() => {
    setPage(1)
  }, [tab, search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load()
    }, search ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [load])

  // Live map — active deliveries with a volunteer GPS ping, pickup, and drop.
  const { markers, polylines, bounds, center } = useMemo(() => {
    const tracked = deliveries.filter((d) => d.latestLocation && d.pickup && d.drop)
    const mapMarkers: Array<{ id: string; position: { latitude: number; longitude: number }; icon: DivIcon; popup?: ReactNode }> = []
    const lines: Array<{ id: string; positions: Array<[number, number]> }> = []

    for (const delivery of tracked) {
      const loc = delivery.latestLocation!
      const pickup = delivery.pickup!
      const drop = delivery.drop!
      mapMarkers.push({
        id: `${delivery.id}-volunteer`,
        position: { latitude: loc.latitude, longitude: loc.longitude },
        icon: circleMarker('#2563eb', 'Volunteer'),
        popup: (
          <span className="text-sm">
            <span className="font-semibold">{delivery.volunteer.fullName}</span> — {delivery.donation.foodName}
            <span className="block text-xs text-neutral-500">
              {delivery.donation.donorOrganization} → {delivery.donation.ngoName ?? 'NGO'}
            </span>
          </span>
        ),
      })
      mapMarkers.push({
        id: `${delivery.id}-pickup`,
        position: pickup,
        icon: circleMarker('#16a34a', 'Pickup'),
      })
      mapMarkers.push({
        id: `${delivery.id}-drop`,
        position: drop,
        icon: circleMarker('#dc2626', 'Drop'),
      })
      lines.push({
        id: delivery.id,
        positions: [
          [pickup.latitude, pickup.longitude],
          [loc.latitude, loc.longitude],
          [drop.latitude, drop.longitude],
        ],
      })
    }

    const points = mapMarkers.map((m) => m.position)
    return {
      markers: mapMarkers,
      polylines: lines,
      bounds: points.length > 1 ? latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number])) : null,
      center: points[0] ?? null,
    }
  }, [deliveries])

  const trackedCount = useMemo(() => deliveries.filter((d) => d.latestLocation && d.pickup && d.drop).length, [deliveries])

  const tabCount = (key: TabKey) => {
    // The All badge is the search-narrowed total across every status, not the
    // currently selected tab's filtered count.
    if (key === 'ALL') return Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)
    if (key === 'ACTIVE') return activeCount
    return counts[key as AdminDeliveryStatus] ?? 0
  }

  return (
    <DashboardShell
      roleLabel="Admin"
      nav={adminNav}
      title="Delivery monitoring"
      subtitle="Track every run — volunteer, ETA, status, and live location"
    >
      {error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Deliveries</h2>
            <p className="mt-1 text-sm text-neutral-500">
              In-progress runs appear with the volunteer&apos;s live GPS position — admins are authorized to see it.
            </p>
          </div>

          {/* Step 85 — Status tabs + search */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
                <TabsList>
                  {TABS.map((t) => (
                    <TabsTrigger key={t.key} value={t.key}>
                      {t.label}
                      <span className="ml-1.5 text-xs text-neutral-400">{tabCount(t.key)}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="min-w-56 flex-1 sm:max-w-xs">
                <Input
                  placeholder="Search volunteer, food, or donor…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search deliveries"
                />
              </div>
            </CardContent>
          </Card>

          {/* Step 85 — Live map (active deliveries with GPS) */}
          <Card className="mt-4">
            <CardHeader>
              <div>
                <CardTitle>Live map</CardTitle>
                <CardDescription>Volunteer positions for deliveries currently reporting location</CardDescription>
              </div>
              <Badge variant="brand" dot>
                {trackedCount > 0 ? `${trackedCount} tracked` : 'No live tracking'}
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-72 w-full rounded-xl" />
              ) : markers.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="No live deliveries right now"
                  description="Deliveries in transit with a GPS signal will show the volunteer here."
                  className="py-10"
                />
              ) : (
                <Map center={center ?? undefined} zoom={11} bounds={bounds ?? undefined} markers={markers} polylines={polylines} />
              )}
            </CardContent>
          </Card>

          {/* Step 85 — Delivery table */}
          <Card className="mt-4">
            <CardContent className="pt-2">
              {loading ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : deliveries.length === 0 ? (
                <EmptyState
                  icon={Truck}
                  title="No deliveries here"
                  description={
                    search ? 'No runs match your search.' : 'Assigned runs will appear here as volunteers move food across the platform.'
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Food</TableHead>
                      <TableHead>Volunteer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>ETA</TableHead>
                      <TableHead>Distance</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Started / Listed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((delivery) => {
                      const status = STATUS_META[delivery.status]
                      return (
                        <TableRow key={delivery.id}>
                          <TableCell>
                            <p className="font-medium text-neutral-900">{delivery.donation.foodName}</p>
                            <p className="text-xs text-neutral-500">
                              {delivery.donation.donorOrganization} → {delivery.donation.ngoName ?? 'NGO'}
                            </p>
                            <p className="text-xs text-neutral-400">
                              {delivery.donation.quantity} {delivery.donation.unit} · {delivery.donation.category}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={delivery.volunteer.fullName} src={delivery.volunteer.profileImage ?? undefined} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-neutral-900">{delivery.volunteer.fullName}</p>
                                <p className="truncate text-xs text-neutral-400">
                                  {delivery.volunteer.vehicleType ?? 'Vehicle'}
                                  {delivery.volunteer.vehicleNumber ? ` · ${delivery.volunteer.vehicleNumber}` : ''}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant} dot>
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-neutral-600">
                              <Clock className="size-3.5 text-neutral-400" />
                              {shortDateTime(delivery.eta)}
                            </span>
                          </TableCell>
                          <TableCell className="text-neutral-600">
                            {delivery.distance != null ? `${delivery.distance.toFixed(1)} km` : '—'}
                          </TableCell>
                          <TableCell>
                            {delivery.latestLocation ? (
                              <span className="text-xs text-neutral-600">
                                {delivery.latestLocation.latitude.toFixed(4)}, {delivery.latestLocation.longitude.toFixed(4)}
                                <span className="block text-neutral-400">{timeAgo(delivery.latestLocation.timestamp)}</span>
                              </span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-neutral-500">
                            {delivery.startedAt ? shortDateTime(delivery.startedAt) : `Listed ${shortDateTime(delivery.createdAt)}`}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
              <div className="mt-2">
                <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </DashboardShell>
  )
}
