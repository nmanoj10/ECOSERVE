import { api } from './client'

// ── Shared ─────────────────────────────────────────────────────────────────

export interface AdminPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ── Phase 32, Step 82 — User management ────────────────────────────────────

export type AdminUserRole = 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN'
export type AdminUserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'

export interface AdminUserListItem {
  id: string
  fullName: string
  email: string
  phone: string | null
  role: AdminUserRole
  status: AdminUserStatus
  profileImage: string | null
  createdAt: string
  donor: { organizationName: string } | null
  ngo: { ngoName: string; verificationStatus: string } | null
  volunteer: { availability: string; totalDeliveries: number } | null
}

export interface AdminUserDetail extends AdminUserListItem {
  donor: {
    organizationName: string
    organizationType: string
    address: string
    city: string
    state: string
  } | null
  ngo: {
    ngoName: string
    registrationNumber: string
    address: string
    city: string
    state: string
    verificationStatus: string
  } | null
  volunteer: {
    vehicleType: string | null
    vehicleNumber: string | null
    availability: string
    rating: number
    totalDeliveries: number
  } | null
}

export interface AdminUserPage {
  users: AdminUserListItem[]
  pagination: AdminPagination
}

export interface AdminUserDetailResponse {
  user: AdminUserDetail
  stats: { donations: number; requests: number; deliveries: number; sessions: number }
}

/** Step 82 — search/filter/View the platform's users. */
export async function fetchAdminUsers(params?: {
  page?: number
  limit?: number
  search?: string
  role?: AdminUserRole
  status?: AdminUserStatus
}): Promise<AdminUserPage> {
  const { data } = await api.get<AdminUserPage>('/v1/admin/users', { params })
  return data
}

/** Step 82 — one user with full profiles + activity stats. */
export async function fetchAdminUser(id: string): Promise<AdminUserDetailResponse> {
  const { data } = await api.get<AdminUserDetailResponse>(`/v1/admin/users/${id}`)
  return data
}

/** Step 82 — activate (ACTIVE) or deactivate (SUSPENDED) an account. */
export async function updateAdminUserStatus(id: string, status: AdminUserStatus): Promise<{ user: AdminUserListItem }> {
  const { data } = await api.patch<{ user: AdminUserListItem }>(`/v1/admin/users/${id}/status`, { status })
  return data
}

/** Step 82 — change a user's role (DONOR | NGO | VOLUNTEER). */
export async function updateAdminUserRole(id: string, role: AdminUserRole): Promise<{ user: AdminUserListItem }> {
  const { data } = await api.patch<{ user: AdminUserListItem }>(`/v1/admin/users/${id}/role`, { role })
  return data
}

// ── Phase 32, Step 83 — NGO verification ───────────────────────────────────

export type NgoVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

export interface AdminNgoListItem {
  id: string
  ngoName: string
  registrationNumber: string
  address: string
  city: string
  state: string
  capacity: number | null
  description: string | null
  verificationStatus: NgoVerificationStatus
  createdAt: string
  user: { fullName: string; email: string; phone: string | null; status: string; createdAt: string }
}

export interface AdminNgoPage {
  ngos: AdminNgoListItem[]
  pagination: AdminPagination
}

export interface AdminNgoDetailResponse {
  ngo: AdminNgoListItem & {
    latitude: number | null
    longitude: number | null
    requests: Array<{
      id: string
      status: string
      requestedAt: string
      donation: {
        id: string
        foodName: string
        quantity: number
        unit: string
        status: string
        createdAt: string
      }
    }>
  }
  stats: {
    totalRequests: number
    acceptedRequests: number
    deliveredCount: number
    foodSavedKg: number
    mealsServed: number
  }
}

/** Step 83 — list NGOs, filtered by verification status for the review queue. */
export async function fetchAdminNgos(params?: {
  page?: number
  limit?: number
  search?: string
  verification?: NgoVerificationStatus
}): Promise<AdminNgoPage> {
  const { data } = await api.get<AdminNgoPage>('/v1/admin/ngos', { params })
  return data
}

/** Step 83 — full review context for one NGO. */
export async function fetchAdminNgo(id: string): Promise<AdminNgoDetailResponse> {
  const { data } = await api.get<AdminNgoDetailResponse>(`/v1/admin/ngos/${id}`)
  return data
}

/** Step 83 — approve the NGO application. */
export async function verifyAdminNgo(id: string): Promise<{ ngo: AdminNgoListItem }> {
  const { data } = await api.post<{ ngo: AdminNgoListItem }>(`/v1/admin/ngos/${id}/verify`)
  return data
}

/** Step 83 — reject the NGO application (optional reason). */
export async function rejectAdminNgo(id: string, reason?: string): Promise<{ ngo: AdminNgoListItem }> {
  const { data } = await api.post<{ ngo: AdminNgoListItem }>(`/v1/admin/ngos/${id}/reject`, { reason })
  return data
}

// ── Phase 32, Step 84 — Donation monitoring ────────────────────────────────

