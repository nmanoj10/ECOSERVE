import { useCallback, useState } from 'react'

import { reverseGeocode, type ReverseGeocodePlace } from '@/api/geo'

interface UseReverseGeocodeResult {
  /** Last resolved place, or null when nothing has been resolved yet. */
  place: ReverseGeocodePlace | null
  loading: boolean
  error: string | null
  /** Resolves coordinates to a place; returns null when undetectable. */
  lookup: (lat: number, lng: number) => Promise<ReverseGeocodePlace | null>
}

/**
 * Resolves a location pin to a city/state/address via the backend Nominatim
 * proxy. Used by the profile pages to auto-fill location fields.
 */
export function useReverseGeocode(): UseReverseGeocodeResult {
  const [place, setPlace] = useState<ReverseGeocodePlace | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = useCallback(async (lat: number, lng: number) => {
    setLoading(true)
    setError(null)
    try {
      const { place: result } = await reverseGeocode(lat, lng)
      setPlace(result)
      return result
    } catch {
      setError('Could not detect the place name for those coordinates.')
      setPlace(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { place, loading, error, lookup }
}
