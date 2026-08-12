import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'

import type { RescueSpot } from '@/api/volunteer'

interface MapPoint {
  latitude: number
  longitude: number
}

interface RescueSpotsMapProps {
  /** Donor pickup location (donation pin, else the donor profile pin). */
  pickup: MapPoint
  pickupLabel: string
  /** Nearby railway stations, bus stands, shelters… where food can be handed out. */
  spots: RescueSpot[]
}

/** Emoji per spot type — kept in sync with the legend and the spot list. */
export const SPOT_EMOJI: Record<RescueSpot['type'], string> = {
  railway_station: '🚉',
  bus_stand: '🚏',
  homeless_shelter: '🛏️',
  worship: '⛪',
  community_centre: '🏘️',
}

/** Brand pin for the donor pickup point. */
const pickupIcon = L.divIcon({
  className: '',
  html: '<span class="flex size-8 items-center justify-center rounded-full bg-brand-600 shadow-lg ring-2 ring-white"><span class="size-2.5 rounded-full bg-white"></span></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -30],
})

/** White bubble with the type emoji, ringed in rose so handout spots stand out. */
function spotIcon(emoji: string) {
  return L.divIcon({
    className: '',
    html: `<span class="flex size-8 items-center justify-center rounded-full bg-white text-base shadow-lg ring-2 ring-rose-400">${emoji}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30],
  })
}

/**
 * Phase 45 — the rescue mission map: the donor's pickup pin plus nearby
 * railway stations, bus stands, homeless shelters, worship places and
 * community centres where the volunteer can hand the rescued food out.
 */
export function RescueSpotsMap({ pickup, pickupLabel, spots }: RescueSpotsMapProps) {
  const bounds = L.latLngBounds([
    [pickup.latitude, pickup.longitude],
    ...spots.map((spot) => [spot.latitude, spot.longitude] as [number, number]),
  ])

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

      <Marker position={[pickup.latitude, pickup.longitude]} icon={pickupIcon}>
        <Popup>
          <span className="font-semibold">{pickupLabel}</span>
          <span className="block text-xs text-neutral-500">Pickup — take the food from here</span>
        </Popup>
      </Marker>

      {spots.map((spot) => (
        <Marker
          key={`${spot.type}-${spot.latitude.toFixed(5)}-${spot.longitude.toFixed(5)}`}
          position={[spot.latitude, spot.longitude]}
          icon={spotIcon(SPOT_EMOJI[spot.type])}
        >
          <Popup>
            <span className="font-semibold">{spot.name}</span>
            <span className="block text-xs text-neutral-500">
              {spot.label} · {spot.distanceKm} km from pickup
            </span>
            {spot.address && <span className="block text-xs text-neutral-500">{spot.address}</span>}
            <a href={spot.mapsUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-medium text-brand-600 hover:underline">
              Get directions ↗
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
