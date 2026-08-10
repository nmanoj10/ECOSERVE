import { BadgeCheck, Building2, HandHeart, Loader2, ShieldX, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  fetchAdminNgo,
  fetchAdminNgos,
  rejectAdminNgo,
  verifyAdminNgo,
  type AdminNgoDetailResponse,
  type AdminNgoListItem,
  type NgoVerificationStatus,
} from '@/api/admin'
import DashboardShell from '@/components/layout/DashboardShell'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { adminNav } from '@/pages/admin/nav'

// ── helpers ────────────────────────────────────────────────────────────────

const TAB_META: Record<NgoVerificationStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  VERIFIED: { label: 'Verified', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
}

const REQUEST_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  ACCEPTED: { label: 'Accepted', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-right text-sm text-neutral-700">{value ?? '—'}</dd>
    </div>
  )
}

// ── page ───────────────────────────────────────────────────────────────────

export default function AdminNgoVerificationPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<NgoVerificationStatus>('PENDING')
  const [ngos, setNgos] = useState<AdminNgoListItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Review modal state
  const [review, setReview] = useState<AdminNgoDetailResponse | null>(null)
  const [reviewTarget, setReviewTarget] = useState<AdminNgoListItem | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAdminNgos({
        page,
        limit: 10,
        search: search || undefined,
        verification: tab,
      })
      setNgos(result.ngos)
      setTotal(result.pagination.total)
      setTotalPages(result.pagination.totalPages)
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Failed to load NGOs',
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

  const openReview = async (ngo: AdminNgoListItem) => {
    setReviewTarget(ngo)
    setReviewLoading(true)
    setRejecting(false)
    setReason('')
    setReview(null)
    try {
      const detail = await fetchAdminNgo(ngo.id)
      setReview(detail)
    } catch (err) {
      // Close the modal so it can't hang on a skeleton — the toast explains why.
      setReviewTarget(null)
      toast({
        variant: 'error',
        title: 'Could not load NGO',
        description:
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Something went wrong',
      })
    } finally {
      setReviewLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!reviewTarget) return
    setBusy(true)
    try {
      await verifyAdminNgo(reviewTarget.id)
      toast({
        variant: 'success',
        title: 'NGO verified',
        description: `${reviewTarget.ngoName} can now accept and redistribute food. The owner was notified.`,
      })
      setReview(null)
      setReviewTarget(null)
      load()
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not verify NGO',
        description:
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Something went wrong',
      })
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    if (!reviewTarget) return
    setBusy(true)
    try {
      await rejectAdminNgo(reviewTarget.id, reason.trim() || undefined)
      toast({
        variant: 'warning',
        title: 'NGO rejected',
        description: `${reviewTarget.ngoName} was not approved. The owner was notified.`,
      })
      setReview(null)
      setReviewTarget(null)
      load()
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not reject NGO',
        description:
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Something went wrong',
      })
    } finally {
      setBusy(false)
    }
  }

  const meta = TAB_META[tab]

  return (
    <DashboardShell
      roleLabel="Admin"
      nav={adminNav}
      title="NGO verification"
      subtitle="Review applications and approve the NGOs on Ecoserve"
    >
      {error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Verification queue</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Every NGO starts as Pending — review the registration, then verify or reject it.
              </p>
            </div>
            <Badge variant={meta.variant} dot>
              {meta.label}: {total}
            </Badge>
          </div>

          {/* Step 83 — Review queue tabs + search */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <Tabs value={tab} onValueChange={(value) => setTab(value as NgoVerificationStatus)}>
                <TabsList>
                  <TabsTrigger value="PENDING">Pending</TabsTrigger>
                  <TabsTrigger value="VERIFIED">Verified</TabsTrigger>
                  <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="min-w-56 flex-1 sm:max-w-xs">
                <Input
                  placeholder="Search name, registration, city…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search NGOs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Step 83 — NGO table */}
          <Card className="mt-4">
            <CardContent className="pt-2">
              {loading ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : ngos.length === 0 ? (
                <EmptyState
                  icon={BadgeCheck}
                  title={search ? 'No matching NGOs' : `No ${meta.label.toLowerCase()} NGOs`}
                  description={
                    search
                      ? 'Try a different search term.'
                      : tab === 'PENDING'
                        ? 'New NGO registrations land here for review.'
                        : `NGOs you ${tab === 'VERIFIED' ? 'verify' : 'reject'} will appear here.`
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NGO</TableHead>
                      <TableHead>Registration</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ngos.map((ngo) => (
                      <TableRow key={ngo.id}>
                        <TableCell>
                          <p className="font-medium text-neutral-900">{ngo.ngoName}</p>
                          <p className="text-xs text-neutral-500">Owner: {ngo.user.fullName}</p>
                        </TableCell>
                        <TableCell className="text-neutral-600">{ngo.registrationNumber}</TableCell>
                        <TableCell className="text-neutral-600">
                          {ngo.city}, {ngo.state}
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-neutral-600">{ngo.user.email}</p>
                          <p className="text-xs text-neutral-400">{ngo.user.phone ?? '—'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={meta.variant} dot>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openReview(ngo)}>
                            {tab === 'PENDING' ? 'Review' : 'View'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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

      {/* Step 83 — Review modal */}
      <Modal
        open={reviewTarget !== null}
        onClose={() => {
          if (busy) return
          setReview(null)
          setReviewTarget(null)
        }}
        title={reviewTarget?.ngoName}
        description={reviewTarget ? `Registration ${reviewTarget.registrationNumber}` : ''}
        size="lg"
      >
        {reviewLoading || !review ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Headline status */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-10 items-center justify-center rounded-xl ${
                    review.ngo.verificationStatus === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-600'
                      : review.ngo.verificationStatus === 'REJECTED'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  <Building2 className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {TAB_META[review.ngo.verificationStatus].label} · {review.ngo.city}, {review.ngo.state}
                  </p>
                  <p className="text-xs text-neutral-500">Applied {shortDate(review.ngo.createdAt)}</p>
                </div>
              </div>
              <Badge variant={TAB_META[review.ngo.verificationStatus].variant} dot>
                {TAB_META[review.ngo.verificationStatus].label}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Registration details */}
              <Card>
                <CardHeader>
                  <CardTitle>Registration</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y divide-neutral-100 text-sm">
                    <InfoRow label="Registration no." value={review.ngo.registrationNumber} />
                    <InfoRow label="Address" value={review.ngo.address} />
                    <InfoRow label="Capacity" value={review.ngo.capacity ? `${review.ngo.capacity} people` : null} />
                    <InfoRow label="Coordinates" value={review.ngo.latitude != null ? `${review.ngo.latitude.toFixed(4)}, ${review.ngo.longitude?.toFixed(4)}` : null} />
                    {review.ngo.description && (
                      <div className="py-1.5">
                        <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">About</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-neutral-700">{review.ngo.description}</dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>

              {/* Owner + activity */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Owner account</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="divide-y divide-neutral-100 text-sm">
                      <InfoRow label="Name" value={review.ngo.user.fullName} />
                      <InfoRow label="Email" value={review.ngo.user.email} />
                      <InfoRow label="Phone" value={review.ngo.user.phone} />
                      <InfoRow label="Account" value={review.ngo.user.status} />
                    </dl>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="divide-y divide-neutral-100 text-sm">
                      <InfoRow label="Requests" value={review.stats.totalRequests} />
                      <InfoRow label="Accepted" value={review.stats.acceptedRequests} />
                      <InfoRow label="Delivered" value={review.stats.deliveredCount} />
                      <InfoRow label="Food saved" value={review.stats.foodSavedKg ? `${Math.round(review.stats.foodSavedKg)} kg` : null} />
                      <InfoRow label="Meals served" value={review.stats.mealsServed} />
                    </dl>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Recent requests */}
            {review.ngo.requests.length > 0 && (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Recent requests</CardTitle>
                    <CardDescription>Latest claim activity against donations</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {review.ngo.requests.map((request) => {
                      const status = REQUEST_STATUS[request.status] ?? { label: request.status, variant: 'neutral' as BadgeVariant }
                      return (
                        <li key={request.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-neutral-900">{request.donation.foodName}</p>
                            <p className="text-xs text-neutral-500">
                              {request.donation.quantity} {request.donation.unit} · {shortDate(request.requestedAt)}
                            </p>
                          </div>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Decision area — verify/reject from any state (re-verify and de-verify included) */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              {rejecting ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-neutral-900">Reject {review.ngo.ngoName}?</p>
                  <Input
                    placeholder="Optional reason (shared with the owner)…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-label="Rejection reason"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setRejecting(false)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleReject} disabled={busy}>
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldX className="size-3.5" />}
                      Confirm rejection
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-neutral-600">
                    {review.ngo.verificationStatus === 'PENDING'
                      ? 'Check the registration details, then approve or reject the application.'
                      : review.ngo.verificationStatus === 'VERIFIED'
                        ? 'This NGO is verified and active. De-verify it if the registration is no longer valid.'
                        : 'This application was rejected. Re-verify it once the issues have been resolved.'}
                  </p>
                  <div className="flex gap-2">
                    {review.ngo.verificationStatus !== 'REJECTED' && (
                      <Button variant="secondary" size="sm" onClick={() => setRejecting(true)} disabled={busy}>
                        <XCircle className="size-3.5" />
                        {review.ngo.verificationStatus === 'VERIFIED' ? 'De-verify' : 'Reject'}
                      </Button>
                    )}
                    {review.ngo.verificationStatus !== 'VERIFIED' && (
                      <Button size="sm" onClick={handleVerify} disabled={busy}>
                        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <HandHeart className="size-3.5" />}
                        Verify NGO
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </DashboardShell>
  )
}
