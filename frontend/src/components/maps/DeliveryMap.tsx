import { useEffect, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'

import { getRoute, type RouteResult } from '@/services/routing'

interface MapPoint {
  latitude: number
  longitude: number
}

interface DeliveryMapProps {
  pickup: MapPoint
  drop: MapPoint
  pickupLabel: string
  dropLabel: string
  /** Current GPS position — renders a live blue moving marker. */
  currentLocation?: MapPoint | null
}

/** Blue dot for the volunteer's live GPS position. */
const liveIcon = L.divIcon({
  className: '',
  html: '<span class="relative flex size-5 items-center justify-center"><span class="absolute size-5 animate-ping rounded-full bg-blue-400"></span><span class="z-10 size-3 rounded-full bg-blue-600 ring-2 ring-white shadow"></span></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const pickupIcon = L.divIcon({
  className: '',
  html: '<span class="flex size-7 items-center justify-center rounded-full bg-brand-600 shadow-lg ring-2 ring-white"><span class="size-2 rounded-full bg-white"></span></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -26],
})

const dropIcon = L.divIcon({
  className: '',
  html: '<span class="flex size-7 items-center justify-center rounded-full bg-amber-500 shadow-lg ring-2 ring-white"><span class="size-2 rounded-full bg-white"></span></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -26],
})

/**
 * Map of the current assignment: pickup → drop.
 *
 * When the routing service (Phase 24, Step 65) returns a road route the
 * polyline follows the actual road geometry.  On failure or while loading it
 * falls back to a straight dashed line so the map never stays empty.
 */
export function DeliveryMap({ pickup, drop, pickupLabel, dropLabel, currentLocation }: DeliveryMapProps) {
  const [route, setRoute] = useState<RouteResult | null | 'loading'>('loading')

  useEffect(() => {
    let active = true

    const fetchRoute = async () => {
      setRoute('loading')
      const result = await getRoute(pickup, drop)
      if (active) setRoute(result)
    }

    void fetchRoute()

    return () => {
      active = false
    }
  }, [pickup.latitude, pickup.longitude, drop.latitude, drop.longitude])

  const bounds = L.latLngBounds([pickup.latitude, pickup.longitude], [drop.latitude, drop.longitude])
  const straightLine: Array<[number, number]> = [
    [pickup.latitude, pickup.longitude],
    [drop.latitude, drop.longitude],
  ]

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [48, 48] }}
      scrollWheelZoom={false}
      className="z-0 h-72 w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Route polyline — road geometry when available, straight dashed fallback */}
      <Polyline
        positions={route && route !== 'loading' ? route.geometry : straightLine}
        pathOptions={
          route && route !== 'loading'
            ? { color: '#16a34a', weight: 4, opacity: 0.8 }
            : { color: '#16a34a', weight: 3, dashArray: '7 6', opacity: 0.5 }
        }
      />

      {route && route !== 'loading' && route.distanceKm > 0 && route.geometry.length > 0 && (
        <Marker
          position={route.geometry[Math.floor(route.geometry.length / 2)]!}
          interactive={false}
          icon={L.divIcon({
            className: '',
            html: `<span class="rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur-sm">${route.distanceKm} km</span>`,
            iconSize: [48, 20],
            iconAnchor: [24, 10],
          })}
        />
      )}

      <Marker position={[pickup.latitude, pickup.longitude]} icon={pickupIcon}>
        <Popup>{pickupLabel} — pickup</Popup>
      </Marker>
      <Marker position={[drop.latitude, drop.longitude]} icon={dropIcon}>
        <Popup>{dropLabel} — drop-off</Popup>
      </Marker>

      {currentLocation && (
        <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={liveIcon}>
          <Popup>You are here</Popup>
        </Marker>
      )}
    </MapContainer>
  )
}