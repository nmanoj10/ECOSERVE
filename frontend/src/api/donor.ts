import type { DonorProfile } from '@/types/user'

import { api } from './client'

/**
 * PATCH — updates the donor's own profile. The location pin (lat/lng) backs
 * the nearby-donations search when a listing has no pin of its own.
 * `logoUrl` stores a public image URL (e.g. from ImageKit) for the donor showcase.
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
  logoUrl?: string | null
}): Promise<{ donor: DonorProfile }> {
  const { data } = await api.patch<{ donor: DonorProfile }>('/v1/donor/profile', payload)
  return data
}

/**
 * GET — returns all verified donors with logos for the public showcase.
 * Public endpoint (no auth required). Used for the moving marquee on the homepage.
 */
export async function fetchPublicDonors(): Promise<{
  donors: Array<{
    id: string
    organizationName: string
    organizationType: string
    city: string
    state: string
    logoUrl: string
    description: string | null
  }>
}> {
  const { data } = await api.get('/v1/public/donors')
  return data
}
