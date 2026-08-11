import { useCallback, useState } from 'react'

export interface GeoCoords {
  latitude: number
  longitude: number
  accuracy: number | null
}

interface UseGeolocationResult {
  /** Latest coordinates from the browser (null until the first success). */
  coords: GeoCoords | null
  /** Human-readable error from the last attempt, or null. */
  error: string | null
  /** True while a location request is in flight. */
  loading: boolean
  /** False when the Geolocation API is unavailable (non-secure context, etc.). */
  supported: boolean
  /** Requests the current position once. */
  locate: () => void
}

/**
 * Thin wrapper over the browser Geolocation API with loading/error state.
 * Shared by the NGO profile page and the donor donation form so both can
 * drop a location pin with one button.
 */
export function useGeolocation(): UseGeolocationResult {
  const [coords, setCoords] = useState<GeoCoords | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  const locate = useCallback(() => {
    if (!supported) {
      setError('Location isn\u2019t available in this browser or page.')
      return
    }

    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
        })
        setLoading(false)
      },
      (err) => {
        // Drop any previous pin so consumers never react to stale coordinates.
        setCoords(null)
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied — enable it in your browser or enter coordinates manually.'
            : 'Could not get your location. Try again or enter coordinates manually.',
        )
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    )
  }, [supported])

  return { coords, error, loading, locate, supported }
}
