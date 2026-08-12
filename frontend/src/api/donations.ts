import { api } from './client'

/** One donation listing, as returned by GET /v1/donations (Step 48). */
export interface DonationListItem {
  id: string
  foodName: string
  description: string | null
  quantity: number
  unit: string
  /** DonationStatus: AVAILABLE | RESERVED | PICKED_UP | DELIVERED | EXPIRED | CANCELLED */
  status: string
  createdAt: string
  pickupAddress: string
  /** Scheduled pickup window (donor-set at listing) — present in the API payload. */
  pickupTime?: string | null
  /** When the food is no longer safe to donate. */
  expiryTime?: string | null
  category: { name: string }
  donor: { organizationName: string; city: string; state: string }
  images: Array<{ id: string; imageUrl: string }>
  predictions: Array<{
    freshnessScore: number | null
    safeHours: number | null
    spoilageRisk: string | null
    priority: number | null
  }>
}

export interface DonationsPage {
  donations: DonationListItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/**
 * Step 48 — list donations. Donors are automatically scoped to their own
 * listings; other roles browse the whole pool. `priority` (Phase 36, Step 92)
 * keeps only listings at or above that AI urgency.
 */
export async function fetchDonations(params?: { limit?: number; priority?: number }): Promise<DonationsPage> {
  const { data } = await api.get<DonationsPage>('/v1/donations', {
    params: { page: 1, limit: params?.limit ?? 5, priority: params?.priority },
  })
  return data
}

/** One NGO request as returned inside GET /v1/donations/:id (Step 49). */
export interface DonationDetailRequest {
  id: string
  status: string
  ngo: { id: string; ngoName: string; city: string | null; state: string | null; verificationStatus: string }
}

/** The volunteer assignment + delivery surfaced on a donation's detail. */
export interface DonationDetailAssignment {
  id: string
  status: string
  volunteer: {
    id: string
    vehicleType: string | null
    availability: string
    rating: number
    totalDeliveries: number
    user: { fullName: string; profileImage: string | null }
  } | null
  delivery: {
    id: string
    status: string
    startedAt: string | null
    completedAt: string | null
    eta: string | null
  } | null
}

/** Detail view of one donation: NGO requests, volunteer assignment, delivery (Step 49). */
export interface DonationDetail {
  id: string
  foodName: string
  quantity: number
  unit: string
  status: string
  pickupTime: string | null
  pickupAddress: string
  requests: DonationDetailRequest[]
  assignments: DonationDetailAssignment[]
}

/** Step 49 — one donation with its NGO requests, volunteer assignment, and delivery. */
export async function fetchDonation(id: string): Promise<{ donation: DonationDetail }> {
  const { data } = await api.get<{ donation: DonationDetail }>(`/v1/donations/${id}`)
  return data
}
