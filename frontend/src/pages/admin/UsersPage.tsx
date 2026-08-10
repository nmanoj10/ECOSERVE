import type { LucideIcon } from 'lucide-react'
import { Ban, Building2, CheckCircle2, Loader2, ShieldCheck, Truck, UserRound, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  fetchAdminUser,
  fetchAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
  type AdminUserDetail,
  type AdminUserListItem,
  type AdminUserRole,
  type AdminUserStatus,
} from '@/api/admin'
import DashboardShell from '@/components/layout/DashboardShell'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { adminNav } from '@/pages/admin/nav'

// ── helpers ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<AdminUserRole, string> = {
  DONOR: 'Donor',
  NGO: 'NGO',
  VOLUNTEER: 'Volunteer',
  ADMIN: 'Admin',
}

const ROLE_VARIANT: Record<AdminUserRole, BadgeVariant> = {
  DONOR: 'brand',
  NGO: 'warning',
  VOLUNTEER: 'success',
  ADMIN: 'neutral',
}

const ROLE_ICON: Record<AdminUserRole, LucideIcon> = {
  DONOR: Building2,
  NGO: Building2,
  VOLUNTEER: Truck,
  ADMIN: ShieldCheck,
}

const STATUS_LABEL: Record<AdminUserStatus, string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
}

const STATUS_VARIANT: Record<AdminUserStatus, BadgeVariant> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-right text-sm text-neutral-700">{value ?? '—'}</dd>
    </div>
  )
}

