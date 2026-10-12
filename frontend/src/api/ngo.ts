import type { NgoProfile } from '@/types/user'

import { api } from './client'

/** A donation within range of the NGO (Phase 18, Step 54). */
export interface NearbyDonation {
  id: string
  foodName: string
  description: string | null
  quantity: number
  unit: string
  pickupAddress: string
  expiryTime: string | null
  pickupTime: string | null
  status: string
  latitude: number | null
  longitude: number | null
  /** Distance from the NGO, in km. */
  distanceKm: number
  /** AI urgency 1–5 (null when no prediction yet). */
  priority: number | null
  category: string
  imageUrl: string | null
  donorOrganization: string
  donorCity: string
  donorState: string
}

export interface NgoRequestItem {
  id: string
  /** Requested quantity (null = full claim) */
  quantity: number | null
  /** Unit for requested quantity */
  unit: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
  requestedAt: string
  acceptedAt: string | null
  donation: {
    id: string
    foodName: string
    description: string | null
    quantity: number
    unit: string
    expiryTime: string | null
    status: string
    images: Array<{ id: string; imageUrl: string }>
    category: { name: string }
    donor: { organizationName: string; city: string; state: string }
    predictions: Array<{ priority: number | null; freshnessScore: number | null }>
  }
}

export interface InventoryItem {
  id: string
  foodName: string
  quantity: number
  unit: string
  status: string
  expiryTime: string | null
  priority: number | null
  freshnessScore: number | null
  category: string
  imageUrl: string | null
  donorOrganization: string
}

export interface NgoDashboardStats {
  acceptedCount: number
  mealsDistributed: number
  peopleServed: number
  todayDeliveries: number
  inventory: InventoryItem[]
}

/**
 * Step 54 — donations near the NGO, sorted by urgency server-side.
 * Phase 36, Step 91 — the response also carries `pagination` (?page&limit).
 */
export async function fetchNearbyDonations(params: {
  lat: number
  lng: number
  distance?: number
  priority?: number
  page?: number
  limit?: number
}): Promise<{
  donations: NearbyDonation[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}> {
  const { data } = await api.get<{
    donations: NearbyDonation[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>('/v1/donations/nearby', { params })
  return data
}

/** Step 55 — one-step claim: creates the request and reserves the donation.
 *  Supports partial quantity claims — donation stays AVAILABLE until fully claimed. */
export async function createNgoRequest(
  donationId: string,
  quantity?: number,
  unit?: string
): Promise<{ request: NgoRequestItem }> {
  const { data } = await api.post<{ request: NgoRequestItem }>('/v1/ngo/requests', { donationId, quantity, unit })
  return data
}

/** Phase 36, Step 91 — lists this NGO's requests, newest first, paginated. */
export async function fetchNgoRequests(params?: { page?: number; limit?: number }): Promise<{
  requests: NgoRequestItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}> {
  const { data } = await api.get<{ requests: NgoRequestItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
    '/v1/ngo/requests',
    { params },
  )
  return data
}

/** Step 53 — headline stats + inventory for the NGO dashboard. */
export async function fetchNgoDashboard(): Promise<NgoDashboardStats> {
  const { data } = await api.get<NgoDashboardStats>('/v1/ngo/dashboard')
  return data
}

/**
 * PATCH — updates the NGO's own profile. The location pin (lat/lng) powers
 * the nearby-donations search and the surplus map on the dashboard.
 */
export async function updateNgoProfile(payload: {
  ngoName?: string
  registrationNumber?: string
  address?: string
  city?: string
  state?: string
  latitude?: number | null
  longitude?: number | null
  capacity?: number | null
  description?: string | null
}): Promise<{ ngo: NgoProfile }> {
  const { data } = await api.patch<{ ngo: NgoProfile }>('/v1/ngo/profile', payload)
  return data
}
