/**
 * Reverse-geocoding tests.
 *
 * `geocodeService.reverseGeocode` powers the profile pages' location auto-fill
 * (city/state/address from a lat/lng pin). These tests exercise address-field
 * precedence, street composition, the no-result case, and upstream failures —
 * all with a stubbed global fetch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reverseGeocode } from '../src/services/geocodeService.js'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function okResponse(address: Record<string, string> | undefined) {
  return { ok: true, json: async () => ({ address }) }
}

describe('reverseGeocode', () => {
  it('resolves city, state and street address from Nominatim details', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        house_number: '12',
        road: 'MG Road',
        suburb: 'Shivajinagar',
        city: 'Bengaluru',
        state: 'Karnataka',
      }),
    )

    const result = await reverseGeocode(12.9716, 77.5946)

    expect(result).toEqual({ address: '12 MG Road', city: 'Bengaluru', state: 'Karnataka' })
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string)
    expect(url.origin).toBe('https://nominatim.openstreetmap.org')
    expect(url.pathname).toBe('/reverse')
    expect(url.searchParams.get('lat')).toBe('12.9716')
    expect(url.searchParams.get('lon')).toBe('77.5946')
  })

  it('falls back through town, village, municipality, county when city is missing', async () => {
    fetchMock.mockResolvedValue(okResponse({ road: 'Station Rd', village: 'Moodabidri', state: 'Karnataka' }))

    await expect(reverseGeocode(13.07, 74.99)).resolves.toEqual({
      address: 'Station Rd',
      city: 'Moodabidri',
      state: 'Karnataka',
    })
  })

  it('returns null for a point with no address details', async () => {
    fetchMock.mockResolvedValue(okResponse(undefined))

    await expect(reverseGeocode(0, 0)).resolves.toBeNull()
  })

  it('returns null for a country-only point (e.g. open ocean)', async () => {
    fetchMock.mockResolvedValue(okResponse({ country: 'India' }))

    await expect(reverseGeocode(0, 0)).resolves.toBeNull()
  })

  it('sends a identifying User-Agent per Nominatim usage policy', async () => {
    fetchMock.mockResolvedValue(okResponse({ city: 'Bengaluru', state: 'Karnataka' }))

    await reverseGeocode(12.97, 77.59)

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['User-Agent']).toMatch(/^Ecoserve\//)
  })

  it('throws when Nominatim responds with an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 })

    await expect(reverseGeocode(12.97, 77.59)).rejects.toThrow('Nominatim responded 429')
  })

  it('throws when the upstream request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    await expect(reverseGeocode(12.97, 77.59)).rejects.toThrow('network down')
  })
})