/** DonationStatus values as returned by the API (monitoring buckets map on top). */
export type AdminDonationStatus = 'AVAILABLE' | 'RESERVED' | 'PICKED_UP' | 'DELIVERED' | 'EXPIRED' | 'CANCELLED'

export interface AdminDonationListItem {
  id: string
  foodName: string
  description: string | null
  quantity: number
  unit: string
  status: AdminDonationStatus
  expiryTime: string | null
  pickupTime: string | null
  createdAt: string
  category: { name: string }
  donor: { organizationName: string; city: string; state: string }
  images: Array<{ id: string; imageUrl: string }>
  predictions: Array<{
    freshnessScore: number | null
    safeHours: number | null
    spoilageRisk: string | null
    priority: number | null
  }>
  requests: Array<{ ngo: { ngoName: string; verificationStatus: string } }>
}

export interface AdminDonationsPage {
  donations: AdminDonationListItem[]
  counts: Partial<Record<AdminDonationStatus, number>>
  pagination: AdminPagination
}

/** Step 84 — the platform-wide donation feed with per-status counts. */
export async function fetchAdminDonations(params?: {
  page?: number
  limit?: number
  search?: string
  status?: AdminDonationStatus
  /** Phase 36, Step 92 — minimum AI urgency (1–5). */
  priority?: number
}): Promise<AdminDonationsPage> {
  const { data } = await api.get<AdminDonationsPage>('/v1/admin/donations', { params })
  return data
}

// ── Phase 32, Step 85 — Delivery monitoring ────────────────────────────────

/** DeliveryStatus values as returned by the API. */
export type AdminDeliveryStatus =
  | 'PENDING'
  | 'AVAILABLE'
  | 'ACCEPTED'
  | 'VOLUNTEER_ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'

export interface AdminDeliveryListItem {
  id: string
  status: AdminDeliveryStatus
  eta: string | null
  startedAt: string | null
  completedAt: string | null
  distance: number | null
  pickupLocation: string
  dropLocation: string
  createdAt: string
  volunteer: {
    fullName: string
    profileImage: string | null
    vehicleType: string | null
    vehicleNumber: string | null
    availability: string
  }
  donation: {
    foodName: string
    quantity: number
    unit: string
    category: string
    donorOrganization: string
    ngoName: string | null
  }
  pickup: { latitude: number; longitude: number } | null
  drop: { latitude: number; longitude: number } | null
  /** Latest GPS ping from the volunteer — only present while in transit. */
  latestLocation: {
    latitude: number
    longitude: number
    accuracy: number | null
    speed: number | null
    heading: number | null
    timestamp: string
  } | null
}

export interface AdminDeliveriesPage {
  deliveries: AdminDeliveryListItem[]
  counts: Partial<Record<AdminDeliveryStatus, number>>
  /** Sum of the in-progress statuses — handy for the "Active" tab. */
  activeCount: number
  pagination: AdminPagination
}

/** Step 85 — the platform-wide delivery feed with per-status counts. */
export async function fetchAdminDeliveries(params?: {
  page?: number
  limit?: number
  search?: string
  status?: AdminDeliveryStatus
  active?: boolean
}): Promise<AdminDeliveriesPage> {
  const { data } = await api.get<AdminDeliveriesPage>('/v1/admin/deliveries', { params })
  return data
}

// ── Phase 33, Step 86 — Reports ────────────────────────────────────────────

export type ReportRange = 'weekly' | 'monthly' | 'yearly' | 'custom'

export interface ReportSeriesPoint {
  key: string // "YYYY-MM-DD" for day buckets, "YYYY-MM" for month buckets
  foodSavedKg: number
  donations: number
  deliveries: number
}

export interface AdminReport {
  range: { label: string; from: string; to: string }
  summary: {
    foodSavedKg: number
    mealsServed: number
    co2Kg: number
    donationsListed: number
    donationsDelivered: number
    donationsCancelled: number
    donationsExpired: number
    deliveriesTotal: number
    deliveriesCompleted: number
    deliveriesCancelled: number
    avgDeliveryTimeHours: number
    usersJoined: number
    ngosVerified: number
    volunteersActive: number
  }
  series: {
    bucket: 'day' | 'month'
    points: ReportSeriesPoint[]
  }
  donationByStatus: Partial<Record<AdminDonationStatus, number>>
  topNgos: Array<{ name: string; city: string | null; kg: number; meals: number; deliveries: number }>
  topVolunteers: Array<{ name: string; deliveries: number; distanceKm: number; meals: number }>
  environment: { co2Kg: number; treesEquivalent: number; carKmAvoided: number }
}

/** Step 86 — the full platform report for a weekly/monthly/yearly/custom window. */
export async function fetchAdminReports(params?: {
  range: ReportRange
  from?: string
  to?: string
}): Promise<AdminReport> {
  const { data } = await api.get<AdminReport>('/v1/admin/reports', { params })
  return data
}
