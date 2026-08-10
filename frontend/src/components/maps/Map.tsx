import { useEffect, useState, type ReactNode } from 'react'
import { DivIcon, type Icon, type LatLngBounds, type PolylineOptions } from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'

/** A geographic point in the component's props shape. */
export interface MapPoint {
  latitude: number
  longitude: number
}

/** A marker rendered on the map. `icon` defaults to the standard Leaflet pin. */
export interface MapMarker {
  id: string
  position: MapPoint
  icon?: Icon | DivIcon
  /** Shown in the popup when provided. */
  popup?: ReactNode
}

/** A polyline (route / boundary) drawn on the map. */
export interface MapPolyline {
  id: string
  positions: Array<[number, number]>
  options?: PolylineOptions
}

interface MapProps {
  /** Map center. Ignored when `bounds` is provided. */
  center?: MapPoint
  /** Initial zoom level. */
  zoom?: number
  /** Fit the map to these bounds instead of using center/zoom. */
  bounds?: LatLngBounds
  /** Markers to place on the map. */
  markers?: MapMarker[]
  /** Polylines to draw on the map. */
  polylines?: MapPolyline[]
  /** Show a live blue-dot marker at the browser's geolocation. */
  showCurrentLocation?: boolean
  /** Custom marker for the current-location dot (overrides the default). */
  currentLocationIcon?: DivIcon | Icon
  className?: string
  scrollWheelZoom?: boolean
}

// ── Internal helpers ──────────────────────────────────────────────────────

/** Applies `bounds` once the map is ready (react-leaflet's `useMap` hook). */
function FitBounds({ bounds }: { bounds: LatLngBounds }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(bounds, { padding: [48, 48] })
  }, [map, bounds])
  return null
}

/**
 * Tracks the browser's location via the Geolocation API.
 * Falls back to `null` when the API is unavailable or permission is denied.
 */
function useCurrentLocation() {
  const [position, setPosition] = useState<MapPoint | null>(null)

  useEffect(() => {
    if (!('geolocation' in navigator)) return

    const onSuccess = (pos: GeolocationPosition) => {
      setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
    }

    // Watch so the marker follows the user as they move.
    const watchId = navigator.geolocation.watchPosition(onSuccess, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 15_000,
    })

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return position
}

/** Default blue-dot CSS marker for the current location. */
const defaultLocationIcon = new DivIcon({
  className: '',
  html: '<span class="relative flex size-5 items-center justify-center"><span class="absolute size-5 rounded-full bg-blue-500/30"></span><span class="size-3 rounded-full bg-blue-600 ring-2 ring-white shadow"></span></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Reusable Leaflet map (Phase 23, Step 64).
 *
 * Supports: center, zoom, bounds-fitting, standard + custom markers with
 * popups, polylines, and an optional live current-location marker.
 *
 * If neither `center` nor `bounds` is provided, the component falls back to a
 * default center so the map always renders; markers are still usable.
 */
export function Map({
  center,
  zoom = 12,
  bounds,
  markers = [],
  polylines = [],
  showCurrentLocation = false,
  currentLocationIcon: customLocationIcon,
  className = 'z-0 h-72 w-full rounded-xl',
  scrollWheelZoom = false,
}: MapProps) {
  const currentPosition = useCurrentLocation()
  const hasBounds = !!bounds

  return (
    <MapContainer
      center={center ? [center.latitude, center.longitude] : [20, 0]}
      zoom={zoom}
      scrollWheelZoom={scrollWheelZoom}
      className={className}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {hasBounds && bounds && <FitBounds bounds={bounds} />}

      {polylines.map((polyline) => (
        <Polyline key={polyline.id} positions={polyline.positions} pathOptions={polyline.options} />
      ))}

      {markers.map((marker) => (
        <Marker key={marker.id} position={[marker.position.latitude, marker.position.longitude]} icon={marker.icon}>
          {marker.popup && <Popup>{marker.popup}</Popup>}
        </Marker>
      ))}

      {showCurrentLocation && currentPosition && (
        <Marker position={[currentPosition.latitude, currentPosition.longitude]} icon={customLocationIcon ?? defaultLocationIcon}>
          <Popup>Your location</Popup>
        </Marker>
      )}
    </MapContainer>
  )
}

export default Map