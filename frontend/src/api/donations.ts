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
