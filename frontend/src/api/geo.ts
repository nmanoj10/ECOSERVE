import { api } from './client'

/** A place resolved from coordinates (Nominatim proxy via the backend). */
export interface ReverseGeocodePlace {
  /** Street-level description, e.g. "123, MG Road" (may be empty). */
  address: string
  /** City / town / village. */
  city: string
  /** State. */
  state: string
}

/** GET /v1/geo/reverse — resolves a coordinate to city/state/address. */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ place: ReverseGeocodePlace | null }> {
  const { data } = await api.get<{ place: ReverseGeocodePlace | null }>('/v1/geo/reverse', {
    params: { lat, lng },
  })
  return data
}
