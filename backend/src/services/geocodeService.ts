/**
 * Reverse geocoding for the profile pages (lat/lng → city/state/address).
 *
 * Leaflet renders map tiles but knows nothing about place names. The free,
 * keyless way to turn a coordinate into a city/state/address is OpenStreetMap's
 * **Nominatim** service — the same OSM data behind the tiles the maps draw.
 * The frontend never calls it directly: this proxy keeps the provider behind
 * one endpoint, sends a proper User-Agent (per Nominatim's usage policy), and
 * normalizes the response so profile forms can auto-fill their location fields.
 */

export interface ReverseGeocodeResult {
  /** Street-level description, e.g. "123, MG Road" (may be empty). */
  address: string
  /** City / town / village, e.g. "Ballari". */
  city: string
  /** State, e.g. "Karnataka". */
  state: string
}

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'

interface NominatimAddress {
  house_number?: string
  road?: string
  suburb?: string
  neighbourhood?: string
  quarter?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
  state_district?: string
  state?: string
}

/**
 * Resolves a coordinate to a city/state/address via Nominatim.
 * Returns `null` when the point has no usable address (ocean, desert, …) and
 * throws when the upstream service fails — the caller decides how to degrade.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const url = new URL(NOMINATIM_ENDPOINT)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'en')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Ecoserve/0.1 (student demo project; contact: ecoserve@example.com)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`)

  const json = (await res.json()) as { address?: NominatimAddress }
  const address = json.address
  if (!address) return null

  const street = [address.house_number, address.road ?? address.suburb ?? address.neighbourhood ?? address.quarter]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
    .trim()

  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    address.state_district ??
    ''
  const state = address.state ?? ''

  // Ocean/desert points often return a country-only address — treat those as
  // undetectable so profile forms don't clobber existing text with blanks.
  if (city === '' && state === '') return null

  return { address: street, city, state }
}
