/**
 * Phase 38, Step 96 — Transit-point discovery tests (matching support).
 *
 * `transitService.findNearbyTransitPoints` powers the rescue flow's map +
 * notification copy. These tests exercise classification, sorting, the limit,
 * coordinate fallbacks (node vs way/relation centers), and Overpass endpoint
 * failover — all with a stubbed global fetch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { findNearbyTransitPoints } from '../src/services/transitService.js'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function element(over: Record<string, unknown> = {}) {
  return { type: 'node', lat: 12.97, lon: 77.59, tags: {}, ...over }
}

function okResponse(elements: unknown[]) {
  return { ok: true, json: async () => ({ elements }) }
}

describe('findNearbyTransitPoints', () => {
  it('classifies points, sorts by distance, and honors the limit', async () => {
    fetchMock.mockResolvedValue(
      okResponse([
        element({ tags: { railway: 'station', name: 'Central Station' }, lat: 13.0, lon: 77.7 }), // ~36 km
        element({ tags: { highway: 'bus_stop', name: 'Near Stop' }, lat: 12.971, lon: 77.591 }), // ~0.16 km
        element({ tags: { amenity: 'shelter' }, lat: 12.972, lon: 77.592 }), // ~0.31 km, nameless → label fallback
      ]),
    )

    const points = await findNearbyTransitPoints(12.97, 77.59, 3000, 2)

    expect(points).toHaveLength(2)
    expect(points[0]!.name).toBe('Near Stop') // closest first
    expect(points[0]!.type).toBe('bus_stand')
    expect(points[0]!.label).toBe('bus stand')
    expect(points[1]!.name).toBe('homeless shelter') // tag name missing
    expect(points[1]!.type).toBe('homeless_shelter')
  })

  it('uses way/relation centroids when the element has no own coordinates', async () => {
    fetchMock.mockResolvedValue(
      okResponse([
        element({ type: 'way', lat: undefined, lon: undefined, center: { lat: 12.975, lon: 77.595 }, tags: { amenity: 'place_of_worship', name: 'Temple' } }),
      ]),
    )

    const points = await findNearbyTransitPoints(12.97, 77.59)
    expect(points).toHaveLength(1)
    expect(points[0]!.type).toBe('worship')
    expect(points[0]!.latitude).toBe(12.975)
  })

  it('drops elements that are unclassifiable or lack coordinates', async () => {
    fetchMock.mockResolvedValue(
      okResponse([
        element({ tags: { railway: 'station' }, lat: 12.97, lon: 77.59 }),
        element({ tags: { highway: 'primary' } }), // not a bus stop
        element({ tags: { amenity: 'shelter' }, lat: undefined, lon: undefined, center: {} }), // no usable coords
      ]),
    )

    const points = await findNearbyTransitPoints(12.97, 77.59)
    expect(points).toHaveLength(1)
  })

  it('rounds distanceKm to two decimals', async () => {
    fetchMock.mockResolvedValue(
      okResponse([element({ tags: { railway: 'station' }, lat: 12.971, lon: 77.591 })]),
    )

    const points = await findNearbyTransitPoints(12.97, 77.59)
    expect(points[0]!.distanceKm).toBe(0.16) // ~0.16 km apart
  })

  it('fails over to the next Overpass endpoint when the first errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    fetchMock.mockResolvedValueOnce(okResponse([element({ tags: { railway: 'station' } })]))

    const points = await findNearbyTransitPoints(12.97, 77.59)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(points).toHaveLength(1)
  })

  it('also fails over on a non-OK HTTP response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429 })
    fetchMock.mockResolvedValueOnce(okResponse([element({ tags: { highway: 'bus_stop' } })]))

    const points = await findNearbyTransitPoints(12.97, 77.59)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(points).toHaveLength(1)
  })

  it('returns [] when every endpoint is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('all down'))

    await expect(findNearbyTransitPoints(12.97, 77.59)).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns [] when the API responds with no elements', async () => {
    fetchMock.mockResolvedValue(okResponse([]))

    await expect(findNearbyTransitPoints(12.97, 77.59)).resolves.toEqual([])
  })
})