// ── page ───────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Detail modal state
  const [detailTarget, setDetailTarget] = useState<AdminUserListItem | null>(null)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [detailStats, setDetailStats] = useState<{ donations: number; requests: number; deliveries: number; sessions: number } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [newRole, setNewRole] = useState<AdminUserRole>('DONOR')
  const [busy, setBusy] = useState(false)

  // Row-level status toggle with confirmation
  const [toggleTarget, setToggleTarget] = useState<AdminUserListItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAdminUsers({
        page,
        limit: 10,
        search: search || undefined,
        role: (role as AdminUserRole) || undefined,
        status: (status as AdminUserStatus) || undefined,
      })
      setUsers(result.users)
      setTotal(result.pagination.total)
      setTotalPages(result.pagination.totalPages)
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Failed to load users',
      )
    } finally {
      setLoading(false)
    }
  }, [page, search, role, status])

  // Any filter change resets to the first page.
  useEffect(() => {
    setPage(1)
  }, [search, role, status])

  // Debounce the free-text search; filters apply immediately.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      load()
    }, search ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openDetail = async (user: AdminUserListItem) => {
    setDetailTarget(user)
    setDetailLoading(true)
    setNewRole(user.role === 'ADMIN' ? 'DONOR' : user.role)
    try {
      const { user: full, stats } = await fetchAdminUser(user.id)
      setDetail(full)
      setDetailStats(stats)
    } catch (err) {
      // Close the modal so it can't hang on a skeleton — the toast explains why.
      setDetailTarget(null)
      toast({
        variant: 'error',
        title: 'Could not load user',
        description:
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Something went wrong',
      })
    } finally {
      setDetailLoading(false)
    }
  }

  /** Confirm-then-toggle from the table (deactivate needs a confirm step). */
  const confirmToggle = (user: AdminUserListItem) => {
    if (user.status === 'SUSPENDED') {
      void applyStatus(user, 'ACTIVE')
    } else {
      setToggleTarget(user)
    }
  }

  const applyStatus = async (target: AdminUserListItem, next: AdminUserStatus) => {
    try {
      await updateAdminUserStatus(target.id, next)
      toast({
        variant: next === 'SUSPENDED' ? 'warning' : 'success',
        title: next === 'SUSPENDED' ? 'Account deactivated' : 'Account activated',
        description:
          next === 'SUSPENDED'
            ? `${target.fullName} is signed out on all devices and blocked from the platform.`
            : `${target.fullName} can use Ecoserve again.`,
      })
      // Keep the open modal in sync when it shows this user.
      if (detail?.id === target.id) setDetail({ ...detail, status: next })
      setToggleTarget(null)
      load()
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not update status',
        description:
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Something went wrong',
      })
    }
  }

  const handleRoleChange = async () => {
    if (!detail || detail.role === 'ADMIN') return
    if (newRole === detail.role) {
      toast({ variant: 'info', title: 'No change', description: 'The user already has this role.' })
      return
    }
    setBusy(true)
    try {
      await updateAdminUserRole(detail.id, newRole)
      toast({
        variant: 'success',
        title: 'Role updated',
        description: `${detail.fullName} is now a ${ROLE_LABEL[newRole]} account.`,
      })
      setDetail({ ...detail, role: newRole })
      load()
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not update role',
        description:
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Something went wrong',
      })
    } finally {
      setBusy(false)
    }
  }

  const profile = detail
    ? detail.role === 'DONOR'
      ? detail.donor
      : detail.role === 'NGO'
        ? detail.ngo
        : detail.volunteer
    : null

  return (
    <DashboardShell roleLabel="Admin" nav={adminNav} title="User management" subtitle="Search, review, and manage every account on the platform">
      {error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Users</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Activate or deactivate accounts and adjust roles. Deactivating signs the user out everywhere.
              </p>
            </div>
            <Badge variant="brand">{total} accounts</Badge>
          </div>

          {/* Step 82 — Search + filters */}
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 py-4">
              <div className="min-w-56 flex-1">
                <Input
                  placeholder="Search name, email, or phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search users"
                />
              </div>
              <div className="w-40">
                <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
                  <option value="">All roles</option>
                  <option value="DONOR">Donor</option>
                  <option value="NGO">NGO</option>
                  <option value="VOLUNTEER">Volunteer</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </div>
              <div className="w-40">
                <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="PENDING">Pending</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Step 82 — User table */}
          <Card className="mt-4">
            <CardContent className="pt-2">
              {loading ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={search || role || status ? 'No matching users' : 'No users yet'}
                  description={search || role || status ? 'Try adjusting your search or filters.' : 'Registered accounts will appear here.'}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const RoleIcon = ROLE_ICON[user.role]
                      const roleName =
                        user.role === 'DONOR'
                          ? user.donor?.organizationName
                          : user.role === 'NGO'
                            ? user.ngo?.ngoName
                            : null
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar name={user.fullName} src={user.profileImage ?? undefined} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-neutral-900">{user.fullName}</p>
                                <p className="truncate text-xs text-neutral-500">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ROLE_VARIANT[user.role]}>
                              <RoleIcon className="size-3" />
                              {ROLE_LABEL[user.role]}
                              {roleName ? ` · ${roleName}` : ''}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[user.status]} dot>
                              {STATUS_LABEL[user.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-neutral-500">{shortDate(user.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              {user.role !== 'ADMIN' && (
                                <Button variant="ghost" size="sm" onClick={() => openDetail(user)}>
                                  View
                                </Button>
                              )}
                              {user.role !== 'ADMIN' && user.status !== 'PENDING' && (
                                <Button
                                  variant={user.status === 'SUSPENDED' ? 'outline' : 'ghost'}
                                  size="sm"
                                  onClick={() => confirmToggle(user)}
                                  aria-label={user.status === 'SUSPENDED' ? `Reactivate ${user.fullName}` : `Deactivate ${user.fullName}`}
                                >
                                  {user.status === 'SUSPENDED' ? (
                                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                                  ) : (
                                    <Ban className="size-3.5 text-red-500" />
                                  )}
                                  {user.status === 'SUSPENDED' ? 'Reactivate' : 'Deactivate'}
                                </Button>
                              )}
                            </div>
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

      {/* Step 82 — Deactivate confirmation */}
      <Dialog
        open={toggleTarget !== null}
        onClose={() => setToggleTarget(null)}
        title={`Deactivate ${toggleTarget?.fullName ?? 'this user'}?`}
        description="They will be signed out on every device and blocked from the platform until reactivated. Their data is kept intact."
        confirmLabel="Deactivate account"
        onConfirm={() => {
          if (toggleTarget) return applyStatus(toggleTarget, 'SUSPENDED')
        }}
      />

      {/* Step 82 — User detail */}
      <Modal
        open={detailTarget !== null}
        onClose={() => {
          setDetail(null)
          setDetailTarget(null)
        }}
        title={detailTarget?.fullName ?? ''}
        description={detailTarget?.email ?? ''}
        size="lg"
      >
        {detailLoading || !detail ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Identity + actions */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={detail.fullName} src={detail.profileImage ?? undefined} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={ROLE_VARIANT[detail.role]}>{ROLE_LABEL[detail.role]}</Badge>
                    <Badge variant={STATUS_VARIANT[detail.status]} dot>
                      {STATUS_LABEL[detail.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    Joined {shortDate(detail.createdAt)}
                    {detail.phone ? ` · ${detail.phone}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={detail.status === 'SUSPENDED' ? 'outline' : 'danger'}
                  size="sm"
                  onClick={() => applyStatus(detail, detail.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED')}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : detail.status === 'SUSPENDED' ? <CheckCircle2 className="size-3.5" /> : <Ban className="size-3.5" />}
                  {detail.status === 'SUSPENDED' ? 'Reactivate account' : 'Deactivate account'}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Activity stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y divide-neutral-100 text-sm">
                    <DetailRow label="Donations listed" value={detailStats?.donations ?? 0} />
                    <DetailRow label="Requests made" value={detailStats?.requests ?? 0} />
                    <DetailRow label="Deliveries" value={detailStats?.deliveries ?? 0} />
                    <DetailRow label="Active sessions" value={detailStats?.sessions ?? 0} />
                  </dl>
                </CardContent>
              </Card>

              {/* Role profile */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = ROLE_ICON[detail.role]
                      return <Icon className="size-4 text-brand-600" />
                    })()}
                    <CardTitle>Profile</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {profile ? (
                    <dl className="divide-y divide-neutral-100 text-sm">
                      {'organizationName' in profile && <DetailRow label="Organization" value={profile.organizationName} />}
                      {'ngoName' in profile && <DetailRow label="NGO name" value={profile.ngoName} />}
                      {'registrationNumber' in profile && <DetailRow label="Registration" value={profile.registrationNumber} />}
                      {'verificationStatus' in profile && <DetailRow label="Verification" value={profile.verificationStatus} />}
                      {'city' in profile && <DetailRow label="Location" value={profile.city && profile.state ? `${profile.city}, ${profile.state}` : null} />}
                      {'availability' in profile && <DetailRow label="Availability" value={profile.availability} />}
                      {'rating' in profile && <DetailRow label="Rating" value={profile.rating ? `${profile.rating.toFixed(1)} / 5` : null} />}
                      {'totalDeliveries' in profile && <DetailRow label="Deliveries" value={profile.totalDeliveries} />}
                    </dl>
                  ) : (
                    <p className="text-sm text-neutral-500">No role profile on file.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Role management (not for admins) */}
            {detail.role !== 'ADMIN' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <UserRound className="size-4 text-brand-600" />
                    <CardTitle>Manage role</CardTitle>
                  </div>
                  <CardDescription>
                    Changing the role creates the new profile automatically. The previous profile is kept for history.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-3">
                  <div className="w-52">
                    <Select
                      label="Role"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as AdminUserRole)}
                      aria-label="Change role"
                    >
                      <option value="DONOR">Donor</option>
                      <option value="NGO">NGO</option>
                      <option value="VOLUNTEER">Volunteer</option>
                    </Select>
                  </div>
                  <Button size="sm" onClick={handleRoleChange} disabled={busy || newRole === detail.role}>
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    Save role
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </DashboardShell>
  )
}
