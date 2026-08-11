import type { DonorProfile } from '@/types/user'

import { api } from './client'

/**
 * PATCH — updates the donor's own profile. The location pin (lat/lng) backs
 * the nearby-donations search when a listing has no pin of its own.
 */
export async function updateDonorProfile(payload: {
  organizationName?: string
  organizationType?: string
  address?: string
  city?: string
  state?: string
  latitude?: number | null
  longitude?: number | null
  description?: string | null
}): Promise<{ donor: DonorProfile }> {
  const { data } = await api.patch<{ donor: DonorProfile }>('/v1/donor/profile', payload)
  return data
}
