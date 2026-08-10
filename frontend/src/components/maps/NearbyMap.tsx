import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'

export interface NearbyMapDonation {
  id: string
  latitude: number
  longitude: number
  foodName: string
  donorOrganization: string
  distanceKm: number
}

interface NearbyMapProps {
  center: { latitude: number; longitude: number }
  ngoName: string
  donations: NearbyMapDonation[]
}

// divIcon markers (pure CSS) so we never depend on Leaflet's default PNG assets.
const ngoIcon = L.divIcon({
  className: '',
  html: '<span class="flex size-9 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white shadow-lg ring-2 ring-white">YOU</span>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -34],
})

const donationIcon = L.divIcon({
  className: '',
  html: '<span class="flex size-7 items-center justify-center rounded-full bg-emerald-500 shadow-lg ring-2 ring-white"><span class="size-2 rounded-full bg-white"></span></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -26],
})

/** Map of the NGO's location with the available donations around it (Step 53). */
export function NearbyMap({ center, ngoName, donations }: NearbyMapProps) {
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
      <Marker position={[center.latitude, center.longitude]} icon={ngoIcon}>
        <Popup>{ngoName} — your location</Popup>
      </Marker>
      {donations.map((donation) => (
        <Marker key={donation.id} position={[donation.latitude, donation.longitude]} icon={donationIcon}>
          <Popup>
            <strong>{donation.foodName}</strong>
            <br />
            {donation.donorOrganization} · {donation.distanceKm} km
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
