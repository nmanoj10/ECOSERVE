import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'

interface LocationPinMapProps {
  center: { latitude: number; longitude: number }
  /** Popup label shown on the pin, e.g. the organization or role name. */
  label: string
}

// divIcon marker (pure CSS) so we never depend on Leaflet's default PNG assets.
const pinIcon = L.divIcon({
  className: '',
  html: '<span class="flex size-9 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white shadow-lg ring-2 ring-white">YOU</span>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -34],
})

/** Static map preview centered on a single location pin (profile pages). */
export function LocationPinMap({ center, label }: LocationPinMapProps) {
  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={12}
      scrollWheelZoom={false}
      className="z-0 h-72 w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[center.latitude, center.longitude]} icon={pinIcon}>
        <Popup>{label}</Popup>
      </Marker>
    </MapContainer>
  )
}
