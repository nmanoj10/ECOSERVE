import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'

import type { GpsSample } from '@/api/volunteer'
import { joinDeliveryRoom, leaveDeliveryRoom } from '@/services/socket'
import { getRoute, type RouteResult } from '@/services/routing'
import { connectSocket, getSocket } from '@/services/socket'

export interface MapPoint {
  latitude: number
  longitude: number
}

interface LiveTrackingMapProps {
  deliveryId: string
  pickup: MapPoint
  drop: MapPoint
  pickupLabel: string
  dropLabel: string
  volunteerName?: string | null
  eta?: string | null
  distance?: number | null
  status?: string
}

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

const liveIcon = L.divIcon({
  className: '',
  html: '<span class="relative flex size-5 items-center justify-center"><span class="absolute size-5 animate-ping rounded-full bg-blue-400"></span><span class="z-10 size-3 rounded-full bg-blue-600 ring-2 ring-white shadow"></span></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

/**
 * Phase 28, Steps 73–74 — Live tracking map for donor / NGO.
 *
 * Connects to the delivery room, listens for `delivery:location` socket
 * events, and renders a moving volunteer marker, the pickup → drop route,
 * pickup/drop markers, ETA, distance, and status.
 */
export function LiveTrackingMap({
  deliveryId,
  pickup,
  drop,
  pickupLabel,
  dropLabel,
  volunteerName,
  eta,
  distance,
  status,
}: LiveTrackingMapProps) {
  const [route, setRoute] = useState<RouteResult | null | 'loading'>('loading')
  const [livePosition, setLivePosition] = useState<MapPoint | null>(null)
  const activeRef = useRef(true)

  // ── Fetch the road route ─────────────────────────────────────────────
  useEffect(() => {
    let active = true
    const fetchRoute = async () => {
      setRoute('loading')
      const result = await getRoute(pickup, drop)
      if (active) setRoute(result)
    }
    void fetchRoute()
    return () => { active = false }
  }, [pickup.latitude, pickup.longitude, drop.latitude, drop.longitude])

  // ── Listen for live location events ──────────────────────────────────
  useEffect(() => {
    activeRef.current = true

    const init = async () => {
      await connectSocket()
      joinDeliveryRoom(deliveryId)

      const socket = getSocket()
      if (!socket) return

      const onLocation = (data: GpsSample & { latitude: number; longitude: number }) => {
        if (!activeRef.current) return
        setLivePosition({ latitude: data.latitude, longitude: data.longitude })
      }

      socket.on('delivery:location', onLocation)

      return () => {
        socket.off('delivery:location', onLocation)
        leaveDeliveryRoom(deliveryId)
      }
    }

    const cleanupPromise = init()
    return () => {
      activeRef.current = false
      cleanupPromise.then((cleanup) => cleanup?.())
    }
  }, [deliveryId])

  const bounds = L.latLngBounds([pickup.latitude, pickup.longitude], [drop.latitude, drop.longitude])
  const straightLine: Array<[number, number]> = [[pickup.latitude, pickup.longitude], [drop.latitude, drop.longitude]]

  return (
    <div className="space-y-3">
      {/* Status + ETA bar */}
      <div className="flex flex-wrap items-center gap-3">
        {status && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-brand-500" />
            </span>
            {status === 'IN_TRANSIT' ? 'In transit' : status}
          </span>
        )}
        {eta && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
            ETA {new Date(eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {distance != null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
            {distance} km
          </span>
        )}
        {volunteerName && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
            {volunteerName}
          </span>
        )}
      </div>

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

        {/* Route polyline */}
        <Polyline
          positions={route && route !== 'loading' ? route.geometry : straightLine}
          pathOptions={
            route && route !== 'loading'
              ? { color: '#16a34a', weight: 4, opacity: 0.8 }
              : { color: '#16a34a', weight: 3, dashArray: '7 6', opacity: 0.5 }
          }
        />

        {/* Distance chip */}
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

        {/* Live position */}
        {livePosition && (
          <Marker position={[livePosition.latitude, livePosition.longitude]} icon={liveIcon}>
            <Popup>Volunteer&apos;s live location</Popup>
          </Marker>
        )}

        <Marker position={[pickup.latitude, pickup.longitude]} icon={pickupIcon}>
          <Popup>{pickupLabel} — pickup</Popup>
        </Marker>
        <Marker position={[drop.latitude, drop.longitude]} icon={dropIcon}>
          <Popup>{dropLabel} — drop-off</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}