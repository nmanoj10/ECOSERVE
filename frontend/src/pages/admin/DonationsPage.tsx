import { HandHeart, UtensilsCrossed } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  fetchAdminDonations,
  type AdminDonationListItem,
  type AdminDonationStatus,
} from '@/api/admin'
import DashboardShell from '@/components/layout/DashboardShell'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { adminNav } from '@/pages/admin/nav'

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Step 84 — the six monitoring buckets, mapped from DonationStatus.
 * Active = AVAILABLE · Accepted = RESERVED · In transit = PICKED_UP · …
 */
const BUCKETS: Array<{ key: AdminDonationStatus | 'ALL'; label: string; status?: AdminDonationStatus; variant: BadgeVariant }> = [
  { key: 'ALL', label: 'All', variant: 'neutral' },
  { key: 'AVAILABLE', label: 'Active', status: 'AVAILABLE', variant: 'brand' },
  { key: 'RESERVED', label: 'Accepted', status: 'RESERVED', variant: 'warning' },
  { key: 'PICKED_UP', label: 'In transit', status: 'PICKED_UP', variant: 'brand' },
  { key: 'DELIVERED', label: 'Delivered', status: 'DELIVERED', variant: 'success' },
  { key: 'EXPIRED', label: 'Expired', status: 'EXPIRED', variant: 'neutral' },
  { key: 'CANCELLED', label: 'Cancelled', status: 'CANCELLED', variant: 'danger' },
]

const STATUS_VARIANT: Record<AdminDonationStatus, BadgeVariant> = {
  AVAILABLE: 'brand',
  RESERVED: 'warning',
  PICKED_UP: 'brand',
  DELIVERED: 'success',
  EXPIRED: 'neutral',
  CANCELLED: 'danger',
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ExpiryChip({ expiryTime }: { expiryTime: string | null }) {
  if (!expiryTime) return <span className="text-neutral-400">—</span>
  const hours = Math.round((new Date(expiryTime).getTime() - Date.now()) / 3_600_000)
  if (hours < 0) return <Badge variant="danger">Expired</Badge>
  const variant = hours < 4 ? 'danger' : hours < 12 ? 'warning' : hours < 48 ? 'brand' : 'neutral'
  const label = hours < 24 ? `${hours}h shelf life` : `${Math.floor(hours / 24)}d shelf life`
  return <Badge variant={variant}>{label}</Badge>
}

// ── page ───────────────────────────────────────────────────────────────────

export default function AdminDonationsPage() {
  const [bucket, setBucket] = useState<AdminDonationStatus | 'ALL'>('ALL')
  const [donations, setDonations] = useState<AdminDonationListItem[]>([])
  const [counts, setCounts] = useState<Partial<Record<AdminDonationStatus, number>>>({})
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAdminDonations({
        page,
        limit: 10,
        search: search || undefined,
        status: bucket === 'ALL' ? undefined : bucket,
        priority: priority ? Number(priority) : undefined,
      })
      setDonations(result.donations)
      setCounts(result.counts)
      setTotal(result.pagination.total)
      setTotalPages(result.pagination.totalPages)
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Failed to load donations',
      )
    } finally {
      setLoading(false)
    }
  }, [page, search, priority, bucket])

  useEffect(() => {
    setPage(1)
  }, [bucket, search, priority])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load()
    }, search ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <DashboardShell
      roleLabel="Admin"
      nav={adminNav}
      title="Donation monitoring"
      subtitle="Every listing on the platform, across all six lifecycle states"
    >
      {error ? (
        <ErrorState description={error} error={error} onRetry={load} />
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Donations</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Active → Accepted → In transit → Delivered, plus Expired and Cancelled listings.
            </p>
          </div>

          {/* Step 84 — Status buckets + search */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <Tabs value={bucket} onValueChange={(value) => setBucket(value as AdminDonationStatus | 'ALL')}>
                <TabsList>
                  {BUCKETS.map((b) => {
                    const count = b.key === 'ALL' ? undefined : (counts[b.key as AdminDonationStatus] ?? 0)
                    return (
                      <TabsTrigger key={b.key} value={b.key}>
                        {b.label}
                        {count !== undefined && <span className="ml-1.5 text-xs text-neutral-400">{count}</span>}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </Tabs>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-56 flex-1 sm:w-64">
                  <Input
                    placeholder="Search food or donor…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search donations"
                  />
                </div>
                <div className="w-40">
                  <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by urgency">
                    <option value="">Any urgency</option>
                    <option value="5">Critical (5)</option>
                    <option value="4">High (4+)</option>
                    <option value="3">Medium (3+)</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 84 — Donation table */}
          <Card className="mt-4">
            <CardHeader>
              <div>
                <CardTitle>
                  {BUCKETS.find((b) => b.key === bucket)?.label ?? 'All'} donations
                </CardTitle>
                <CardDescription>{total} listing{total === 1 ? '' : 's'} match{total === 1 ? 'es' : ''}</CardDescription>
              </div>
              <Badge variant="brand">{donations.length} on this page</Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : donations.length === 0 ? (
                <EmptyState
                  icon={HandHeart}
                  title="No donations here"
                  description={
                    search || priority
                      ? 'No listings match your search or filters.'
                      : 'Listings move through these buckets as they are claimed, picked up, and delivered.'
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Food</TableHead>
                      <TableHead>Donor</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Claimed by</TableHead>
                      <TableHead>Shelf life</TableHead>
                      <TableHead className="text-right">Freshness</TableHead>
                      <TableHead className="text-right">Listed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donations.map((donation) => {
                      const ngoName = donation.requests[0]?.ngo.ngoName
                      return (
                        <TableRow key={donation.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {donation.images[0]?.imageUrl ? (
                                <img
                                  src={donation.images[0].imageUrl}
                                  alt=""
                                  className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-neutral-200"
                                />
                              ) : (
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                                  <UtensilsCrossed className="size-4" />
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-medium text-neutral-900">{donation.foodName}</p>
                                <p className="truncate text-xs text-neutral-400">{donation.category.name}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-neutral-600">{donation.donor.organizationName}</TableCell>
                          <TableCell className="text-neutral-700">
                            {donation.quantity} {donation.unit}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[donation.status]} dot>
                              {BUCKETS.find((b) => b.status === donation.status)?.label ?? donation.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-neutral-600">{ngoName ?? '—'}</TableCell>
                          <TableCell>
                            <ExpiryChip expiryTime={donation.expiryTime} />
                          </TableCell>
                          <TableCell className="text-right">
                            {donation.predictions[0]?.freshnessScore != null
                              ? `${Math.round(donation.predictions[0].freshnessScore)}/100`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right text-neutral-500">{shortDate(donation.createdAt)}</TableCell>
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
