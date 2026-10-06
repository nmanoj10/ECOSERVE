import { haversineKm } from '../utils/geo.js'
import { env } from '../config/env.js'

/**
 * Transit-point discovery for the rescue flow (Phase 19, Step 56).
 *
 * Leaflet only renders map tiles — it has no idea where railway stations or
 * bus stands are. The free, keyless way to get that data is the OpenStreetMap
 * **Overpass API**, which is exactly the source behind the OSM tiles Leaflet
 * draws. We query it server-side and return the points for the frontend map.
 *
 * Beyond stations and bus stands we also look for the places homeless people
 * commonly gather so donors/volunteers know exactly where to hand out food:
 * homeless shelters, places of worship, and community centres.
 */

export interface TransitPoint {
  name: string
  type: 'railway_station' | 'bus_stand' | 'homeless_shelter' | 'worship' | 'community_centre'
  /** Human-readable category label used in notification text. */
  label: string
  /** Best-effort street/city address from the OSM element's addr:* tags, e.g. "12, MG Road, Bengaluru". */
  address: string | null
  latitude: number
  longitude: number
  distanceKm: number
  /**
   * Approximate travel time in minutes from the search point, straight-line
   * distance ÷ `RESCUE_AVG_SPEED_KMH`. A budget heuristic — never a turn-by-turn
   * ETA, so the UI says "~X min by road (estimate)".
   */
  travelTimeMinutes: number
}

const TYPE_LABELS: Record<TransitPoint['type'], string> = {
  railway_station: 'railway station',
  bus_stand: 'bus stand',
  homeless_shelter: 'homeless shelter',
  worship: 'place of worship',
  community_centre: 'community centre',
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

interface OverpassElement {
  type: string
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function classify(element: OverpassElement): TransitPoint['type'] | null {
  const tags = element.tags ?? {}
  if (tags['railway'] === 'station') return 'railway_station'
  if (tags['highway'] === 'bus_stop') return 'bus_stand'
  if (tags['amenity'] === 'shelter') return 'homeless_shelter'
  if (tags['amenity'] === 'place_of_worship') return 'worship'
  if (tags['amenity'] === 'community_centre') return 'community_centre'
  return null
}

/**
 * Builds a best-effort street address from the element's OSM `addr:*` tags.
 * Bus stops and shelters rarely carry a full address, so this is advisory —
 * `null` when nothing usable is tagged.
 */
function pointAddress(tags: Record<string, string>): string | null {
  const street = tags['addr:street'] ?? tags['addr:place'] ?? tags['addr:road']
  const number = tags['addr:housenumber']
  const city =
    tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'] ?? tags['addr:suburb'] ?? tags['addr:district']

  const streetPart = number && street ? `${number} ${street}` : (street ?? null)
  const parts = [streetPart, city ?? null].filter((part): part is string => Boolean(part?.trim()))
  return parts.length > 0 ? parts.join(', ') : null
}

/**
 * Queries the Overpass API for rescue spots around a point. Two `out` blocks
 * keep the list balanced: up to 8 transit points, then up to 4 social spots
 * (shelters/worship/community centres) so one category can't crowd out the
 * others.
 */
async function queryOverpass(
  lat: number,
  lng: number,
  radiusMeters: number,
  endpoint: string,
): Promise<OverpassElement[]> {
  // `nwr` (node/way/relation) catches stations mapped as areas or relations,
  // not just point nodes; `out center` gives a centroid for ways/relations.
  const query = `
    [out:json][timeout:20];
    (
      nwr["railway"="station"](around:${radiusMeters},${lat},${lng});
      nwr["highway"="bus_stop"](around:${radiusMeters},${lat},${lng});
    );
    out center tags 8;
    (
      nwr["amenity"="shelter"](around:${radiusMeters},${lat},${lng});
      nwr["amenity"="place_of_worship"](around:${radiusMeters},${lat},${lng});
      nwr["amenity"="community_centre"](around:${radiusMeters},${lat},${lng});
    );
    out center tags 4;
  `

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Overpass responded ${res.status}`)

  const json = (await res.json()) as { elements?: OverpassElement[] }
  return json.elements ?? []
}

/**
 * Finds up to `limit` nearby railway stations, bus stands and other spots
 * where people in need are commonly found, sorted by distance. The radius
 * defaults to `RESCUE_SPOT_RADIUS_KM` (env-tunable). Returns `[]` when the
 * upstream API is unreachable — the caller degrades gracefully (falls back to
 * the donation's own coordinates).
 */
export async function findNearbyTransitPoints(
  lat: number,
  lng: number,
  radiusMeters = env.RESCUE_SPOT_RADIUS_KM * 1000,
  limit = 8,
): Promise<TransitPoint[]> {
  let elements: OverpassElement[] = []
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      elements = await queryOverpass(lat, lng, radiusMeters, endpoint)
      break
    } catch (err) {
      console.error(`[transit] Overpass query failed (${endpoint}):`, err)
    }
  }

  const points: TransitPoint[] = elements
    .map((el) => {
      const pointLat = el.lat ?? el.center?.lat
      const pointLng = el.lon ?? el.center?.lon
      const type = classify(el)
      if (pointLat == null || pointLng == null || !type) return null
      const tags = el.tags ?? {}
      const distanceKm = Math.round(haversineKm(lat, lng, pointLat, pointLng) * 100) / 100

      return {
        name: tags['name'] ?? TYPE_LABELS[type],
        type,
        label: TYPE_LABELS[type],
        address: pointAddress(tags),
        latitude: pointLat,
        longitude: pointLng,
        distanceKm,
        travelTimeMinutes: Math.max(1, Math.ceil((distanceKm * 60) / env.RESCUE_AVG_SPEED_KMH)),
      }
    })
    .filter((point): point is TransitPoint => point !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)

  return points
}
