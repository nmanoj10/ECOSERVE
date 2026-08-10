/**
 * Phase 24, Step 65 — Routing service.
 *
 * Leaflet renders the map tiles but has no routing engine. This service
 * queries the **OSRM** public demo server (`router.project-osrm.org`) to get
 * turn-by-turn road geometry, distance and duration between two points.
 *
 * The OSRM demo server is free and supports CORS, making it suitable for
 * development and small-scale demos. For production, deploy your own OSRM
 * instance or switch to a commercial provider.
 *
 * @see https://project-osrm.org/docs/v5.24.0/api/#route-service
 */

export interface RouteResult {
  /** Array of `[latitude, longitude]` pairs forming the road route. */
  geometry: Array<[number, number]>
  /** Total travel distance in kilometres (1 decimal). */
  distanceKm: number
  /** Total travel duration in seconds. */
  durationSec: number
}

interface MapPoint {
  latitude: number
  longitude: number
}

interface OSRMResponse {
  code: string
  routes?: Array<{
    distance: number  // metres
    duration: number  // seconds
    geometry: {
      coordinates: Array<[number, number]>  // [lng, lat]
    }
  }>
  message?: string
}

/** Base URL for the OSRM public demo server. */
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Fetches a road route between two coordinates from the OSRM public API.
 *
 * Returns `null` when the request fails (network error, server error, no route
 * found) so the caller can fall back to a straight-line display.
 */
export async function getRoute(pickup: MapPoint, drop: MapPoint): Promise<RouteResult | null> {
  const { latitude: pLat, longitude: pLng } = pickup
  const { latitude: dLat, longitude: dLng } = drop

  const url = `${OSRM_BASE}/${pLng},${pLat};${dLng},${dLat}?geometries=geojson&overview=full`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })

    if (!res.ok) {
      console.warn(`[routing] OSRM responded ${res.status}`, await res.text().catch(() => ''))
      return null
    }

    const json = (await res.json()) as OSRMResponse

    if (json.code !== 'Ok' || !json.routes?.[0]) {
      console.warn(`[routing] OSRM returned code "${json.code}"`, json.message ?? '')
      return null
    }

    const route = json.routes[0]

    // Convert GeoJSON [lng, lat] pairs to Leaflet's [lat, lng] format.
    const geometry: Array<[number, number]> = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    )

    return {
      geometry,
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationSec: route.duration,
    }
  } catch (err) {
    // Network errors, timeouts, etc.
    console.warn('[routing] Failed to fetch route:', err)
    return null
  }
}