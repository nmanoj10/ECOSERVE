import type { VolunteerProfile } from '@/types/user'

import { api } from './client'

/** GPS sample sent to the backend during an active delivery (Phase 25, Step 66). */
export interface GpsSample {
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number
  heading?: number
  /** ISO-8601 timestamp from the GeolocationPosition. */
  timestamp?: string
}

/** Phase 28 — an active delivery returned by the /deliveries/tracking endpoint. */
export interface ActiveDelivery {
  id: string
  status: string
  startedAt: string | null
  eta: string | null
  distance: number | null
  donation: {
    id: string
    foodName: string
    donorOrganization: string
    ngoName: string | null
  }
  pickup: { latitude: number; longitude: number } | null
  drop: { latitude: number; longitude: number } | null
  volunteerName: string | null
}

export type VolunteerAvailability = 'AVAILABLE' | 'BUSY' | 'OFFLINE'

export interface VolunteerCurrentAssignment {
  id: string
  status: 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED'
  assignedAt: string
  acceptedAt: string | null
  donation: {
    id: string
    foodName: string
    quantity: number
    unit: string
    pickupAddress: string
    category: string
    donorOrganization: string
  }
  delivery: {
    id: string
    pickupLocation: string
    dropLocation: string
    startedAt: string | null
    completedAt: string | null
    eta: string | null
    distance: number | null
    status: string
  } | null
  pickup: { latitude: number; longitude: number } | null
  drop: { latitude: number; longitude: number } | null
  timeline: Array<{ type: 'assigned' | 'accepted' | 'in_transit' | 'completed'; label: string; at: string }>
}

export interface VolunteerRecentDelivery {
  id: string
  foodName: string
  donorOrganization: string
  ngoName: string | null
  distance: number | null
  completedAt: string | null
  status: string
}

export interface VolunteerDashboard {
  availability: VolunteerAvailability
  rating: number
  totalDeliveries: number
  todayDeliveries: number
  distanceKm: number
  mealsDelivered: number
  currentAssignment: VolunteerCurrentAssignment | null
  recentDeliveries: VolunteerRecentDelivery[]
}

/** Step 57 — headline stats + current assignment + history. */
export async function fetchVolunteerDashboard(): Promise<VolunteerDashboard> {
  const { data } = await api.get<VolunteerDashboard>('/v1/volunteer/dashboard')
  return data
}

/** Step 58 — toggle Available / Busy / Offline. */
export async function updateVolunteerAvailability(
  availability: VolunteerAvailability,
): Promise<{ volunteer: { availability: VolunteerAvailability } }> {
  const { data } = await api.patch<{ volunteer: { availability: VolunteerAvailability } }>('/v1/volunteer/availability', {
    availability,
  })
  return data
}

/**
 * PATCH — updates the volunteer's own profile (vehicle details + live location
 * pin used by rescue matching and the delivery drop-off). Returns the full
 * refreshed volunteer profile.
 */
export async function updateVolunteerProfile(payload: {
  vehicleType?: string | null
  vehicleNumber?: string | null
  availability?: VolunteerAvailability
  currentLatitude?: number | null
  currentLongitude?: number | null
}): Promise<{ volunteer: VolunteerProfile }> {
  const { data } = await api.patch<{ volunteer: VolunteerProfile }>('/v1/volunteer/profile', payload)
  return data
}

/**
 * Phase 25, Step 66 — Submit a GPS sample for the active delivery.
 * Called by `useDeliveryTracking` hook every ~10 seconds while in transit.
 */
export async function submitDeliveryLocation(
  deliveryId: string,
  sample: GpsSample,
): Promise<void> {
  await api.post(`/v1/deliveries/${deliveryId}/location`, {
    ...sample,
    // Send the timestamp as an ISO string so the backend can parse it.
    timestamp: sample.timestamp ?? new Date().toISOString(),
  })
}

/**
 * Phase 28 — Fetches active in-transit deliveries for the current user
 * (works for all roles: volunteer, donor, NGO).
 */
export async function fetchActiveDeliveries(): Promise<{ deliveries: ActiveDelivery[] }> {
  const { data } = await api.get<{ deliveries: ActiveDelivery[] }>('/v1/deliveries/tracking')
  return data
}

/**
 * Phase 29, Step 75 — Volunteer confirms the food reached the NGO.
 * Completes the delivery, frees the volunteer, and notifies donor + NGO.
 */
export async function completeDelivery(deliveryId: string): Promise<void> {
  await api.post(`/v1/deliveries/${deliveryId}/complete`)
}
